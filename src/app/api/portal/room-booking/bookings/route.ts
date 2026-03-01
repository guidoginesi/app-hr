import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/room-booking/bookings - List bookings
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const mine = searchParams.get('mine');
    const date = searchParams.get('date');
    const roomId = searchParams.get('room_id');

    if (mine === 'true') {
      const { data, error } = await supabase
        .from('room_bookings_with_details')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .order('start_at', { ascending: false });

      if (error) {
        console.error('Error fetching my bookings:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ bookings: data });
    }

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }

      const toDate = searchParams.get('to');
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ? `${toDate}T23:59:59.999Z`
        : `${date}T23:59:59.999Z`;

      let query = supabase
        .from('room_bookings_with_details')
        .select('*')
        .eq('status', 'confirmed')
        .lt('start_at', dayEnd)
        .gt('end_at', dayStart)
        .order('start_at');

      if (roomId) {
        query = query.eq('room_id', roomId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching bookings by date:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ bookings: data });
    }

    return NextResponse.json(
      { error: 'Missing required query parameter: mine=true or date=YYYY-MM-DD' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/portal/room-booking/bookings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/room-booking/bookings - Create a booking
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { room_id, title, start_at, end_at, notes } = body;

    if (!room_id || !title || !start_at || !end_at) {
      return NextResponse.json(
        { error: 'Missing required fields: room_id, title, start_at, end_at' },
        { status: 400 }
      );
    }

    const startDate = new Date(start_at);
    const endDate = new Date(end_at);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for start_at or end_at' }, { status: 400 });
    }

    if (endDate <= startDate) {
      return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
    }

    if (startDate <= new Date()) {
      return NextResponse.json({ error: 'Booking must be in the future' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Verify the room exists and is active
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', room_id)
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 });
    }

    // Check for overlapping confirmed bookings in the same room
    const { data: overlapping, error: overlapError } = await supabase
      .from('room_bookings')
      .select('id')
      .eq('room_id', room_id)
      .eq('status', 'confirmed')
      .lt('start_at', end_at)
      .gt('end_at', start_at)
      .limit(1);

    if (overlapError) {
      console.error('Error checking overlapping bookings:', overlapError);
      return NextResponse.json({ error: overlapError.message }, { status: 500 });
    }

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: 'This time slot overlaps with an existing booking for this room' },
        { status: 409 }
      );
    }

    // Create the booking
    const { data, error } = await supabase
      .from('room_bookings')
      .insert({
        room_id,
        employee_id: auth.employee.id,
        title,
        start_at,
        end_at,
        notes: notes || null,
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/room-booking/bookings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
