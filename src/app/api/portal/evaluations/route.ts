import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/evaluations - Get current user's evaluations
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const employeeId = auth.employee.id;

    // Get active period
    const { data: activePeriod } = await supabase
      .from('evaluation_periods')
      .select('*')
      .eq('status', 'open')
      .eq('is_active', true)
      .single();

    if (!activePeriod) {
      return NextResponse.json({
        activePeriod: null,
        selfEvaluation: null,
        leaderEvaluations: [],
        pendingTeamEvaluations: [],
      });
    }

    // Get self-evaluation for current period
    const { data: selfEvaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('period_id', activePeriod.id)
      .eq('employee_id', employeeId)
      .eq('evaluator_id', employeeId)
      .eq('type', 'self')
      .single();

    // Get leader evaluations where this user is the evaluator
    const { data: leaderEvaluations } = await supabase
      .from('evaluations')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .eq('period_id', activePeriod.id)
      .eq('evaluator_id', employeeId)
      .eq('type', 'leader');

    // If user is a leader, get team members who need evaluation
    let pendingTeamEvaluations: any[] = [];
    if (auth.isLeader) {
      // Get direct reports
      const { data: directReports } = await supabase
        .from('employees')
        .select('id, first_name, last_name, job_title')
        .eq('manager_id', employeeId)
        .eq('status', 'active');

      if (directReports && directReports.length > 0) {
        const evaluatedIds = (leaderEvaluations || []).map(e => e.employee_id);
        pendingTeamEvaluations = directReports.filter(dr => !evaluatedIds.includes(dr.id));
      }
    }

    return NextResponse.json({
      activePeriod,
      selfEvaluation,
      leaderEvaluations: leaderEvaluations || [],
      pendingTeamEvaluations,
      isLeader: auth.isLeader,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/evaluations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/evaluations - Start a new evaluation
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, employee_id } = body;

    if (!type || (type !== 'self' && type !== 'leader')) {
      return NextResponse.json({ error: 'Tipo de evaluación inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const evaluatorId = auth.employee.id;

    // Get active period
    const { data: activePeriod } = await supabase
      .from('evaluation_periods')
      .select('*')
      .eq('status', 'open')
      .eq('is_active', true)
      .single();

    if (!activePeriod) {
      return NextResponse.json({ error: 'No hay período de evaluación activo' }, { status: 400 });
    }

    // Validate permissions
    if (type === 'self') {
      if (!activePeriod.self_evaluation_enabled) {
        return NextResponse.json({ error: 'La autoevaluación no está habilitada' }, { status: 400 });
      }
    } else if (type === 'leader') {
      if (!activePeriod.leader_evaluation_enabled) {
        return NextResponse.json({ error: 'La evaluación de líder no está habilitada' }, { status: 400 });
      }
      if (!auth.isLeader) {
        return NextResponse.json({ error: 'No tienes permisos para evaluar' }, { status: 403 });
      }
      // Verify the employee reports to this leader
      const { data: reportee } = await supabase
        .from('employees')
        .select('id')
        .eq('id', employee_id)
        .eq('manager_id', evaluatorId)
        .single();

      if (!reportee) {
        return NextResponse.json({ error: 'El empleado no pertenece a tu equipo' }, { status: 403 });
      }
    }

    const targetEmployeeId = type === 'self' ? evaluatorId : employee_id;

    // Check if evaluation already exists
    const { data: existing } = await supabase
      .from('evaluations')
      .select('id')
      .eq('period_id', activePeriod.id)
      .eq('employee_id', targetEmployeeId)
      .eq('evaluator_id', evaluatorId)
      .eq('type', type)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una evaluación', evaluationId: existing.id }, { status: 400 });
    }

    // Create evaluation
    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .insert({
        period_id: activePeriod.id,
        employee_id: targetEmployeeId,
        evaluator_id: evaluatorId,
        type,
        status: 'draft',
        current_step: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating evaluation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(evaluation, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/evaluations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
