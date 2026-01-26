import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdatePeriodSchema = z.object({
  name: z.string().min(1).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  evaluation_start_date: z.string().optional().nullable(),
  evaluation_end_date: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  status: z.enum(['draft', 'open', 'closed']).optional(),
  self_evaluation_enabled: z.boolean().optional(),
  leader_evaluation_enabled: z.boolean().optional(),
  show_results_to_employee: z.boolean().optional(),
  objectives_enabled: z.boolean().optional(),
  recategorization_enabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/evaluation-periods/[id] - Get a single period with dimensions
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('evaluation_periods')
      .select(`
        *,
        dimensions:evaluation_dimensions(
          *,
          items:evaluation_items(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/evaluation-periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/evaluation-periods/[id] - Update a period
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdatePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // If setting as active, deactivate other periods first
    if (parsed.data.is_active) {
      await supabase
        .from('evaluation_periods')
        .update({ is_active: false })
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('evaluation_periods')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/evaluation-periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/evaluation-periods/[id] - Delete a period
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Check if there are evaluations for this period
    const { count } = await supabase
      .from('evaluations')
      .select('id', { count: 'exact' })
      .eq('period_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un período con evaluaciones existentes' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('evaluation_periods')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/evaluation-periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
