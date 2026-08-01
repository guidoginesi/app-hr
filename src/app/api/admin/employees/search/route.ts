import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/employees/search?q= — typeahead de empleados activos (para filtros/pickers)
export async function GET(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const safe = q.replace(/[,()%_]/g, ' ').trim();
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('employees')
    .select('user_id, first_name, last_name, work_email, personal_email')
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,work_email.ilike.%${safe}%`)
    .order('first_name')
    .limit(10);

  const items = (data ?? []).map((e: any) => ({
    user_id: e.user_id as string,
    name: `${e.first_name} ${e.last_name}`.trim(),
    email: (e.work_email || e.personal_email || '') as string,
  }));
  return NextResponse.json({ items });
}
