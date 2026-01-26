import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateItemSchema = z.object({
  dimension_id: z.string().uuid(),
  statement: z.string().min(1, 'La afirmación es requerida'),
  order_index: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

// POST /api/admin/evaluation-items - Create item
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get max order_index for this dimension
    const { data: maxOrder } = await supabase
      .from('evaluation_items')
      .select('order_index')
      .eq('dimension_id', parsed.data.dimension_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const order_index = parsed.data.order_index || (maxOrder?.order_index || 0) + 1;

    const { data, error } = await supabase
      .from('evaluation_items')
      .insert({ ...parsed.data, order_index })
      .select()
      .single();

    if (error) {
      console.error('Error creating item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/evaluation-items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
