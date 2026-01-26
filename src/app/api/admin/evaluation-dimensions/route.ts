import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateDimensionSchema = z.object({
  period_id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  order_index: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

// GET /api/admin/evaluation-dimensions - List dimensions
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const period_id = searchParams.get('period_id');

    let query = supabase
      .from('evaluation_dimensions')
      .select(`
        *,
        items:evaluation_items(*)
      `)
      .order('order_index', { ascending: true });

    if (period_id) {
      query = query.eq('period_id', period_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching dimensions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort items by order_index
    const sortedData = data?.map(dim => ({
      ...dim,
      items: dim.items?.sort((a: any, b: any) => a.order_index - b.order_index)
    }));

    return NextResponse.json(sortedData);
  } catch (error: any) {
    console.error('Error in GET /api/admin/evaluation-dimensions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/evaluation-dimensions - Create dimension
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateDimensionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get max order_index for this period
    const { data: maxOrder } = await supabase
      .from('evaluation_dimensions')
      .select('order_index')
      .eq('period_id', parsed.data.period_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const order_index = parsed.data.order_index || (maxOrder?.order_index || 0) + 1;

    const { data, error } = await supabase
      .from('evaluation_dimensions')
      .insert({ ...parsed.data, order_index })
      .select()
      .single();

    if (error) {
      console.error('Error creating dimension:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/evaluation-dimensions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
