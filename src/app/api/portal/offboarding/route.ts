import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { OFFBOARDING_QUESTIONS, validateOffboardingResponses } from '@/config/offboardingQuestions';

// GET /api/portal/offboarding - Get offboarding survey data for the current user
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employee = auth.employee;
    const supabase = getSupabaseServer();

    // Check if employee is terminated and has offboarding enabled
    if (employee.status !== 'terminated') {
      return NextResponse.json({
        enabled: false,
        reason: 'not_terminated',
        message: 'La encuesta de salida solo está disponible para empleados dados de baja',
      });
    }

    // Get fresh employee data to check offboarding_enabled
    const { data: freshEmployee, error: empError } = await supabase
      .from('employees')
      .select('offboarding_enabled, offboarding_completed_at, termination_date, termination_reason')
      .eq('id', employee.id)
      .single();

    if (empError || !freshEmployee) {
      return NextResponse.json({ error: 'Error al obtener datos del empleado' }, { status: 500 });
    }

    if (!freshEmployee.offboarding_enabled) {
      return NextResponse.json({
        enabled: false,
        reason: 'not_enabled',
        message: 'La encuesta de salida no está habilitada para tu cuenta',
      });
    }

    // Get existing offboarding response
    const { data: offboardingResponse, error: offError } = await supabase
      .from('offboarding_responses')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle();

    if (offError) {
      console.error('Error fetching offboarding response:', offError);
    }

    return NextResponse.json({
      enabled: true,
      status: offboardingResponse?.status || 'pending',
      responses: offboardingResponse?.responses || {},
      submitted_at: offboardingResponse?.submitted_at || null,
      questions: OFFBOARDING_QUESTIONS,
      employee: {
        termination_date: freshEmployee.termination_date,
        termination_reason: freshEmployee.termination_reason,
        offboarding_completed_at: freshEmployee.offboarding_completed_at,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/offboarding:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/offboarding - Submit offboarding survey
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employee = auth.employee;
    const supabase = getSupabaseServer();

    // Check if employee is terminated
    if (employee.status !== 'terminated') {
      return NextResponse.json(
        { error: 'Solo los empleados dados de baja pueden enviar esta encuesta' },
        { status: 403 }
      );
    }

    // Get fresh employee data to check offboarding_enabled
    const { data: freshEmployee, error: empError } = await supabase
      .from('employees')
      .select('offboarding_enabled, offboarding_completed_at')
      .eq('id', employee.id)
      .single();

    if (empError || !freshEmployee) {
      return NextResponse.json({ error: 'Error al obtener datos del empleado' }, { status: 500 });
    }

    if (!freshEmployee.offboarding_enabled) {
      return NextResponse.json(
        { error: 'La encuesta de salida no está habilitada para tu cuenta' },
        { status: 403 }
      );
    }

    if (freshEmployee.offboarding_completed_at) {
      return NextResponse.json(
        { error: 'Ya has completado la encuesta de salida' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const responses = body.responses;

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json(
        { error: 'Las respuestas son requeridas' },
        { status: 400 }
      );
    }

    // Validate responses
    const validation = validateOffboardingResponses(responses);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join('. ') },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update or insert offboarding response
    const { data: offboardingResponse, error: upsertError } = await supabase
      .from('offboarding_responses')
      .upsert(
        {
          employee_id: employee.id,
          status: 'submitted',
          responses,
          submitted_at: now,
        },
        { onConflict: 'employee_id' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Error saving offboarding response:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Update employee offboarding_completed_at
    const { error: updateError } = await supabase
      .from('employees')
      .update({ offboarding_completed_at: now })
      .eq('id', employee.id);

    if (updateError) {
      console.error('Error updating employee offboarding_completed_at:', updateError);
      // Don't fail the whole operation
    }

    return NextResponse.json({
      ok: true,
      offboarding: offboardingResponse,
    });
  } catch (error: any) {
    console.error('Error in POST /api/portal/offboarding:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
