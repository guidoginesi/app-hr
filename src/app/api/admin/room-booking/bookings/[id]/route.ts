import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdateBookingSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/room-booking/bookings/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de reserva inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('room_bookings_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/room-booking/bookings/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de reserva inválido' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // If changing times or confirming a booking, validate no overlap
    if (parsed.data.start_at || parsed.data.end_at || parsed.data.status === 'confirmed') {
      // Fetch the current booking to merge times
      const { data: current, error: fetchError } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !current) {
        return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
      }

      const newStartAt = parsed.data.start_at || current.start_at;
      const newEndAt = parsed.data.end_at || current.end_at;

      if (new Date(newEndAt) <= new Date(newStartAt)) {
        return NextResponse.json(
          { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
          { status: 400 }
        );
      }

      // Check for overlapping confirmed bookings (excluding this one)
      const { data: overlapping } = await supabase
        .from('room_bookings')
        .select('id')
        .eq('room_id', current.room_id)
        .eq('status', 'confirmed')
        .neq('id', id)
        .lt('start_at', newEndAt)
        .gt('end_at', newStartAt)
        .limit(1);

      if (overlapping && overlapping.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe una reserva confirmada que se superpone con este horario' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('room_bookings')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/room-booking/bookings/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de reserva inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('room_bookings')
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
