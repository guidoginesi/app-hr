import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const SaveResponseSchema = z.object({
  item_id: z.string().uuid(),
  score: z.number().int().min(1).max(10).optional().nullable(),
  explanation: z.string().optional().nullable(),
});

const SaveOpenQuestionSchema = z.object({
  question_key: z.string(),
  response: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portal/evaluations/[id]/responses - Save response (auto-save)
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const supabase = getSupabaseServer();

    // Verify ownership and status
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('id, evaluator_id, status')
      .eq('id', id)
      .single();

    if (!evaluation || evaluation.evaluator_id !== auth.employee.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta evaluación' }, { status: 403 });
    }

    if (evaluation.status === 'submitted') {
      return NextResponse.json({ error: 'La evaluación ya fue enviada' }, { status: 400 });
    }

    // Handle item response
    if (body.item_id) {
      const parsed = SaveResponseSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }

      const { item_id, score, explanation } = parsed.data;

      // Upsert response
      const { data, error } = await supabase
        .from('evaluation_responses')
        .upsert(
          {
            evaluation_id: id,
            item_id,
            score,
            explanation,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'evaluation_id,item_id' }
        )
        .select()
        .single();

      if (error) {
        console.error('Error saving response:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Update evaluation status to in_progress if still draft
      if (evaluation.status === 'draft') {
        await supabase
          .from('evaluations')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      return NextResponse.json(data);
    }

    // Handle open question response
    if (body.question_key) {
      const parsed = SaveOpenQuestionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }

      const { question_key, response } = parsed.data;

      const { data, error } = await supabase
        .from('evaluation_open_questions')
        .upsert(
          {
            evaluation_id: id,
            question_key,
            response,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'evaluation_id,question_key' }
        )
        .select()
        .single();

      if (error) {
        console.error('Error saving open question:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/evaluations/[id]/responses:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
