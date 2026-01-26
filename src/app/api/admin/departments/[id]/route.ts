import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  legal_entity_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/departments/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        legal_entity:legal_entities(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Departamento no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/departments/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // If updating name, check for duplicates
    if (parsed.data.name) {
      const { data: current } = await supabase
        .from('departments')
        .select('legal_entity_id')
        .eq('id', id)
        .single();

      const legalEntityId = parsed.data.legal_entity_id ?? current?.legal_entity_id;

      let duplicateQuery = supabase
        .from('departments')
        .select('id')
        .eq('name', parsed.data.name)
        .neq('id', id);

      if (legalEntityId) {
        duplicateQuery = duplicateQuery.eq('legal_entity_id', legalEntityId);
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
    }

    const { data, error } = await supabase
      .from('departments')
      .update(parsed.data)
      .eq('id', id)
      .select(`
        *,
        legal_entity:legal_entities(id, name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Departamento no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/departments/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Check if any employees are using this department
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('department_id', id)
      .limit(1);

    if (employees && employees.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar porque hay empleados asignados a este departamento' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
