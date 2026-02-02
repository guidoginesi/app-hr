import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Helper to transform empty strings to null
const stringToNull = z.any().transform((val) => {
  if (val === '' || val === undefined || val === null) return null;
  return String(val);
});

// Helper for optional UUID fields - accepts any value and transforms to valid UUID or null
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalUuid = z.any().transform((val) => {
  if (val === '' || val === undefined || val === null) return null;
  if (typeof val === 'string' && UUID_REGEX.test(val)) return val;
  return null; // Invalid UUID format, treat as null
});

// Helper for optional enum fields - accepts any value and transforms to valid enum or null
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.any().transform((val) => {
  if (val === '' || val === undefined || val === null) return null;
  if (typeof val === 'string' && (values as readonly string[]).includes(val)) return val;
  return null; // Invalid enum value, treat as null
});

const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  personal_email: z.string().email().optional(),
  work_email: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.string().email().nullable()
  ).optional(),
  nationality: stringToNull.optional(),
  birth_date: stringToNull.optional(),
  phone: stringToNull.optional(),
  marital_status: optionalEnum(['single', 'married', 'divorced', 'widowed', 'other']).optional(),
  photo_url: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.string().url().nullable().or(z.null())
  ).optional(),
  cuil: stringToNull.optional(),
  dni: stringToNull.optional(),
  address: stringToNull.optional(),
  city: stringToNull.optional(),
  postal_code: stringToNull.optional(),
  country: stringToNull.optional(),
  education_level: optionalEnum(['primary', 'secondary', 'tertiary', 'university', 'postgraduate']).optional(),
  education_title: stringToNull.optional(),
  languages: stringToNull.optional(),
  emergency_contact_relationship: stringToNull.optional(),
  emergency_contact_first_name: stringToNull.optional(),
  emergency_contact_last_name: stringToNull.optional(),
  emergency_contact_address: stringToNull.optional(),
  emergency_contact_phone: stringToNull.optional(),
  legal_entity_id: optionalUuid.optional(),
  department_id: optionalUuid.optional(),
  manager_id: optionalUuid.optional(),
  job_title: stringToNull.optional(),
  seniority_level: stringToNull.optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  hire_date: stringToNull.optional(),
  termination_date: stringToNull.optional(),
  employment_type: optionalEnum(['monotributista', 'dependency']).optional(),
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
