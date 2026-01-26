import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Helper to transform empty strings to null
const emptyToNull = z.string().transform(v => v === '' ? null : v);
const emptyToNullOrUndefined = z.union([z.string(), z.null(), z.undefined()]).transform(v => v === '' ? null : v);

const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  personal_email: z.string().email().optional(),
  work_email: z.union([z.string().email(), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  nationality: emptyToNullOrUndefined.optional(),
  birth_date: emptyToNullOrUndefined.optional(),
  phone: emptyToNullOrUndefined.optional(),
  marital_status: z.union([z.enum(['single', 'married', 'divorced', 'widowed', 'other']), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  photo_url: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  cuil: emptyToNullOrUndefined.optional(),
  dni: emptyToNullOrUndefined.optional(),
  address: emptyToNullOrUndefined.optional(),
  city: emptyToNullOrUndefined.optional(),
  postal_code: emptyToNullOrUndefined.optional(),
  country: emptyToNullOrUndefined.optional(),
  education_level: z.union([z.enum(['primary', 'secondary', 'tertiary', 'university', 'postgraduate']), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  education_title: emptyToNullOrUndefined.optional(),
  languages: emptyToNullOrUndefined.optional(),
  emergency_contact_relationship: emptyToNullOrUndefined.optional(),
  emergency_contact_first_name: emptyToNullOrUndefined.optional(),
  emergency_contact_last_name: emptyToNullOrUndefined.optional(),
  emergency_contact_address: emptyToNullOrUndefined.optional(),
  emergency_contact_phone: emptyToNullOrUndefined.optional(),
  legal_entity_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  department_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  manager_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v === '' ? null : v),
  job_title: emptyToNullOrUndefined.optional(),
  seniority_level: emptyToNullOrUndefined.optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  hire_date: emptyToNullOrUndefined.optional(),
  termination_date: emptyToNullOrUndefined.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/employees/[id] - Get a single employee
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        legal_entity:legal_entities(id, name),
        department:departments(id, name),
        manager:employees!manager_id(id, first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/employees/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/employees/[id] - Update an employee
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // If updating email, check for duplicates
    if (parsed.data.personal_email) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('personal_email', parsed.data.personal_email)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un empleado con este email' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('employees')
      .update(parsed.data)
      .eq('id', id)
      .select(`
        *,
        legal_entity:legal_entities(id, name),
        department:departments(id, name),
        manager:employees!manager_id(id, first_name, last_name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/employees/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/employees/[id] - Delete an employee (soft delete by setting status)
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Soft delete - set status to terminated
    const { data, error } = await supabase
      .from('employees')
      .update({ 
        status: 'terminated',
        termination_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/employees/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
