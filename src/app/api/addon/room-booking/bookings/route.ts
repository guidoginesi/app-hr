import { NextRequest, NextResponse } from 'next/server';
import { authenticateAddon } from '../_auth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';

const TZ = 'America/Argentina/Buenos_Aires';

function formatDateTimeAR(date: Date): string {
  return date.toLocaleString('es-AR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAR(date: Date): string {
  return date.toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

function buildConfirmationEmailHtml(params: {
  organizer: string;
  title: string;
  roomName: string;
  roomLocation: string | null;
  start: Date;
  end: Date;
}): string {
  const timeRange = `${formatTimeAR(params.start)} – ${formatTimeAR(params.end)}`;
  const dateStr = formatDateTimeAR(params.start);
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#0891b2;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">✅ Reserva confirmada</h1>
      </div>
      <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hola <strong>${params.organizer}</strong>, tu reserva fue creada desde Google Calendar.</p>
        <div style="background:#f0f9ff;border-radius:10px;padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Reunión</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.title}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Sala</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.roomName}${params.roomLocation ? ` – ${params.roomLocation}` : ''}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Fecha</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Horario</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${timeRange}</td></tr>
          </table>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Reserva creada desde el Add-on de Google Calendar.</p>
      </div>
    </div>
  `;
}

// GET /api/addon/room-booking/bookings
// Supports: ?mine=true  OR  ?date=YYYY-MM-DD[&to=YYYY-MM-DD][&room_id=...]
export async function GET(req: NextRequest) {
  const { employee, error } = await authenticateAddon(req);
  if (error || !employee) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get('mine');
  const date = searchParams.get('date');
  const roomId = searchParams.get('room_id');

  if (mine === 'true') {
    const { data, error: dbError } = await supabase
      .from('room_bookings_with_details')
      .select('*')
      .eq('employee_id', employee.id)
      .order('start_at', { ascending: false });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ bookings: data });
  }

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const toDate = searchParams.get('to');
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd =
      toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ? `${toDate}T23:59:59.999Z`
        : `${date}T23:59:59.999Z`;

    let query = supabase
      .from('room_bookings_with_details')
      .select('*')
      .eq('status', 'confirmed')
      .lt('start_at', dayEnd)
      .gt('end_at', dayStart)
      .order('start_at');

    if (roomId) query = query.eq('room_id', roomId);

    const { data, error: dbError } = await query;
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ bookings: data });
  }

  return NextResponse.json(
    { error: 'Missing required query parameter: mine=true or date=YYYY-MM-DD' },
    { status: 400 }
  );
}

// POST /api/addon/room-booking/bookings
export async function POST(req: NextRequest) {
  const { employee, error } = await authenticateAddon(req);
  if (error || !employee) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
  }
  if (endDate <= new Date()) {
    return NextResponse.json({ error: 'Booking must be in the future' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, name, location')
    .eq('id', room_id)
    .eq('is_active', true)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 });
  }

  // Check overlap
  const { data: overlapping, error: overlapError } = await supabase
    .from('room_bookings')
    .select('id')
    .eq('room_id', room_id)
    .eq('status', 'confirmed')
    .lt('start_at', endDate.toISOString())
    .gt('end_at', startDate.toISOString())
    .limit(1);

  if (overlapError) {
    return NextResponse.json({ error: overlapError.message }, { status: 500 });
  }
  if (overlapping && overlapping.length > 0) {
    return NextResponse.json(
      { error: 'Conflicto de horario: ya existe una reserva en ese horario para esta sala.' },
      { status: 409 }
    );
  }

  const { data: booking, error: insertError } = await supabase
    .from('room_bookings')
    .insert({
      room_id,
      employee_id: employee.id,
      title,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      notes: notes || null,
      status: 'confirmed',
    })
    .select('id')
    .single();

  if (insertError || !booking) {
    return NextResponse.json({ error: insertError?.message || 'Error creating booking' }, { status: 500 });
  }

  // Send confirmation email (fire-and-forget)
  if (employee.work_email) {
    sendSimpleEmail({
      to: employee.work_email,
      subject: `✅ Reserva confirmada: ${title}`,
      html: buildConfirmationEmailHtml({
        organizer: `${employee.first_name} ${employee.last_name}`,
        title,
        roomName: room.name,
        roomLocation: room.location,
        start: startDate,
        end: endDate,
      }),
    }).catch((err) => console.error('[addon] Error sending confirmation email:', err));
  }

  return NextResponse.json(booking, { status: 201 });
}
