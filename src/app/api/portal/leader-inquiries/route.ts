import { NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/portal/leader-inquiries
 * Consultas que People compartió explícitamente con este líder.
 * NUNCA se resuelve por manager_id: solo por permisos otorgados uno a uno.
 */
export async function GET() {
  const auth = await getAuthResult();
  if (!auth.user || !auth.employee) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = getSupabaseServer();
  const { data: shares } = await supabase
    .from('inquiry_leader_shares')
    .select('inquiry_id')
    .eq('leader_user_id', auth.user.id)
    .is('revoked_at', null);

  const ids = (shares ?? []).map((s: any) => s.inquiry_id);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const { data, error } = await supabase
    .from('inquiries_with_details')
    .select('id, employee_name, category, subject, status, created_at, last_activity_at')
    .in('id', ids)
    .order('last_activity_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
