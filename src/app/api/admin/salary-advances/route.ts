import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET /api/admin/salary-advances?status=...
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const status = new URL(req.url).searchParams.get('status');

    let query = supabase
      .from('salary_advances_with_details')
      .select('*')
      .order('requested_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching salary advances (admin):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ advances: data ?? [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/salary-advances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
