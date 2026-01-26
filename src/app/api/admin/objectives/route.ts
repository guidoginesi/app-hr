import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/objectives - Dashboard data (employees + objectives status)
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const departmentId = searchParams.get('department_id');
    const seniorityLevel = searchParams.get('seniority_level');
    const status = searchParams.get('status'); // 'all' | 'complete' | 'partial' | 'none'

    // Get corporate objectives for the year
    const { data: corporateObjectives } = await supabase
      .from('corporate_objectives')
      .select('*')
      .eq('year', year);

    const hasCorporateObjectives = (corporateObjectives?.length || 0) >= 2;

    // Get all active employees with their objectives
    let employeeQuery = supabase
      .from('employees')
      .select(`
        id,
        first_name,
        last_name,
        seniority_level,
        department:departments(id, name),
        objectives!objectives_employee_id_fkey(
          id,
          year,
          progress_percentage,
          status
        )
      `)
      .eq('status', 'active')
      .order('last_name', { ascending: true });

    if (departmentId) {
      employeeQuery = employeeQuery.eq('department_id', departmentId);
    }

    if (seniorityLevel) {
      employeeQuery = employeeQuery.eq('seniority_level', parseInt(seniorityLevel));
    }

    const { data: employees, error: employeesError } = await employeeQuery;

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return NextResponse.json({ error: employeesError.message }, { status: 500 });
    }

    // Process employees data
    const processedEmployees = (employees || []).map((emp: any) => {
      const yearObjectives = (emp.objectives || []).filter((obj: any) => obj.year === year);
      const areaObjectivesCount = yearObjectives.length;
      const corporateObjectivesCount = hasCorporateObjectives ? 2 : 0;
      const totalObjectives = areaObjectivesCount + corporateObjectivesCount;
      
      // Calculate progress
      let totalProgress: number | null = null;
      if (totalObjectives > 0 && areaObjectivesCount > 0) {
        const areaProgress = yearObjectives.reduce((sum: number, obj: any) => sum + (obj.progress_percentage || 0), 0);
        totalProgress = Math.round(areaProgress / areaObjectivesCount);
      }

      return {
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        department_name: emp.department?.name || null,
        seniority_level: emp.seniority_level,
        corporate_objectives_count: corporateObjectivesCount,
        area_objectives_count: areaObjectivesCount,
        total_progress: totalProgress,
        has_all_objectives: areaObjectivesCount >= 2 && hasCorporateObjectives,
      };
    });

    // Filter by status
    let filteredEmployees = processedEmployees;
    if (status === 'complete') {
      filteredEmployees = processedEmployees.filter((e: any) => e.has_all_objectives);
    } else if (status === 'partial') {
      filteredEmployees = processedEmployees.filter((e: any) => 
        !e.has_all_objectives && (e.area_objectives_count > 0 || e.corporate_objectives_count > 0)
      );
    } else if (status === 'none') {
      filteredEmployees = processedEmployees.filter((e: any) => 
        e.area_objectives_count === 0 && e.corporate_objectives_count === 0
      );
    }

    // Calculate stats
    const stats = {
      total_employees: processedEmployees.length,
      with_complete_objectives: processedEmployees.filter((e: any) => e.has_all_objectives).length,
      with_partial_objectives: processedEmployees.filter((e: any) => 
        !e.has_all_objectives && (e.area_objectives_count > 0 || e.corporate_objectives_count > 0)
      ).length,
      without_objectives: processedEmployees.filter((e: any) => 
        e.area_objectives_count === 0 && !hasCorporateObjectives
      ).length,
      corporate_objectives_configured: hasCorporateObjectives,
    };

    // Get departments for filter
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    return NextResponse.json({
      employees: filteredEmployees,
      stats,
      departments: departments || [],
      corporate_objectives: corporateObjectives || [],
      year,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
