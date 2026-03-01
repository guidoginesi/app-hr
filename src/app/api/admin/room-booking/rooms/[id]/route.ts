import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional(),
  equipment: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/room-booking/rooms/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de sala inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/room-booking/rooms/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de sala inválido' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('rooms')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/room-booking/rooms/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID de sala inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Check if there are future confirmed bookings for this room
    const { data: futureBookings } = await supabase
      .from('room_bookings')
      .select('id')
      .eq('room_id', id)
      .eq('status', 'confirmed')
      .gte('start_at', new Date().toISOString())
      .limit(1);

    if (futureBookings && futureBookings.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar porque hay reservas futuras confirmadas para esta sala' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('rooms')
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
