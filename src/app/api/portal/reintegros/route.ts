import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getRoleEmails } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl, getReplyTo } from '@/lib/email/layout';
import { hasReimbursementAccess, logEvent, actorDisplayName } from '@/lib/reimbursementAccess';
import {
  ALLOWED_MIMES,
  MAX_FILE_BYTES,
  evaluateRequest,
  money,
  todayInArgentina,
} from '@/lib/reimbursements';

export const dynamic = 'force-dynamic';

const BUCKET = 'reimbursement-files';

// GET /api/portal/reintegros — mis reintegros + si estoy habilitado
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const enabled = await hasReimbursementAccess(auth.employee.id);
    if (!enabled) return NextResponse.json({ enabled: false, items: [], projects: [] });

    const supabase = getSupabaseServer();
    const [items, projects, reasons] = await Promise.all([
      supabase
        .from('expense_reimbursements_with_details')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .order('created_at', { ascending: false }),
      supabase.from('expense_projects').select('id, name, client_name').eq('active', true).order('name'),
      supabase.from('expense_reasons').select('id, name').eq('active', true).order('sort_order'),
    ]);

    if (items.error) return NextResponse.json({ error: items.error.message }, { status: 500 });
    if (projects.error) return NextResponse.json({ error: projects.error.message }, { status: 500 });
    if (reasons.error) return NextResponse.json({ error: reasons.error.message }, { status: 500 });

    return NextResponse.json({
      enabled: true,
      items: items.data ?? [],
      projects: projects.data ?? [],
      reasons: reasons.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha del gasto inválida.'),
  reason_id: z.string().uuid('Elegí un motivo.'),
  concept: z.string().trim().min(3, 'Escribí una descripción del gasto.').max(500),
  amount: z.number().positive('El monto tiene que ser mayor a 0.').max(100_000_000),
  currency: z.enum(['ARS', 'USD']),
  project_id: z.string().uuid().nullable().optional(),
  receipt_type: z.enum(['factura_a', 'factura_b', 'factura_c', 'ticket', 'recibo', 'otro']),
  receipt_number: z.string().trim().max(60).optional().nullable(),
  supplier_cuit: z
    .string()
    .trim()
    .regex(/^[0-9]{11}$/, 'El CUIT tiene que tener 11 dígitos, sin guiones.')
    .optional()
    .nullable(),
  /** Explicación cuando una regla de fecha o monto no se cumple. */
  justification: z.string().trim().max(500).optional().nullable(),
});

