import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getAdminUserIds } from '@/lib/notificationService';
import type { TrainingRequestStatus } from '@/types/training';

type RouteContext = { params: Promise<{ id: string }> };

// Se puede cancelar mientras no se haya ejecutado (antes de cualquier pago).
const CANCELLABLE: TrainingRequestStatus[] = ['requested', 'leader_approved', 'hr_approved'];

// PATCH /api/portal/training/[id]  { action: 'cancel' }
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'cancel') return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: r } = await supabase
      .from('training_requests')
      .select('id, employee_id, status, course_name')
      .eq('id', id)
      .single();
    if (!r || r.employee_id !== auth.employee.id) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    if (!CANCELLABLE.includes(r.status as TrainingRequestStatus)) {
      return NextResponse.json({ error: 'No se puede cancelar en el estado actual.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('training_requests')
      .update({ status: 'cancelled', cancelled_at: nowIso, updated_at: nowIso })
      .eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    await supabase.from('training_request_events').insert({
      request_id: id, event_type: 'cancel', from_status: r.status, to_status: 'cancelled', actor_user_id: auth.user.id,
    });

    // Avisar a HR/Adm (libera el comprometido si estaba aprobada)
    getAdminUserIds().then((ids) => createSystemNotification({
      userIds: ids, title: 'Capacitación cancelada', body: `${auth.employee?.first_name ?? ''} canceló "${r.course_name}".`, deepLink: '/admin/training', dedupeKey: `training-cancel-${id}`,
    })).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
