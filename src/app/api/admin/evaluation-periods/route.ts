import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreatePeriodSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  year: z.number().int().min(2020).max(2100),
  start_date: z.string(),
  end_date: z.string(),
  evaluation_start_date: z.string().optional().nullable(),
  evaluation_end_date: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(false),
  status: z.enum(['draft', 'open', 'closed']).optional().default('draft'),
  self_evaluation_enabled: z.boolean().optional().default(true),
  leader_evaluation_enabled: z.boolean().optional().default(true),
  show_results_to_employee: z.boolean().optional().default(false),
  objectives_enabled: z.boolean().optional().default(true),
  recategorization_enabled: z.boolean().optional().default(true),
});

// GET /api/admin/evaluation-periods - List all periods
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/evaluation-periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/evaluation-periods - Create a new period
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreatePeriodSchema.safeParse(body);

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
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { data, error } = await supabase
      .from('evaluation_periods')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error('Error creating period:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/evaluation-periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
