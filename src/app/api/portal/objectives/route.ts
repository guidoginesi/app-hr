import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateObjectiveSchema = z.object({
  employee_id: z.string().refine(
    (val) => val && UUID_REGEX.test(val),
    { message: 'Debes seleccionar un colaborador válido' }
  ),
  year: z.number().int().min(2020).max(2100),
  period_type: z.enum(['annual', 's1', 's2', 'q1', 'q2', 'q3', 'q4']),
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  progress_percentage: z.number().int().min(0).max(100).optional().default(0),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional().default('not_started'),
  // New fields for periodicity and weight
  periodicity: z.enum(['annual', 'semestral', 'trimestral']).optional().default('annual'),
  weight_pct: z.number().int().min(0).max(100).optional().default(50),
  // For sub-objectives
  parent_objective_id: z.string().uuid().optional(),
  sub_objective_number: z.number().int().min(1).max(4).optional(),
});

const MAX_OBJECTIVES_PER_EMPLOYEE = 2;

// GET /api/portal/objectives - List objectives
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const employeeId = searchParams.get('employee_id');

    // Get direct reports if user is a leader
    const { data: directReports } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', auth.employee.id);

    const directReportIds = directReports?.map(e => e.id) || [];
    const isLeader = directReportIds.length > 0;

    // Build query - get MAIN objectives (not sub-objectives) for self OR for direct reports (if leader)
    let query = supabase
      .from('objectives')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .is('parent_objective_id', null)  // Only main objectives
      .order('year', { ascending: false })
      .order('objective_number', { ascending: true });

    // Filter by specific employee if provided (for leaders viewing team member)
    if (employeeId && isLeader && directReportIds.includes(employeeId)) {
      query = query.eq('employee_id', employeeId);
    } else if (employeeId === auth.employee.id) {
      // Viewing own objectives
      query = query.eq('employee_id', auth.employee.id);
    } else if (!employeeId) {
      // Get all relevant objectives (own + team if leader)
      if (isLeader) {
        query = query.in('employee_id', [auth.employee.id, ...directReportIds]);
      } else {
        query = query.eq('employee_id', auth.employee.id);
      }
    } else {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Filter by year if provided
    if (year) {
      query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching objectives:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch sub-objectives for each main objective
    const objectivesWithSubs = await Promise.all(
      (data || []).map(async (obj) => {
        if (obj.periodicity !== 'annual') {
          const { data: subObjectives } = await supabase
            .from('objectives')
            .select('*')
            .eq('parent_objective_id', obj.id)
            .order('sub_objective_number', { ascending: true });
          
          return { ...obj, sub_objectives: subObjectives || [] };
        }
        return { ...obj, sub_objectives: [] };
      })
    );

    // Calculate progress for objectives with sub-objectives
    const objectivesWithProgress = objectivesWithSubs.map((obj) => {
      if (obj.periodicity !== 'annual' && obj.sub_objectives.length > 0) {
        const avgProgress = Math.round(
          obj.sub_objectives.reduce((sum: number, sub: any) => sum + (sub.progress_percentage || 0), 0) / 
          obj.sub_objectives.length
        );
        return { ...obj, calculated_progress: avgProgress };
      }
      return { ...obj, calculated_progress: obj.progress_percentage };
    });

    return NextResponse.json({
      objectives: objectivesWithProgress,
      isLeader,
      directReports: isLeader ? directReportIds : [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/objectives:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/objectives - Create objective
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateObjectiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Verify the target employee is a direct report
    const { data: targetEmployee } = await supabase
      .from('employees')
      .select('id, manager_id')
      .eq('id', parsed.data.employee_id)
      .single();

    if (!targetEmployee || targetEmployee.manager_id !== auth.employee.id) {
      return NextResponse.json(
        { error: 'Solo podés crear objetivos para tus reportes directos' },
        { status: 403 }
      );
    }

    // Check if definition period is open for this year
    const today = new Date().toISOString().split('T')[0];
    const { data: defPeriod } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('year', parsed.data.year)
      .eq('period_type', 'definition')
      .eq('is_active', true)
      .single();

    if (!defPeriod) {
      return NextResponse.json(
        { error: `No hay período de definición configurado para ${parsed.data.year}` },
        { status: 400 }
      );
    }

    if (today < defPeriod.start_date || today > defPeriod.end_date) {
      return NextResponse.json(
        { error: 'El período de definición de objetivos no está abierto actualmente' },
        { status: 400 }
      );
    }

    // Check if this is a sub-objective
    const isSubObjective = !!parsed.data.parent_objective_id;

    if (isSubObjective) {
      // Validate parent objective exists and belongs to the same employee
      const { data: parentObj } = await supabase
        .from('objectives')
        .select('*')
        .eq('id', parsed.data.parent_objective_id)
        .eq('employee_id', parsed.data.employee_id)
        .is('parent_objective_id', null)
        .single();

      if (!parentObj) {
        return NextResponse.json(
          { error: 'Objetivo padre no encontrado' },
          { status: 400 }
        );
      }

      // Validate sub-objective count based on periodicity
      const requiredCount = parentObj.periodicity === 'semestral' ? 2 : parentObj.periodicity === 'trimestral' ? 4 : 0;
      
      const { count: existingSubCount } = await supabase
        .from('objectives')
        .select('id', { count: 'exact' })
        .eq('parent_objective_id', parsed.data.parent_objective_id);

      if ((existingSubCount || 0) >= requiredCount) {
        return NextResponse.json(
          { error: `Este objetivo ya tiene el máximo de sub-objetivos (${requiredCount})` },
          { status: 400 }
        );
      }

      // Create sub-objective
      const { data, error } = await supabase
        .from('objectives')
        .insert({
          employee_id: parsed.data.employee_id,
          year: parsed.data.year,
          period_type: parsed.data.period_type,
          title: parsed.data.title,
          description: parsed.data.description,
          progress_percentage: parsed.data.progress_percentage || 0,
          status: parsed.data.status || 'not_started',
          created_by: auth.employee.id,
          parent_objective_id: parsed.data.parent_objective_id,
          sub_objective_number: parsed.data.sub_objective_number,
          // Sub-objectives don't have their own periodicity/weight
          periodicity: 'annual',
          weight_pct: 0,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating sub-objective:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Main objective creation
    // Check max objectives per employee per year (only main objectives)
    const { count: existingCount } = await supabase
      .from('objectives')
      .select('id', { count: 'exact' })
      .eq('employee_id', parsed.data.employee_id)
      .eq('year', parsed.data.year)
      .is('parent_objective_id', null);

    if ((existingCount || 0) >= MAX_OBJECTIVES_PER_EMPLOYEE) {
      return NextResponse.json(
        { error: `Este colaborador ya tiene ${MAX_OBJECTIVES_PER_EMPLOYEE} objetivos de área para ${parsed.data.year}` },
        { status: 400 }
      );
    }

    // Assign objective number based on existing main objectives
    const objectiveNumber = (existingCount || 0) + 1;

    // Create main objective
    const { data, error } = await supabase
      .from('objectives')
      .insert({
        ...parsed.data,
        created_by: auth.employee.id,
        objective_number: objectiveNumber,
      })
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .single();

    if (error) {
      console.error('Error creating objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/objectives:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
