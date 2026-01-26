import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateDepartmentSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  legal_entity_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
});

// GET /api/admin/departments - List all departments
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const legal_entity_id = searchParams.get('legal_entity_id');

    let query = supabase
      .from('departments')
      .select(`
        *,
        legal_entity:legal_entities(id, name)
      `)
      .order('name', { ascending: true });

    if (legal_entity_id) {
      query = query.eq('legal_entity_id', legal_entity_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/departments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/departments - Create a new department
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check for duplicate name within the same legal entity
    let duplicateQuery = supabase
      .from('departments')
      .select('id')
      .eq('name', parsed.data.name);

    if (parsed.data.legal_entity_id) {
      duplicateQuery = duplicateQuery.eq('legal_entity_id', parsed.data.legal_entity_id);
    } else {
      duplicateQuery = duplicateQuery.is('legal_entity_id', null);
    }

    const { data: existing } = await duplicateQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un departamento con este nombre' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('departments')
      .insert(parsed.data)
      .select(`
        *,
        legal_entity:legal_entities(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/departments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
