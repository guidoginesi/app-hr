import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/objectives/score - Get employee objectives score
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id') || auth.employee.id;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Check authorization - can only view own score or direct reports
    if (employeeId !== auth.employee.id) {
      const { data: directReport } = await supabase
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .eq('manager_id', auth.employee.id)
        .single();

      if (!directReport) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    }

    // Call the database function to calculate score
    const { data, error } = await supabase
      .rpc('calculate_employee_objectives_score', {
        p_employee_id: employeeId,
        p_year: year,
      });

    if (error) {
      console.error('Error calculating score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.[0] || {
      objective_1_title: null,
      objective_1_weight: 0,
      objective_1_progress: 0,
      objective_1_periodicity: null,
      objective_2_title: null,
      objective_2_weight: 0,
      objective_2_progress: 0,
      objective_2_periodicity: null,
      final_score: 0,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/objectives/score:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
