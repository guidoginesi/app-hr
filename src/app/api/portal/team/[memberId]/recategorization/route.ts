import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ memberId: string }> };

const RecategorizationSchema = z.object({
  evaluation_id: z.string().uuid().optional().nullable(),
  period_id: z.string().uuid().optional().nullable(),
  level_recategorization: z.enum(['approved', 'not_approved']),
  position_recategorization: z.enum(['approved', 'not_approved']),
  recommended_level: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(data => data.evaluation_id || data.period_id, {
  message: 'Se requiere evaluation_id o period_id',
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
        period: null,
        evaluation: null,
        objectives: null,
        recategorization: null,
      });
    }

    // Get the leader evaluation for this employee and period
    const { data: leaderEvaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('period_id', currentPeriod.id)
      .eq('employee_id', memberId)
      .eq('type', 'leader')
      .eq('status', 'submitted')
      .single();

    if (!leaderEvaluation) {
      // No evaluation yet — check for an existing note-only record (evaluation_id IS NULL)
      const { data: existingNote } = await supabase
        .from('evaluation_recategorization')
        .select('*')
        .is('evaluation_id', null)
        .eq('employee_id', memberId)
        .eq('period_id', currentPeriod.id)
        .maybeSingle();

      return NextResponse.json({ 
        canRecategorize: false,
        reason: 'La evaluación del líder no está completa',
        member,
        period: currentPeriod,
        evaluation: null,
        objectives: null,
        recategorization: existingNote || null,
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

    // Get existing recategorization directly (avoids relying on FK join)
    const { data: recategorizationRecord } = await supabase
      .from('evaluation_recategorization')
      .select('*')
      .eq('evaluation_id', leaderEvaluation.id)
      .maybeSingle();

    const recategorization = recategorizationRecord || null;

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

    const { evaluation_id, period_id, level_recategorization, position_recategorization, recommended_level, notes } = parsed.data;

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

    const isNotApplicable =
      level_recategorization === 'not_approved' && position_recategorization === 'not_approved';

    const hrStatus = isNotApplicable ? 'rejected' : 'pending';
    const now = new Date().toISOString();

    // Build base payload — include hr_notes only when clearing it (not-applicable case)
    // to avoid sending unknown columns to a potentially stale PostgREST schema cache.
    const basePayload: Record<string, unknown> = {
      level_recategorization,
      position_recategorization,
      recommended_level,
      notes,
      hr_status: hrStatus,
      updated_at: now,
    };
    if (isNotApplicable) {
      basePayload.hr_notes = null;
    }

    let updated;

    if (evaluation_id) {
      // ── Path A: linked to a submitted leader evaluation ──────────────────────
      const { data: evaluation } = await supabase
        .from('evaluations')
        .select('id, employee_id, type, status, period_id')
        .eq('id', evaluation_id)
        .eq('employee_id', memberId)
        .eq('type', 'leader')
        .eq('status', 'submitted')
        .single();

      if (!evaluation) {
        return NextResponse.json({ error: 'Evaluación no encontrada o no completada' }, { status: 404 });
      }

      // Check for existing record (avoids relying on onConflict / unique constraint)
      const { data: existingA } = await supabase
        .from('evaluation_recategorization')
        .select('id')
        .eq('evaluation_id', evaluation_id)
        .maybeSingle();

      if (existingA) {
        const { data, error } = await supabase
          .from('evaluation_recategorization')
          .update({ ...basePayload, employee_id: memberId, period_id: evaluation.period_id })
          .eq('id', existingA.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating recategorization (with evaluation):', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        updated = data;
      } else {
        const { data, error } = await supabase
          .from('evaluation_recategorization')
          .insert({ ...basePayload, evaluation_id, employee_id: memberId, period_id: evaluation.period_id })
          .select()
          .single();

        if (error) {
          console.error('Error inserting recategorization (with evaluation):', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        updated = data;
      }

    } else {
      // ── Path B: note only — no evaluation yet ────────────────────────────────
      const { data: period } = await supabase
        .from('evaluation_periods')
        .select('id')
        .eq('id', period_id)
        .eq('status', 'open')
        .single();

      if (!period) {
        return NextResponse.json({ error: 'Período de evaluación no encontrado o no activo' }, { status: 404 });
      }

      // Check whether a note-only record already exists for this employee + period
      const { data: existing } = await supabase
        .from('evaluation_recategorization')
        .select('id')
        .is('evaluation_id', null)
        .eq('employee_id', memberId)
        .eq('period_id', period_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('evaluation_recategorization')
          .update(basePayload)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating note-only recategorization:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        updated = data;
      } else {
        const { data, error } = await supabase
          .from('evaluation_recategorization')
          .insert({
            ...basePayload,
            evaluation_id: null,
            employee_id: memberId,
            period_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Error inserting note-only recategorization:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        updated = data;
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in POST /api/portal/team/[memberId]/recategorization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
