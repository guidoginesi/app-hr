import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateBookingSchema = z.object({
  room_id: z.string().regex(uuidRegex, 'ID de sala inválido'),
  employee_id: z.string().regex(uuidRegex, 'ID de empleado inválido'),
  title: z.string().min(1, 'El título es requerido'),
  start_at: z.string().min(1, 'La fecha de inicio es requerida'),
  end_at: z.string().min(1, 'La fecha de fin es requerida'),
  notes: z.string().optional().nullable(),
});

// GET /api/admin/room-booking/bookings - List all bookings
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const room_id = searchParams.get('room_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
      .from('room_bookings_with_details')
      .select('*')
      .order('start_at', { ascending: false });

    if (room_id) {
      query = query.eq('room_id', room_id);
    }

    if (from) {
      query = query.gte('start_at', from);
    }

    if (to) {
      query = query.lte('start_at', to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data });
  } catch (error: any) {
    console.error('Error in GET /api/admin/room-booking/bookings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/room-booking/bookings - Create a new booking
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    // Validate end_at is after start_at
    if (new Date(parsed.data.end_at) <= new Date(parsed.data.start_at)) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check for overlapping confirmed bookings in the same room
    const { data: overlapping } = await supabase
      .from('room_bookings')
      .select('id')
      .eq('room_id', parsed.data.room_id)
      .eq('status', 'confirmed')
      .lt('start_at', parsed.data.end_at)
      .gt('end_at', parsed.data.start_at)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una reserva confirmada que se superpone con este horario' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('room_bookings')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/room-booking/bookings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
