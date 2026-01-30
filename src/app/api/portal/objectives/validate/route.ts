import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/objectives/validate - Validate employee objectives configuration
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

    // Check authorization - can only validate own or direct reports
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

    // 1. Validate weights sum to 100%
    const { data: weightsValidation } = await supabase
      .rpc('validate_objective_weights', {
        p_employee_id: employeeId,
        p_year: year,
      });

    const weightsResult = weightsValidation?.[0] || {
      is_valid: false,
      total_weight: 0,
      objective_count: 0,
      error_message: 'No se encontraron objetivos',
    };

    // 2. Get main objectives to validate sub-objectives
    const { data: mainObjectives } = await supabase
      .from('objectives')
      .select('id, title, periodicity, objective_number')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .is('parent_objective_id', null)
      .order('objective_number', { ascending: true });

    // 3. Validate sub-objectives for each main objective
    const subObjectivesValidations = await Promise.all(
      (mainObjectives || []).map(async (obj) => {
        const { data: validation } = await supabase
          .rpc('validate_sub_objectives', {
            p_objective_id: obj.id,
          });

        return {
          objective_id: obj.id,
          objective_number: obj.objective_number,
          objective_title: obj.title,
          periodicity: obj.periodicity,
          ...validation?.[0],
        };
      })
    );

    // 4. Determine overall validity
    const allSubObjectivesValid = subObjectivesValidations.every((v) => v.is_valid);
    const isFullyValid = weightsResult.is_valid && allSubObjectivesValid;

    // 5. Collect all errors
    const errors: string[] = [];
    if (!weightsResult.is_valid && weightsResult.error_message) {
      errors.push(weightsResult.error_message);
    }
    subObjectivesValidations.forEach((v) => {
      if (!v.is_valid && v.error_message) {
        errors.push(`Objetivo ${v.objective_number}: ${v.error_message}`);
      }
    });

    return NextResponse.json({
      is_valid: isFullyValid,
      weights_validation: weightsResult,
      sub_objectives_validations: subObjectivesValidations,
      errors,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/objectives/validate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
