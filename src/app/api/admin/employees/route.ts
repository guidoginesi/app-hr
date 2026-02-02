import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateEmployeeSchema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido'),
  last_name: z.string().min(1, 'El apellido es requerido'),
  personal_email: z.string().email('Email inválido'),
  work_email: z.string().email('Email inválido').optional().nullable(),
  nationality: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  cuil: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  education_level: z.enum(['primary', 'secondary', 'tertiary', 'university', 'postgraduate']).optional().nullable(),
  education_title: z.string().optional().nullable(),
  languages: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().optional().nullable(),
  emergency_contact_first_name: z.string().optional().nullable(),
  emergency_contact_last_name: z.string().optional().nullable(),
  emergency_contact_address: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  legal_entity_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  job_title: z.string().optional().nullable(),
  seniority_level: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  hire_date: z.string().optional().nullable(),
  employment_type: z.enum(['monotributista', 'dependency']).optional().nullable(),
});

// GET /api/admin/employees - List all employees
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get('status');
    const legal_entity_id = searchParams.get('legal_entity_id');
    const department_id = searchParams.get('department_id');
    const search = searchParams.get('search');

    let query = supabase
      .from('employees')
      .select(`
        *,
        legal_entity:legal_entities(id, name),
        department:departments(id, name),
        manager:employees!manager_id(id, first_name, last_name)
      `)
      .order('last_name', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (legal_entity_id) {
      query = query.eq('legal_entity_id', legal_entity_id);
    }

    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,personal_email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/employees:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/employees - Create a new employee
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check for duplicate email
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('personal_email', parsed.data.personal_email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un empleado con este email' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('employees')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
