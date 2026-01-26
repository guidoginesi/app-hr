import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateDimensionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  order_index: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/evaluation-dimensions/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('evaluation_dimensions')
      .select(`
        *,
        items:evaluation_items(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Dimensión no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort items
    data.items = data.items?.sort((a: any, b: any) => a.order_index - b.order_index);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/evaluation-dimensions/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/evaluation-dimensions/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateDimensionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('evaluation_dimensions')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Dimensión no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/evaluation-dimensions/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/evaluation-dimensions/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('evaluation_dimensions')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/evaluation-dimensions/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
