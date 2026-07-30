import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getAdminUserIds } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl } from '@/lib/email/layout';
import { evaluateAdvanceRules, defaultDiscountPeriod } from '@/lib/salaryAdvances';
import type { ExistingAdvanceLite } from '@/lib/salaryAdvances';
import type { SalaryAdvanceType } from '@/types/salaryAdvance';

const CreateSchema = z.object({
  amount: z.number().positive('El monto debe ser positivo'),
  reason: z.string().trim().optional().nullable(),
  emergency: z.boolean().optional(),
  discount_year: z.number().int().optional(),
  discount_month: z.number().int().min(1).max(12).optional(),
});

// GET /api/portal/salary-advances — mis adelantos + preview de validación
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data: advances, error } = await supabase
      .from('salary_advances_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching salary advances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Preview de reglas automáticas para el empleado, ahora.
    const existing: ExistingAdvanceLite[] = (advances ?? []).map((a) => ({
      status: a.status,
      requested_at: a.requested_at,
    }));
    const preview = evaluateAdvanceRules({
      hireDate: auth.employee.hire_date ?? null,
      now: new Date(),
      existing,
    });

    return NextResponse.json({ advances: advances ?? [], preview });
  } catch (error: any) {
    console.error('Error in GET /api/portal/salary-advances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/salary-advances — crear solicitud
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    const { amount, reason, emergency } = parsed.data;

    const supabase = getSupabaseServer();

    // Re-evaluar reglas server-side (no confiar en el cliente)
    const { data: existingRows } = await supabase
      .from('salary_advances')
      .select('status, requested_at')
      .eq('employee_id', auth.employee.id);

    const now = new Date();
    const evaluation = evaluateAdvanceRules({
      hireDate: auth.employee.hire_date ?? null,
      now,
      existing: (existingRows ?? []) as ExistingAdvanceLite[],
    });

    // Motivo obligatorio si no es estándar o si es emergencia
    const needsReason = evaluation.requiresReason || emergency === true;
    if (needsReason && (!reason || reason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Esta solicitud requiere un motivo (excepción/emergencia).' },
        { status: 400 },
      );
    }

    // Regla 4: no permitir una nueva si hay un adelanto vigente
    if (evaluation.failedAuto.includes(4)) {
      return NextResponse.json(
        { error: 'Ya tenés un adelanto vigente. No podés solicitar otro hasta saldarlo.' },
        { status: 400 },
      );
    }

    // Tipo
    let type: SalaryAdvanceType = 'standard';
    if (emergency) type = 'emergency';
    else if (evaluation.classification !== 'standard') type = 'exception';

    const discount =
      parsed.data.discount_year && parsed.data.discount_month
        ? { year: parsed.data.discount_year, month: parsed.data.discount_month }
        : defaultDiscountPeriod(now);

    const { data: created, error: insertError } = await supabase
      .from('salary_advances')
      .insert({
        employee_id: auth.employee.id,
        amount,
        reason: reason?.trim() || null,
        type,
        status: 'pending_hr',
        validations: evaluation,
        discount_year: discount.year,
        discount_month: discount.month,
        balance_pending: amount,
        requested_at: now.toISOString(),
        created_by: auth.user.id,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      console.error('Error creating salary advance:', insertError);
      return NextResponse.json({ error: insertError?.message ?? 'Error al crear' }, { status: 500 });
    }

    // Evento
    await supabase.from('salary_advance_events').insert({
      advance_id: created.id,
      event_type: 'created',
      to_status: 'pending_hr',
      actor_user_id: auth.user.id,
      note: `Tipo: ${type}`,
    });

    const employeeName = `${auth.employee.first_name ?? ''} ${auth.employee.last_name ?? ''}`.trim();
    const amountLabel = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);

    // Notificación in-app a admins (RRHH)
    getAdminUserIds()
      .then((adminIds) =>
        createSystemNotification({
          userIds: adminIds,
          title: 'Nueva solicitud de adelanto',
          body: `${employeeName} solicitó un adelanto de ${amountLabel}${type !== 'standard' ? ` (${type})` : ''}.`,
          deepLink: '/admin/salary-advances',
          dedupeKey: `advance-new-${created.id}`,
        }),
      )
      .catch((e) => console.error('[SalaryAdvance] admin notif failed:', e));

    // Email de confirmación al colaborador
    const to = auth.employee.work_email || auth.employee.personal_email;
    if (to) {
      sendSimpleEmail({
        to,
        subject: 'Recibimos tu solicitud de adelanto',
        html: renderEmail({
          title: 'Recibimos tu solicitud de adelanto',
          contextLabel: 'People · Adelantos',
          badge: { tone: 'neutral', label: 'En revisión' },
          intro: `Hola ${auth.employee.first_name ?? ''}, registramos tu solicitud de adelanto. La va a revisar el equipo de People y luego Administración. Te avisamos cuando tengamos novedades.`,
          details: [
            { label: 'Monto', value: amountLabel },
            { label: 'Mes de descuento', value: `${String(discount.month).padStart(2, '0')}/${discount.year}` },
            ...(type !== 'standard' ? [{ label: 'Tipo', value: type === 'emergency' ? 'Emergencia' : 'Excepción' }] : []),
          ],
          cta: { label: 'Ver mis adelantos', url: `${getAppUrl()}/portal/adelantos` },
        }),
      }).catch((e) => console.error('[SalaryAdvance] confirmation email failed:', e));
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (error: any) {
    console.error('Error in POST /api/portal/salary-advances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
