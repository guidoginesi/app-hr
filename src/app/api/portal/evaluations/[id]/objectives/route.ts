import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const SaveObjectiveSchema = z.object({
  quarter: z.number().int().min(1).max(4),
  objectives_description: z.string().optional().nullable(),
  completion_percentage: z.number().int().min(0).max(100).optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portal/evaluations/[id]/objectives - Save objective (auto-save)
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const supabase = getSupabaseServer();

    // Verify ownership and that it's a leader evaluation
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('id, evaluator_id, status, type')
      .eq('id', id)
      .single();

    if (!evaluation || evaluation.evaluator_id !== auth.employee.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta evaluación' }, { status: 403 });
    }

    if (evaluation.type !== 'leader') {
      return NextResponse.json({ error: 'Los objetivos solo aplican a evaluaciones de líder' }, { status: 400 });
    }

    if (evaluation.status === 'submitted') {
      return NextResponse.json({ error: 'La evaluación ya fue enviada' }, { status: 400 });
    }

    const parsed = SaveObjectiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const { quarter, objectives_description, completion_percentage } = parsed.data;

    const { data, error } = await supabase
      .from('evaluation_objectives')
      .upsert(
        {
          evaluation_id: id,
          quarter,
          objectives_description,
          completion_percentage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'evaluation_id,quarter' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in POST /api/portal/evaluations/[id]/objectives:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
