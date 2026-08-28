import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl, getReplyTo } from '@/lib/email/layout';
import { actorDisplayName, logEvent, resolveActor } from '@/lib/reimbursementAccess';
import {
  STATUS_LABELS_EMPLOYEE,
  TRANSITIONS,
  canDo,
  money,
  resolvePaymentPeriod,
  todayInArgentina,
  type ReimbursementAction,
} from '@/lib/reimbursements';
import type { ReimbursementStatus } from '@/types/reimbursement';

export const dynamic = 'force-dynamic';

/**
 * Un solo endpoint para todas las transiciones, compartido por el líder, People y
 * Administración. La ruta NO decide permisos: los decide canDo() sobre la tabla
 * TRANSITIONS de src/lib/reimbursements.ts, para que las tres pantallas no puedan
 * discrepar sobre quién puede hacer qué.
 */
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve_leader'), comment: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(3, 'El motivo es obligatorio.').max(500) }),
  z.object({
    action: z.literal('validate_admin'),
    fiscal_receipt_ok: z.literal(true, { message: 'Hay que confirmar que el comprobante fiscal está bien.' }),
    imputation_ok: z.literal(true, { message: 'Hay que confirmar la imputación contable.' }),
    approved_amount: z.number().positive().optional().nullable(),
    fx_rate: z.number().positive('El tipo de cambio tiene que ser mayor a 0.').optional().nullable(),
    comment: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('schedule_payment'),
    payment_method: z.enum(['payroll', 'transfer']),
  }),
  z.object({ action: z.literal('mark_paid') }),
  z.object({ action: z.literal('cancel') }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const body = parsed.data;
    const action = body.action as ReimbursementAction;

    const supabase = getSupabaseServer();
    const { data: r, error: readError } = await supabase
      .from('expense_reimbursements_with_details')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (readError || !r) return NextResponse.json({ error: 'Reintegro no encontrado' }, { status: 404 });

    const actor = await resolveActor({
      reimbursementId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      isAdministracion: auth.isAdministracion,
      viewerEmployeeId: auth.employee?.id ?? null,
    });
    if (actor.role === 'none') return NextResponse.json({ error: 'No tenés acceso a este reintegro.' }, { status: 403 });

    const from = r.status as ReimbursementStatus;

    /**
     * Cancelar es del dueño, no de un rol.
     *
     * `resolveActor` colapsa a cada persona en UN solo rol, y a quien además es
     * admin le devuelve 'admin' antes de mirar si es el dueño del reintegro. Como
     * cancelar sólo lo permite 'employee', quien carga un gasto y encima es admin
     * o Administración no podía dar de baja el suyo — le decía "no tenés permiso"
     * sobre algo que acababa de cargar.
     *
     * El estado lo sigue mandando TRANSITIONS: sólo antes de que Administración
     * valide, porque después ya está imputado a un período de pago.
     */
    const esElDueno =
      actor.viewerEmployeeId !== null && actor.viewerEmployeeId === actor.ownerEmployeeId;
    const puedeCancelarLoSuyo =
      action === 'cancel' && esElDueno && TRANSITIONS.cancel.from.includes(from);

    if (!canDo(action, from, actor.role) && !puedeCancelarLoSuyo) {
      const t = TRANSITIONS[action];
      return NextResponse.json(
        {
          error: t.from.includes(from)
            ? 'No tenés permiso para hacer esta acción.'
            : `No se puede hacer esto con el reintegro en estado "${STATUS_LABELS_EMPLOYEE[from]}".`,
        },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    const actorName = await actorDisplayName(auth.user.id, auth.user.email);
    const update: Record<string, unknown> = { status: TRANSITIONS[action].to, updated_at: now };
    let note: string | null = null;

    if (body.action === 'approve_leader') {
      update.leader_approved_by = auth.user.id;
      update.leader_approved_at = now;
      update.leader_comment = body.comment || null;
      note = body.comment || null;
    }

    if (body.action === 'reject') {
      update.rejected_by = auth.user.id;
      update.rejected_at = now;
      update.rejection_reason = body.reason;
      note = body.reason;
    }

    if (body.action === 'validate_admin') {
      const monto = body.approved_amount ?? Number(r.amount);
      if (monto > Number(r.amount)) {
        return NextResponse.json(
          { error: 'El monto validado no puede ser mayor al que se pidió.' },
          { status: 400 },
        );
      }
      // Un monto menor cambia lo que la persona va a recibir: se exige explicarlo.
      if (body.approved_amount && body.approved_amount < Number(r.amount) && !body.comment) {
        return NextResponse.json(
          { error: 'Si validás por un monto menor, explicá el motivo.' },
          { status: 400 },
        );
      }
      if (r.currency === 'USD' && !body.fx_rate) {
        return NextResponse.json({ error: 'Cargá el tipo de cambio para convertir el gasto en USD.' }, { status: 400 });
      }

      update.admin_validated_by = auth.user.id;
      update.admin_validated_at = now;
      update.admin_comment = body.comment || null;
      update.fiscal_receipt_ok = true;
      update.imputation_ok = true;
      update.approved_amount = body.approved_amount ?? null;
      // La conversión se hace UNA sola vez, acá. Los reportes suman amount_ars y
      // así consolidan monedas sin volver a convertir con otro TC.
      update.amount_ars = r.currency === 'USD' ? monto * Number(body.fx_rate) : monto;
      update.fx_rate = r.currency === 'USD' ? body.fx_rate : null;
      update.fx_at = r.currency === 'USD' ? now : null;
      note = body.comment || null;
    }

    if (body.action === 'schedule_payment') {
      // El período se calcula y se PERSISTE: si se recalculara al leer, la fecha
      // que vio el solicitante cambiaría sola al pasar el día de corte.
      const periodo = resolvePaymentPeriod(todayInArgentina());
      update.payment_method = body.payment_method;
      update.pay_year = periodo.pay_year;
      update.pay_month = periodo.pay_month;
      update.estimated_payment_date = periodo.estimated_payment_date;
      note = `Pago por ${body.payment_method === 'payroll' ? 'liquidación' : 'transferencia'}, estimado ${periodo.estimated_payment_date}`;
    }

    if (body.action === 'mark_paid') {
      // El comprobante de pago se sube por su propio endpoint, antes de esto.
      if (!r.payment_receipt_path) {
        return NextResponse.json(
          { error: 'Subí el comprobante de pago antes de marcarlo como pagado.' },
          { status: 400 },
        );
      }
      update.paid_by = auth.user.id;
      update.paid_at = now;
    }

    if (body.action === 'cancel') {
      update.cancelled_by = auth.user.id;
      update.cancelled_at = now;
    }

    const { error: updateError } = await supabase.from('expense_reimbursements').update(update).eq('id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await logEvent({
      reimbursementId: id,
      eventType: action,
      fromStatus: from,
      toStatus: TRANSITIONS[action].to,
      actorUserId: auth.user.id,
      actorName,
      note,
    });

    await notifyTransition({
      action,
      to: TRANSITIONS[action].to,
      reimbursement: r,
      actorName,
      note,
      approvedAmount: (update.approved_amount as number | null) ?? null,
    });

    return NextResponse.json({ success: true, status: TRANSITIONS[action].to });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[reintegros] acción:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Avisos por transición. El colaborador se entera de todo lo que le pasa a su
 * reintegro; Administración se entera cuando le toca actuar.
 */
async function notifyTransition(input: {
  action: ReimbursementAction;
  to: ReimbursementStatus;
  reimbursement: Record<string, unknown>;
  actorName: string;
  note: string | null;
  approvedAmount: number | null;
}) {
  const r = input.reimbursement;
  const url = `${getAppUrl()}/portal/reintegros`;
  const importe = money(Number(r.amount), String(r.currency));
  const motivo = String(r.reason_label_snapshot ?? r.reason_name ?? '—');

  const paraElColaborador: Record<string, { title: string; intro: string }> = {
    approve_leader: {
      title: 'Tu líder aprobó el reintegro',
      intro: `${input.actorName} aprobó tu reintegro de ${importe}. Ahora lo valida Administración.`,
    },
    validate_admin: {
      title: 'Administración validó tu reintegro',
      intro: input.approvedAmount
        ? `Se validó por ${money(input.approvedAmount, String(r.currency))} en lugar de ${importe}.`
        : `Se validó tu reintegro de ${importe}. Falta agendar el pago.`,
    },
    schedule_payment: {
      title: 'Tu reintegro tiene fecha de pago',
      intro: `Tu reintegro de ${importe} quedó agendado para pagarse.`,
    },
    mark_paid: { title: 'Tu reintegro fue pagado', intro: `Se pagó tu reintegro de ${importe}.` },
    reject: { title: 'Tu reintegro fue rechazado', intro: `${input.actorName} rechazó tu reintegro de ${importe}.` },
  };

  const msg = paraElColaborador[input.action];
  if (!msg) return;

  const tasks: Promise<unknown>[] = [];

  if (r.employee_user_id) {
    tasks.push(
      createSystemNotification({
        userIds: [String(r.employee_user_id)],
        title: msg.title,
        body: msg.intro,
        deepLink: '/portal/reintegros',
        // Con el estado en la clave, cada paso avisa una vez y no se pisan entre sí.
        dedupeKey: `reintegro-${r.id}-${input.to}`,
      }),
    );
  }

  if (r.employee_email) {
    tasks.push(
      sendSimpleEmail({
        to: String(r.employee_email),
        subject: `${msg.title}: ${String(r.concept)}`,
        replyTo: getReplyTo(),
        html: renderEmail({
          title: msg.title,
          contextLabel: 'People · Reintegros',
          intro: msg.intro,
          details: [
            { label: 'Concepto', value: String(r.concept) },
            { label: 'Motivo', value: motivo },
            { label: 'Monto solicitado', value: importe },
            ...(r.estimated_payment_date
              ? [{ label: 'Pago estimado', value: String(r.estimated_payment_date) }]
              : []),
          ],
          cta: { label: 'Ver mis reintegros', url },
          outro: input.note ? `Comentario: ${input.note}` : undefined,
        }),
      }),
    );
  }

  await Promise.allSettled(tasks);
}
