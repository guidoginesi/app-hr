import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getAdminUserIds } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl, type BadgeTone } from '@/lib/email/layout';
import { computeBudget } from '@/lib/training';
import type { TrainingRequestStatus } from '@/types/training';

type RouteContext = { params: Promise<{ id: string }> };
type Action = 'approve_leader' | 'approve_hr' | 'reject';

async function getEffectiveBudget(
  supabase: ReturnType<typeof getSupabaseServer>,
  employeeId: string,
  year: number,
): Promise<number> {
  const { data: ov } = await supabase
    .from('training_budget_overrides')
    .select('amount_usd')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .maybeSingle();
  if (ov) return Number(ov.amount_usd);
  const { data: cfg } = await supabase
    .from('training_budget_config')
    .select('default_amount_usd')
    .eq('year', year)
    .maybeSingle();
  return cfg ? Number(cfg.default_amount_usd) : 500;
}

// PATCH /api/admin/training/[id]  { action, comment?, rejection_reason?, mep? }
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const comment: string | null = body?.comment?.trim?.() || null;
    const rejectionReason: string | null = body?.rejection_reason?.trim?.() || null;
    const mep = body?.mep != null ? Number(body.mep) : null;

    const supabase = getSupabaseServer();
    const { data: r, error: fetchErr } = await supabase
      .from('training_requests_with_details')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !r) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const from = r.status as TrainingRequestStatus;
    const nowIso = new Date().toISOString();
    let update: Record<string, unknown> = { updated_at: nowIso };
    let to: TrainingRequestStatus;
    let email: { subject: string; title: string; badge: BadgeTone; intro: string } | null = null;

    switch (action) {
      case 'approve_leader': {
        if (from !== 'requested') return NextResponse.json({ error: 'La solicitud no está pendiente del líder.' }, { status: 400 });
        to = 'leader_approved';
        update = { ...update, status: to, leader_approved_by: user.id, leader_approved_at: nowIso, leader_comment: comment };
        break;
      }
      case 'approve_hr': {
        if (from !== 'leader_approved') return NextResponse.json({ error: 'La solicitud no está pendiente de HR.' }, { status: 400 });

        // Fijar el USD (para ARS con MEP; para USD el costo es el USD)
        let costUsd: number;
        if (r.currency === 'ARS') {
          if (!mep || mep <= 0) return NextResponse.json({ error: 'Ingresá el MEP para convertir el monto en ARS a USD.' }, { status: 400 });
          costUsd = Math.round((Number(r.cost) / mep) * 100) / 100;
        } else {
          costUsd = Number(r.cost);
        }

        // Validar contra el budget disponible (excluyendo esta solicitud)
        const totalUsd = await getEffectiveBudget(supabase, r.employee_id, r.budget_year);
        const { data: others } = await supabase
          .from('training_requests')
          .select('status, cost_usd')
          .eq('employee_id', r.employee_id)
          .eq('budget_year', r.budget_year)
          .neq('id', id);
        const budget = computeBudget(totalUsd, others ?? []);
        if (costUsd > budget.available_usd) {
          return NextResponse.json({ error: `El monto (USD ${costUsd}) supera el saldo disponible (USD ${budget.available_usd}).` }, { status: 400 });
        }

        to = 'hr_approved';
        update = { ...update, status: to, hr_approved_by: user.id, hr_approved_at: nowIso, hr_comment: comment, cost_usd: costUsd, mep_at_approval: r.currency === 'ARS' ? mep : null };
        email = { subject: 'Tu capacitación fue aprobada', title: 'Tu capacitación fue aprobada', badge: 'success', intro: `Hola ${r.employee_name}, tu solicitud para "${r.course_name}" fue aprobada. Ya podés cargar la factura para el pago del 50% inicial.` };
        break;
      }
      case 'reject': {
        if (!['requested', 'leader_approved'].includes(from)) return NextResponse.json({ error: 'La solicitud no puede rechazarse en su estado actual.' }, { status: 400 });
        if (!rejectionReason) return NextResponse.json({ error: 'La justificación del rechazo es obligatoria.' }, { status: 400 });
        to = 'rejected';
        update = { ...update, status: to, rejected_by: user.id, rejected_at: nowIso, rejection_reason: rejectionReason };
        email = { subject: 'Tu solicitud de capacitación no fue aprobada', title: 'Tu solicitud de capacitación no fue aprobada', badge: 'danger', intro: `Hola ${r.employee_name}, tu solicitud para "${r.course_name}" no fue aprobada. Motivo: ${rejectionReason}` };
        break;
      }
      default:
        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    const { error: updErr } = await supabase.from('training_requests').update(update).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    await supabase.from('training_request_events').insert({
      request_id: id, event_type: action, from_status: from, to_status: to, actor_user_id: user.id, note: comment ?? rejectionReason,
    });

    // Cuando el líder aprueba, avisar a HR (admins) que hay algo para aprobar
    if (action === 'approve_leader') {
      getAdminUserIds().then((ids) => createSystemNotification({
        userIds: ids, title: 'Capacitación pendiente de HR', body: `"${r.course_name}" de ${r.employee_name} espera aprobación de HR.`, deepLink: '/admin/training', dedupeKey: `training-hr-${id}`,
      })).catch(() => {});
    }

    if (r.employee_user_id) {
      createSystemNotification({
        userIds: [r.employee_user_id], title: email?.title ?? 'Actualización de tu capacitación', body: `Tu solicitud "${r.course_name}" pasó a "${to}".`, deepLink: '/portal/capacitaciones', dedupeKey: `training-${id}-${to}`,
      }).catch(() => {});
    }
    if (email && r.employee_email) {
      sendSimpleEmail({
        to: r.employee_email, subject: email.subject,
        html: renderEmail({
          title: email.title, contextLabel: 'People · Capacitaciones',
          badge: { tone: email.badge, label: email.badge === 'success' ? 'Aprobada' : 'No aprobada' },
          intro: email.intro,
          details: [{ label: 'Curso', value: r.course_name }, { label: 'Costo', value: `${r.currency} ${r.cost}` }],
          cta: { label: 'Ver mis capacitaciones', url: `${getAppUrl()}/portal/capacitaciones` },
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, status: to });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
