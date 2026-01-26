import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const AchievementSchema = z.object({
  achievement_percentage: z.number().int().min(0).max(200),
  achievement_notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/portal/objectives/[id]/achievement - Set achievement for objective
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = AchievementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().split('T')[0];

    // Get the objective to check permissions
    const { data: objective } = await supabase
      .from('objectives')
      .select('id, employee_id, created_by, year, is_locked')
      .eq('id', id)
      .single();

    if (!objective) {
      return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
    }

    // Only the creator (leader) can evaluate
    if (objective.created_by !== auth.employee.id) {
      return NextResponse.json(
        { error: 'Solo el líder que creó el objetivo puede evaluarlo' },
        { status: 403 }
      );
    }

    // Check if objective is locked
    if (objective.is_locked) {
      return NextResponse.json(
        { error: 'Este objetivo está bloqueado y no puede ser evaluado' },
        { status: 400 }
      );
    }

    // Check if evaluation period is open for this year
    const { data: evalPeriod } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('year', objective.year)
      .eq('period_type', 'evaluation')
      .eq('is_active', true)
      .single();

    if (!evalPeriod) {
      return NextResponse.json(
        { error: `No hay período de evaluación configurado para ${objective.year}` },
        { status: 400 }
      );
    }

    if (today < evalPeriod.start_date || today > evalPeriod.end_date) {
      return NextResponse.json(
        { error: 'El período de evaluación no está abierto actualmente' },
        { status: 400 }
      );
    }

    // Update the objective with achievement data
    const { data, error } = await supabase
      .from('objectives')
      .update({
        achievement_percentage: parsed.data.achievement_percentage,
        achievement_notes: parsed.data.achievement_notes || null,
        evaluated_at: new Date().toISOString(),
        evaluated_by: auth.employee.id,
        // Also update status to completed if achievement >= 100%
        status: parsed.data.achievement_percentage >= 100 ? 'completed' : 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .single();

    if (error) {
      console.error('Error updating achievement:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/objectives/[id]/achievement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
