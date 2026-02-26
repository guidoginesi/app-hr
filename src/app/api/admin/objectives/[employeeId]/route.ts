import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { OBJECTIVE_WEIGHT_DISTRIBUTION, getSeniorityCategory } from '@/types/corporate-objectives';

// GET /api/admin/objectives/[employeeId] - Get objectives for a specific employee
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId } = await params;
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select(`
        id,
        first_name,
        last_name,
        seniority_level,
        job_title,
        department:departments(id, name),
        manager_id
      `)
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json({ error: employeeError?.message || 'Employee not found' }, { status: 404 });
    }

    // Get manager name separately to avoid FK hint schema cache issues
    let managerName: string | null = null;
    if (employee.manager_id) {
      const { data: manager } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', employee.manager_id)
        .single();
      if (manager) managerName = `${manager.first_name} ${manager.last_name}`;
    }

    // Get corporate objectives for the year
    const { data: corporateObjectives } = await supabase
      .from('corporate_objectives')
      .select('*')
      .eq('year', year)
      .order('objective_type');

    // Get area objectives for this employee
    const { data: areaObjectives } = await supabase
      .from('objectives')
      .select(`
        *,
        created_by_employee:employees!objectives_created_by_fkey(id, first_name, last_name)
      `)
      .eq('employee_id', employeeId)
      .eq('year', year)
      .order('objective_number', { ascending: true });

    // Calculate weights based on seniority
    const seniorityCategory = getSeniorityCategory(employee.seniority_level as string | null) || 1;
    const weights = OBJECTIVE_WEIGHT_DISTRIBUTION[seniorityCategory];

    // Calculate total progress
    let totalWeightedProgress: number | null = null;
    const billingObjective = corporateObjectives?.find(o => o.objective_type === 'billing');
    const npsObjective = corporateObjectives?.find(o => o.objective_type === 'nps');
    const area1 = areaObjectives?.find(o => o.objective_number === 1);
    const area2 = areaObjectives?.find(o => o.objective_number === 2);

    // Check if billing gate is met
    const billingGateMet = billingObjective && billingObjective.actual_value && billingObjective.target_value
      ? (billingObjective.actual_value / billingObjective.target_value) * 100 >= (billingObjective.gate_percentage || 90)
      : false;

    // Calculate weighted progress
    if (billingObjective || npsObjective || area1 || area2) {
      let weightedSum = 0;
      let totalWeight = 0;

      if (billingObjective && billingObjective.actual_value !== null && billingObjective.target_value) {
        const billingProgress = Math.min(
          (billingObjective.actual_value / billingObjective.target_value) * 100,
          billingObjective.cap_percentage || 150
        );
        weightedSum += billingProgress * weights.billing;
        totalWeight += weights.billing;
      }

      if (npsObjective && npsObjective.actual_value !== null && npsObjective.target_value) {
        const npsProgress = Math.min(
          (npsObjective.actual_value / npsObjective.target_value) * 100,
          100
        );
        weightedSum += npsProgress * weights.nps;
        totalWeight += weights.nps;
      }

      if (area1 && area1.progress_percentage !== null) {
        weightedSum += area1.progress_percentage * weights.area1;
        totalWeight += weights.area1;
      }

      if (area2 && area2.progress_percentage !== null) {
        weightedSum += area2.progress_percentage * weights.area2;
        totalWeight += weights.area2;
      }

      if (totalWeight > 0) {
        totalWeightedProgress = Math.round(weightedSum / totalWeight);
      }
    }

    return NextResponse.json({
      employee: {
        ...employee,
        department_name: (employee.department as any)?.[0]?.name || (employee.department as any)?.name || null,
        manager_name: managerName,
      },
      corporate_objectives: corporateObjectives || [],
      area_objectives: areaObjectives || [],
      weights,
      seniority_level: employee.seniority_level,
      total_weighted_progress: totalWeightedProgress,
      billing_gate_met: billingGateMet,
      year,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives/[employeeId]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
