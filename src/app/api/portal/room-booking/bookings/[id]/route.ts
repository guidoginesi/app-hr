import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// DELETE /api/portal/room-booking/bookings/[id] - Cancel own booking
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from('room_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify ownership
    if (booking.employee_id !== auth.employee.id) {
      return NextResponse.json({ error: 'You can only cancel your own bookings' }, { status: 403 });
    }

    // Only allow cancelling confirmed bookings
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 });
    }

    // Only allow cancelling future bookings
    if (new Date(booking.start_at) <= new Date()) {
      return NextResponse.json({ error: 'Cannot cancel a booking that has already started' }, { status: 400 });
    }

    // Cancel the booking
    const { error: updateError } = await supabase
      .from('room_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/portal/room-booking/bookings/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
