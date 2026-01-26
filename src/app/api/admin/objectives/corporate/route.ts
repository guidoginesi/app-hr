import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CorporateObjectiveSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  objective_type: z.enum(['billing', 'nps']),
  quarter: z.enum(['q1', 'q2', 'q3', 'q4']).optional().nullable(),
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional().nullable(),
  target_value: z.number().optional().nullable(),
  gate_percentage: z.number().int().min(0).max(100).optional().nullable(),
  cap_percentage: z.number().int().min(100).max(200).optional().nullable(),
  floor_value: z.number().optional().nullable(),
  ceiling_value: z.number().optional().nullable(),
  actual_value: z.number().optional().nullable(),
});

// GET /api/admin/objectives/corporate - List corporate objectives
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');

    let query = supabase
      .from('corporate_objectives')
      .select('*')
      .order('year', { ascending: false })
      .order('objective_type', { ascending: true });

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching corporate objectives:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives/corporate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/objectives/corporate - Create or update corporate objective
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CorporateObjectiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check if objective for this year, type and quarter already exists
    let existingQuery = supabase
      .from('corporate_objectives')
      .select('id')
      .eq('year', parsed.data.year)
      .eq('objective_type', parsed.data.objective_type);
    
    // For NPS, also check quarter. For billing, quarter is null
    if (parsed.data.quarter) {
      existingQuery = existingQuery.eq('quarter', parsed.data.quarter);
    } else {
      existingQuery = existingQuery.is('quarter', null);
    }
    
    const { data: existing } = await existingQuery.single();

    let data, error;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('corporate_objectives')
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Create new
      const result = await supabase
        .from('corporate_objectives')
        .insert(parsed.data)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving corporate objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: existing ? 200 : 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/objectives/corporate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/objectives/corporate?id=xxx - Delete corporate objective
export async function DELETE(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('corporate_objectives')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting corporate objective:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/objectives/corporate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