/**
 * POST /api/portal/reintegros — alta de un reintegro.
 *
 * Multipart, porque el comprobante es obligatorio: se sube en el mismo request
 * que los datos. Si se hiciera en dos pasos podrían quedar reintegros sin
 * comprobante, que es justo lo que el circuito no admite.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // La habilitación se valida acá y no sólo en la UI: esconder el menú no es
    // una barrera.
    if (!(await hasReimbursementAccess(auth.employee.id))) {
      return NextResponse.json(
        { error: 'No tenés habilitado el módulo de reintegros. Escribile a People si lo necesitás.' },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get('receipt') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'El comprobante es obligatorio.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'El comprobante no puede superar 10 MB.' }, { status: 400 });
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: 'El comprobante tiene que ser PDF, JPG, PNG o WEBP.' }, { status: 400 });
    }

    const raw = form.get('data');
    const parsed = CreateSchema.safeParse(JSON.parse(typeof raw === 'string' ? raw : '{}'));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const d = parsed.data;

    const today = todayInArgentina();
    const evaluation = evaluateRequest({
      expenseDate: d.expense_date,
      amount: d.amount,
      currency: d.currency,
      today,
    });
    // Las reglas no bloquean, pero si alguna falla el motivo es obligatorio.
    if (evaluation.requiresReason && !d.justification) {
      return NextResponse.json(
        { error: 'Contanos el motivo: la fecha o el monto salen de lo habitual.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    // El motivo se resuelve ahora para guardar su nombre: si se renombra o se
    // retira, el reintegro histórico sigue diciendo con qué motivo se pidió.
    const { data: reason } = await supabase
      .from('expense_reasons')
      .select('name, active')
      .eq('id', d.reason_id)
      .maybeSingle();
    if (!reason || !reason.active) {
      return NextResponse.json({ error: 'El motivo elegido no está disponible.' }, { status: 400 });
    }

    // El proyecto se resuelve ahora para guardar el label: si después se renombra
    // o se desactiva, el reporte histórico sigue diciendo a qué se imputó.
    let projectLabel: string | null = null;
    if (d.project_id) {
      const { data: proj } = await supabase
        .from('expense_projects')
        .select('name, client_name, active')
        .eq('id', d.project_id)
        .maybeSingle();
      if (!proj || !proj.active) {
        return NextResponse.json({ error: 'El proyecto elegido no está disponible.' }, { status: 400 });
      }
      projectLabel = proj.client_name ? `${proj.client_name} · ${proj.name}` : (proj.name as string);
    }

    // La fila se crea primero para tener el id que nombra el archivo, y así el
    // path del comprobante queda atado al reintegro y no a un uuid suelto.
    const { data: created, error: insertError } = await supabase
      .from('expense_reimbursements')
      .insert({
        employee_id: auth.employee.id,
        leader_id: auth.employee.manager_id ?? null,
        expense_date: d.expense_date,
        reason_id: d.reason_id,
        reason_label_snapshot: reason.name as string,
        concept: d.concept,
        amount: d.amount,
        currency: d.currency,
        project_id: d.project_id ?? null,
        project_label_snapshot: projectLabel,
        receipt_type: d.receipt_type,
        receipt_number: d.receipt_number || null,
        supplier_cuit: d.supplier_cuit || null,
        receipt_path: 'pendiente',
        receipt_filename: file.name,
        receipt_size: file.size,
        receipt_mime: file.type,
        validations: { rules: evaluation.rules, justification: d.justification ?? null, evaluated_on: today },
      })
      .select('id')
      .single();

    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message ?? 'No se pudo crear el reintegro.' }, { status: 500 });
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
    const path = `${created.id}/comprobante-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });

    if (uploadError) {
      // Sin comprobante el reintegro no puede existir: se borra la fila para no
      // dejar una solicitud imposible de validar.
      await supabase.from('expense_reimbursements').delete().eq('id', created.id);
      return NextResponse.json({ error: `No se pudo subir el comprobante: ${uploadError.message}` }, { status: 500 });
    }

    const { error: pathError } = await supabase
      .from('expense_reimbursements')
      .update({ receipt_path: path })
      .eq('id', created.id);
    if (pathError) {
      await supabase.storage.from(BUCKET).remove([path]);
      await supabase.from('expense_reimbursements').delete().eq('id', created.id);
      return NextResponse.json({ error: pathError.message }, { status: 500 });
    }

    const actorName = await actorDisplayName(auth.user.id, auth.user.email);
    await logEvent({
      reimbursementId: created.id,
      eventType: 'created',
      toStatus: 'requested',
      actorUserId: auth.user.id,
      actorName,
      note: d.justification || null,
    });

    await notifyApprover({
      reimbursementId: created.id,
      employeeName: actorName,
      leaderId: auth.employee.manager_id ?? null,
      concept: d.concept,
      amount: d.amount,
      currency: d.currency,
      reason: reason.name as string,
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[reintegros] alta:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Avisa a quien tiene que aprobar. Sin líder cargado, la solicitud cae en la cola
 * de People, así que el aviso va ahí — si no, quedaría esperando a nadie.
 */
async function notifyApprover(input: {
  reimbursementId: string;
  employeeName: string;
  leaderId: string | null;
  concept: string;
  amount: number;
  currency: string;
  reason: string;
}) {
  const supabase = getSupabaseServer();
  const importe = money(input.amount, input.currency);
  const motivo = input.reason;

  let userIds: string[] = [];
  let emails: string[] = [];

  if (input.leaderId) {
    const { data: leader } = await supabase
      .from('employees')
      .select('user_id, work_email, personal_email, first_name')
      .eq('id', input.leaderId)
      .maybeSingle();
    if (leader?.user_id) userIds = [leader.user_id as string];
    const mail = (leader?.work_email as string) || (leader?.personal_email as string);
    if (mail) emails = [mail];
  } else {
    // getRoleEmails devuelve objetos, no strings.
    emails = (await getRoleEmails(['admin'])).map((r) => r.email);
  }

  const url = `${getAppUrl()}/admin/reintegros`;

  await Promise.allSettled([
    userIds.length
      ? createSystemNotification({
          userIds,
          title: 'Un reintegro espera tu aprobación',
          body: `${input.employeeName} pidió el reintegro de ${importe} (${motivo}).`,
          deepLink: '/portal/team/reintegros',
          dedupeKey: `reintegro-nuevo-${input.reimbursementId}`,
        })
      : Promise.resolve(),
    ...emails.map((to) =>
      sendSimpleEmail({
        to,
        subject: `Reintegro a aprobar: ${input.employeeName} — ${importe}`,
        replyTo: getReplyTo(),
        html: renderEmail({
          title: 'Un reintegro espera tu aprobación',
          contextLabel: 'People · Reintegros',
          intro: `${input.employeeName} pidió el reintegro de un gasto y necesita tu aprobación.`,
          details: [
            { label: 'Concepto', value: input.concept },
            { label: 'Motivo', value: motivo },
            { label: 'Monto', value: importe },
          ],
          cta: { label: 'Ver el reintegro', url },
          outro: input.leaderId ? undefined : 'Esta persona no tiene líder cargado, así que la aprobación queda en People.',
        }),
      }),
    ),
  ]);
}
