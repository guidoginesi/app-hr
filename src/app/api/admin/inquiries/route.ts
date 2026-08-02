import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/inquiries?status=&category=&q=&only_open=
// Bandeja única de People.
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const category = sp.get('category');
  const q = (sp.get('q') || '').trim();
  const onlyOpen = sp.get('only_open') === '1';

  let query = supabase
    .from('inquiries_with_details')
    .select(
      'id, employee_id, employee_name, employee_email, category, subject, status, created_at, last_activity_at, first_response_due_at, first_hr_response_at, sla_overdue, is_open, message_count, leader_shares, assigned_to, reopen_count',
    )
    .order('last_activity_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (onlyOpen) query = query.in('status', ['nueva', 'en_curso', 'esperando_colaborador']);
  if (q) {
    const safe = q.replace(/[,()%_]/g, ' ').trim();
    if (safe) query = query.ilike('subject', `%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data ?? [];
  const stats = {
    total: items.length,
    nuevas: items.filter((i: any) => i.status === 'nueva').length,
    abiertas: items.filter((i: any) => i.is_open).length,
    vencidas: items.filter((i: any) => i.sla_overdue).length,
  };

  return NextResponse.json({ items, stats });
}
