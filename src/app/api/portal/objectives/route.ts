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
  period_type: z.enum(['annual', 'q1', 'q2', 'q3', 'q4']),
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  progress_percentage: z.number().int().min(0).max(100).optional().default(0),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional().default('not_started'),
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

    // Build query - get objectives for self OR for direct reports (if leader)
    let query = supabase
      .from('objectives')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .order('year', { ascending: false })
      .order('period_type', { ascending: true });

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

    return NextResponse.json({
      objectives: data || [],
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

    // Check max objectives per employee per year
    const { count: existingCount } = await supabase
      .from('objectives')
      .select('id', { count: 'exact' })
      .eq('employee_id', parsed.data.employee_id)
      .eq('year', parsed.data.year);

    if ((existingCount || 0) >= MAX_OBJECTIVES_PER_EMPLOYEE) {
      return NextResponse.json(
        { error: `Este colaborador ya tiene ${MAX_OBJECTIVES_PER_EMPLOYEE} objetivos de área para ${parsed.data.year}` },
        { status: 400 }
      );
    }

    // Assign objective number based on existing objectives
    const objectiveNumber = (existingCount || 0) + 1;

    // Create objective
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
