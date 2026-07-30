import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl, type BadgeTone } from '@/lib/email/layout';
import type { SalaryAdvanceStatus } from '@/types/salaryAdvance';

type RouteContext = { params: Promise<{ id: string }> };

type Action = 'approve_hr' | 'approve_admin' | 'transfer' | 'settle' | 'reject' | 'block';

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

// PATCH /api/admin/salary-advances/[id]  { action, note?, rejection_reason?, no_resignation_confirmed? }
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const note: string | null = body?.note?.trim?.() || null;
    const rejectionReason: string | null = body?.rejection_reason?.trim?.() || null;

    const supabase = getSupabaseServer();
    const { data: adv, error: fetchErr } = await supabase
      .from('salary_advances_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !adv) {
      return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 });
    }

    const from = adv.status as SalaryAdvanceStatus;
    const nowIso = new Date().toISOString();
    let update: Record<string, unknown> = { updated_at: nowIso };
    let to: SalaryAdvanceStatus;
    // Email al colaborador (opcional según acción)
    let email: { subject: string; title: string; badge: BadgeTone; intro: string } | null = null;

    switch (action) {
      case 'approve_hr': {
        if (from !== 'pending_hr') return NextResponse.json({ error: 'La solicitud no está pendiente de RRHH.' }, { status: 400 });
        if (body?.no_resignation_confirmed !== true) {
          return NextResponse.json({ error: 'Confirmá que el colaborador no tiene una renuncia comunicada.' }, { status: 400 });
        }
        to = 'pending_admin';
        update = { ...update, status: to, hr_approved_by: user.id, hr_approved_at: nowIso, hr_note: note, no_resignation_confirmed: true };
        break;
      }
      case 'approve_admin': {
        if (from !== 'pending_admin') return NextResponse.json({ error: 'La solicitud no está pendiente de Administración.' }, { status: 400 });
        to = 'approved';
        update = { ...update, status: to, admin_approved_by: user.id, admin_approved_at: nowIso, admin_note: note };
        email = { subject: 'Tu adelanto fue aprobado', title: 'Tu adelanto fue aprobado', badge: 'success', intro: `Hola ${adv.employee_name}, tu solicitud de adelanto por ${ars(adv.amount)} fue aprobada. Administración va a coordinar la transferencia dentro de los 5 días hábiles.` };
        break;
      }
      case 'transfer': {
        if (from !== 'approved') return NextResponse.json({ error: 'El adelanto debe estar aprobado para transferir.' }, { status: 400 });
        to = 'transferred';
        update = { ...update, status: to, transferred_by: user.id, transferred_at: nowIso };
        email = { subject: 'Tu adelanto fue transferido', title: 'Tu adelanto fue transferido', badge: 'success', intro: `Hola ${adv.employee_name}, transferimos tu adelanto por ${ars(adv.amount)}. Se descontará en la liquidación de ${String(adv.discount_month).padStart(2, '0')}/${adv.discount_year}.` };
        break;
      }
      case 'settle': {
        if (from !== 'approved' && from !== 'transferred') return NextResponse.json({ error: 'El adelanto no está en un estado saldable.' }, { status: 400 });
        to = 'settled';
        update = { ...update, status: to, settled_at: nowIso, balance_pending: 0 };
        break;
      }
      case 'reject': {
        if (!['pending_hr', 'pending_admin', 'approved'].includes(from)) return NextResponse.json({ error: 'La solicitud no puede rechazarse en su estado actual.' }, { status: 400 });
        if (!rejectionReason) return NextResponse.json({ error: 'Indicá el motivo del rechazo.' }, { status: 400 });
        to = 'rejected';
        update = { ...update, status: to, rejected_by: user.id, rejected_at: nowIso, rejection_reason: rejectionReason };
        email = { subject: 'Tu solicitud de adelanto no fue aprobada', title: 'Tu solicitud de adelanto no fue aprobada', badge: 'danger', intro: `Hola ${adv.employee_name}, tu solicitud de adelanto no pudo aprobarse. Motivo: ${rejectionReason}` };
        break;
      }
      case 'block': {
        if (!['pending_hr', 'pending_admin'].includes(from)) return NextResponse.json({ error: 'La solicitud no puede bloquearse en su estado actual.' }, { status: 400 });
        if (!rejectionReason) return NextResponse.json({ error: 'Indicá el motivo del bloqueo.' }, { status: 400 });
        to = 'blocked';
        update = { ...update, status: to, rejected_by: user.id, rejected_at: nowIso, rejection_reason: rejectionReason };
        email = { subject: 'Tu solicitud de adelanto no fue aprobada', title: 'Tu solicitud de adelanto no fue aprobada', badge: 'danger', intro: `Hola ${adv.employee_name}, tu solicitud de adelanto no puede otorgarse. Motivo: ${rejectionReason}` };
        break;
      }
      default:
        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    const { error: updErr } = await supabase.from('salary_advances').update(update).eq('id', id);
    if (updErr) {
      console.error('Error updating salary advance:', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await supabase.from('salary_advance_events').insert({
      advance_id: id,
      event_type: action,
      from_status: from,
      to_status: to,
      actor_user_id: user.id,
      note: note ?? rejectionReason,
    });

    // Notificación in-app + email al colaborador
    if (adv.employee_user_id) {
      createSystemNotification({
        userIds: [adv.employee_user_id],
        title: email?.title ?? 'Actualización de tu adelanto',
        body: `Tu solicitud de adelanto pasó a "${to}".`,
        deepLink: '/portal/adelantos',
        dedupeKey: `advance-${id}-${to}`,
      }).catch((e) => console.error('[SalaryAdvance] employee notif failed:', e));
    }

    if (email && adv.employee_email) {
      sendSimpleEmail({
        to: adv.employee_email,
        subject: email.subject,
        html: renderEmail({
          title: email.title,
          contextLabel: 'People · Adelantos',
          badge: { tone: email.badge, label: email.badge === 'success' ? 'Aprobado' : 'No aprobado' },
          intro: email.intro,
          details: [
            { label: 'Monto', value: ars(adv.amount) },
            { label: 'Mes de descuento', value: `${String(adv.discount_month).padStart(2, '0')}/${adv.discount_year}` },
          ],
          cta: { label: 'Ver mis adelantos', url: `${getAppUrl()}/portal/adelantos` },
        }),
      }).catch((e) => console.error('[SalaryAdvance] status email failed:', e));
    }

    return NextResponse.json({ success: true, status: to });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/salary-advances/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
