import { NextRequest, NextResponse } from 'next/server';
import { authenticateAddon } from '../../_auth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// DELETE /api/addon/room-booking/bookings/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { employee, error } = await authenticateAddon(req);
  if (error || !employee) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: booking, error: fetchError } = await supabase
    .from('room_bookings')
    .select('id, employee_id, start_at, status')
    .eq('id', id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.employee_id !== employee.id) {
    return NextResponse.json({ error: 'Solo podés cancelar tus propias reservas' }, { status: 403 });
  }

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'La reserva ya está cancelada' }, { status: 400 });
  }

  if (new Date(booking.start_at) <= new Date()) {
    return NextResponse.json({ error: 'No podés cancelar una reserva que ya comenzó' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('room_bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
