import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateLegalEntitySchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/legal-entities/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('legal_entities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Sociedad no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/legal-entities/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateLegalEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // If updating name, check for duplicates
    if (parsed.data.name) {
      const { data: existing } = await supabase
        .from('legal_entities')
        .select('id')
        .eq('name', parsed.data.name)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe una sociedad con este nombre' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('legal_entities')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Sociedad no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/legal-entities/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Check if any employees are using this legal entity
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('legal_entity_id', id)
      .limit(1);

    if (employees && employees.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar porque hay empleados asignados a esta sociedad' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('legal_entities')
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
