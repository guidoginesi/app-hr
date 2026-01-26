import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const PeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  period_type: z.enum(['definition', 'evaluation']),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  is_active: z.boolean().optional().default(true),
});

// GET /api/admin/objectives/periods - List all periods
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    let query = supabase
      .from('objectives_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('period_type', { ascending: true });

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives/periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/objectives/periods - Create or update period
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    // Validate dates
    if (parsed.data.end_date < parsed.data.start_date) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check if period already exists for this year and type
    const { data: existing } = await supabase
      .from('objectives_periods')
      .select('id')
      .eq('year', parsed.data.year)
      .eq('period_type', parsed.data.period_type)
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('objectives_periods')
        .update(parsed.data)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('objectives_periods')
        .insert(parsed.data)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/objectives/periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
