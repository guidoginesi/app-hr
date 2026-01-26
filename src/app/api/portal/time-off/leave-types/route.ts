import { NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/time-off/leave-types - Get available leave types
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching leave types:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter study leave if employee is not studying
    const filteredData = data?.filter((type) => {
      if (type.code === 'study' && !auth.employee?.is_studying) {
        return false;
      }
      return true;
    });

    return NextResponse.json(filteredData);
  } catch (error: any) {
    console.error('Error in GET /api/portal/time-off/leave-types:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
