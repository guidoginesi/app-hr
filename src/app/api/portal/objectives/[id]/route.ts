import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateObjectiveSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  period_type: z.enum(['annual', 'q1', 'q2', 'q3', 'q4']).optional(),
  title: z.string().min(1).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  progress_percentage: z.number().int().min(0).max(100).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portal/objectives/[id] - Get single objective
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('objectives')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify access - must be the employee or their manager
    const { data: directReports } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', auth.employee.id);

    const directReportIds = directReports?.map(e => e.id) || [];
    const canAccess = data.employee_id === auth.employee.id || directReportIds.includes(data.employee_id);

    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/portal/objectives/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/portal/objectives/[id] - Update objective
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateObjectiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check if objective exists and user is the creator
    const { data: existing } = await supabase
      .from('objectives')
      .select('id, created_by, year, is_locked')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
    }

    if (existing.created_by !== auth.employee.id) {
      return NextResponse.json(
        { error: 'Solo podés editar objetivos que hayas creado' },
        { status: 403 }
      );
    }

    if (existing.is_locked) {
      return NextResponse.json(
        { error: 'Este objetivo está bloqueado y no puede ser editado' },
        { status: 400 }
      );
    }

    // Check if definition period is open for this year
    const today = new Date().toISOString().split('T')[0];
    const { data: defPeriod } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('year', existing.year)
      .eq('period_type', 'definition')
      .eq('is_active', true)
      .single();

    if (!defPeriod || today < defPeriod.start_date || today > defPeriod.end_date) {
      return NextResponse.json(
        { error: 'El período de definición de objetivos no está abierto actualmente' },
        { status: 400 }
      );
    }

    // Update objective
    const { data, error } = await supabase
      .from('objectives')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .single();

    if (error) {
      console.error('Error updating objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/objectives/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/portal/objectives/[id] - Delete objective
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Check if objective exists and user is the creator
    const { data: existing } = await supabase
      .from('objectives')
      .select('id, created_by, year, is_locked')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
    }

    if (existing.created_by !== auth.employee.id) {
      return NextResponse.json(
        { error: 'Solo podés eliminar objetivos que hayas creado' },
        { status: 403 }
      );
    }

    if (existing.is_locked) {
      return NextResponse.json(
        { error: 'Este objetivo está bloqueado y no puede ser eliminado' },
        { status: 400 }
      );
    }

    // Check if definition period is open for this year
    const today = new Date().toISOString().split('T')[0];
    const { data: defPeriod } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('year', existing.year)
      .eq('period_type', 'definition')
      .eq('is_active', true)
      .single();

    if (!defPeriod || today < defPeriod.start_date || today > defPeriod.end_date) {
      return NextResponse.json(
        { error: 'El período de definición de objetivos no está abierto actualmente' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('objectives')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/portal/objectives/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
