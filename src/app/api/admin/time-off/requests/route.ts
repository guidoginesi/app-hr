import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateRequestSchema = z.object({
  employee_id: z.string().uuid('ID de empleado inválido'),
  leave_type_id: z.string().uuid('Tipo de licencia inválido'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de inicio inválida'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de fin inválida'),
  days_requested: z.number().positive('Los días deben ser positivos'),
  notes: z.string().optional().nullable(),
  attachment_url: z.string().url().optional().nullable(),
});

// GET /api/admin/time-off/requests - List all leave requests
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const employee_id = searchParams.get('employee_id');
    const leave_type_id = searchParams.get('leave_type_id');
    const year = searchParams.get('year');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');

    let query = supabase
      .from('leave_requests_with_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (leave_type_id) {
      query = query.eq('leave_type_id', leave_type_id);
    }

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.gte('start_date', startOfYear).lte('end_date', endOfYear);
    }

    if (from_date) {
      query = query.gte('start_date', from_date);
    }

    if (to_date) {
      query = query.lte('end_date', to_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leave requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/time-off/requests - Create a leave request (admin can create for any employee)
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Validate dates
    if (parsed.data.end_date < parsed.data.start_date) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      );
    }

    // Check for overlapping requests
    const { data: overlapping } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', parsed.data.employee_id)
      .neq('status', 'cancelled')
      .neq('status', 'rejected')
      .or(`start_date.lte.${parsed.data.end_date},end_date.gte.${parsed.data.start_date}`)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una solicitud que se superpone con estas fechas' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error('Error creating leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update pending days in balance
    const startYear = new Date(parsed.data.start_date).getFullYear();
    await supabase.rpc('update_leave_balance_pending', {
      p_employee_id: parsed.data.employee_id,
      p_leave_type_id: parsed.data.leave_type_id,
      p_year: startYear,
      p_days: parsed.data.days_requested,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
