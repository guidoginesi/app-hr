import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ memberId: string }> };

const RecategorizationSchema = z.object({
  evaluation_id: z.string().uuid(),
  level_recategorization: z.enum(['approved', 'not_approved']),
  position_recategorization: z.enum(['approved', 'not_approved']),
  recommended_level: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/portal/team/[memberId]/recategorization - Get recategorization data for a team member
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireLeader();
    if (!auth || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memberId } = await context.params;
    const supabase = getSupabaseServer();

    // Verify this is a direct report
    const { data: member, error: memberError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, manager_id, seniority_level')
      .eq('id', memberId)
      .eq('manager_id', auth.employee.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Empleado no encontrado o no es tu reporte directo' }, { status: 404 });
    }

    // Get the most recent evaluation period
    const { data: periods } = await supabase
      .from('evaluation_periods')
      .select('*')
      .eq('status', 'open')
      .order('year', { ascending: false })
      .limit(1);

    const currentPeriod = periods?.[0];

    if (!currentPeriod) {
      return NextResponse.json({ 
        canRecategorize: false,
        reason: 'No hay período de evaluación activo',
        member,
        evaluation: null,
        objectives: null,
        recategorization: null,
      });
    }

    // Get the leader evaluation for this employee and period
    const { data: leaderEvaluation } = await supabase
      .from('evaluations')
      .select(`
        *,
        recategorization:evaluation_recategorization(*)
      `)
      .eq('period_id', currentPeriod.id)
      .eq('employee_id', memberId)
      .eq('type', 'leader')
      .eq('status', 'submitted')
      .single();

    if (!leaderEvaluation) {
      return NextResponse.json({ 
        canRecategorize: false,
        reason: 'La evaluación del líder no está completa',
        member,
        period: currentPeriod,
        evaluation: null,
        objectives: null,
        recategorization: null,
      });
    }

    // Get objectives for this employee (all, to calculate effective completion)
    const { data: allObjectives } = await supabase
      .from('objectives')
      .select('*')
      .eq('employee_id', memberId)
      .eq('year', currentPeriod.year);

    // Only main objectives (parent_objective_id IS NULL) determine if evaluation is complete
    const mainObjectives = (allObjectives || []).filter(o => o.parent_objective_id === null);
    const subObjectivesByParent = (allObjectives || [])
      .filter(o => o.parent_objective_id !== null)
      .reduce((acc: Record<string, any[]>, sub) => {
        if (!acc[sub.parent_objective_id]) acc[sub.parent_objective_id] = [];
        acc[sub.parent_objective_id].push(sub);
        return acc;
      }, {});

    // An objective is "evaluated" if:
    // - annual: has achievement_percentage set directly
    // - semestral/trimestral: all its sub-objectives have achievement_percentage set
    const isObjectiveEvaluated = (obj: any): boolean => {
      const subs = subObjectivesByParent[obj.id] || [];
      if (obj.periodicity !== 'annual' && subs.length > 0) {
        return subs.every((s: any) => s.achievement_percentage !== null);
      }
      return obj.achievement_percentage !== null;
    };

    // Effective achievement for a main objective
    const effectiveAchievement = (obj: any): number => {
      const subs = subObjectivesByParent[obj.id] || [];
      if (obj.periodicity !== 'annual' && subs.length > 0) {
        return Math.round(subs.reduce((s: number, sub: any) => s + (sub.achievement_percentage || 0), 0) / subs.length);
      }
      return obj.achievement_percentage || 0;
    };

    // Calculate objectives completion percentage (based on main objectives only)
    let objectivesCompletion = 0;
    if (mainObjectives.length > 0) {
      const totalAchievement = mainObjectives.reduce((sum, obj) => sum + effectiveAchievement(obj), 0);
      objectivesCompletion = Math.round(totalAchievement / mainObjectives.length);
    }

    // Check if all main objectives have been evaluated
    const evaluatedCount = mainObjectives.filter(isObjectiveEvaluated).length;
    const objectivesEvaluated = mainObjectives.length > 0 && evaluatedCount === mainObjectives.length;

    // Use the legacy `objectives` variable shape for backward compat in the response
    const objectives = allObjectives;

    // Get existing recategorization
    const recategorization = leaderEvaluation.recategorization?.[0] || null;

    // Calculate eligibility based on rules
    const leaderScore = leaderEvaluation.total_score || 0;
    
    const eligibleWithinLevel = leaderScore > 8 && objectivesCompletion >= 75;
    const eligibleLevelChange = leaderScore > 9 && objectivesCompletion >= 90;

    const canRecategorize = leaderEvaluation && objectivesEvaluated;

    return NextResponse.json({
      canRecategorize,
      reason: !objectivesEvaluated ? 'Faltan evaluar objetivos' : null,
      member,
      period: currentPeriod,
      evaluation: {
        id: leaderEvaluation.id,
        total_score: leaderEvaluation.total_score,
        submitted_at: leaderEvaluation.submitted_at,
      },
      objectives: {
        total: mainObjectives.length,
        evaluated: evaluatedCount,
        completion: objectivesCompletion,
      },
      eligibility: {
        withinLevel: eligibleWithinLevel,
        levelChange: eligibleLevelChange,
        leaderScore,
        objectivesCompletion,
      },
      recategorization,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/team/[memberId]/recategorization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/team/[memberId]/recategorization - Save recategorization decision
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireLeader();
    if (!auth || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memberId } = await context.params;
    const body = await req.json();
    const supabase = getSupabaseServer();

    // Validate body
    const parsed = RecategorizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 });
    }

    const { evaluation_id, level_recategorization, position_recategorization, recommended_level, notes } = parsed.data;

    // Verify this is a direct report
    const { data: member } = await supabase
      .from('employees')
      .select('id, manager_id')
      .eq('id', memberId)
      .eq('manager_id', auth.employee.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Empleado no encontrado o no es tu reporte directo' }, { status: 404 });
    }

    // Verify the evaluation belongs to this employee
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('id, employee_id, type, status, total_score')
      .eq('id', evaluation_id)
      .eq('employee_id', memberId)
      .eq('type', 'leader')
      .eq('status', 'submitted')
      .single();

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluación no encontrada o no completada' }, { status: 404 });
    }

    // Upsert recategorization
    const { data: updated, error } = await supabase
      .from('evaluation_recategorization')
      .upsert({
        evaluation_id,
        level_recategorization,
        position_recategorization,
        recommended_level,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'evaluation_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving recategorization:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in POST /api/portal/team/[memberId]/recategorization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
