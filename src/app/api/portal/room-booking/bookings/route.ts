import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';

// GET /api/portal/room-booking/bookings - List bookings
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = auth.employee.id;
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const mine = searchParams.get('mine');
    const date = searchParams.get('date');
    const roomId = searchParams.get('room_id');

    if (mine === 'true') {
      const { data, error } = await supabase
        .from('room_bookings_with_details')
        .select('*')
        .eq('employee_id', employeeId)
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

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

type Occurrence = { start: Date; end: Date };

function generateOccurrences(
  start: Date,
  end: Date,
  type: string,
  endDate: Date,
): Occurrence[] {
  const MAX_OCCURRENCES = 60;
  const duration = end.getTime() - start.getTime();
  const occurrences: Occurrence[] = [];

  let current = new Date(start);

  while (current <= endDate && occurrences.length < MAX_OCCURRENCES) {
    occurrences.push({ start: new Date(current), end: new Date(current.getTime() + duration) });
    switch (type) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'biweekly':
        current.setDate(current.getDate() + 14);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        return occurrences;
    }
  }

  return occurrences;
}

function formatDateTimeAR(date: Date): string {
  return date.toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recurrenceLabel(type: string): string {
  const labels: Record<string, string> = {
    daily: 'Diaria',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
  };
  return labels[type] || type;
}

function buildConfirmationEmail(params: {
  organizer: string;
  title: string;
  roomName: string;
  roomLocation: string | null;
  firstStart: Date;
  firstEnd: Date;
  recurrenceType?: string;
  recurrenceEndDate?: Date;
  occurrenceCount: number;
  invitees: string[];
}): string {
  const timeRange = `${params.firstStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} – ${params.firstEnd.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const dateStr = formatDateTimeAR(params.firstStart);

  const recurrenceSection = params.recurrenceType
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Recurrencia</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">
        ${recurrenceLabel(params.recurrenceType)} (${params.occurrenceCount} ocurrencias)
      </td></tr>`
    : '';

  const inviteesSection = params.invitees.length > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#15803d;">Participantes invitados</p>
        <p style="margin:0;font-size:13px;color:#166534;">${params.invitees.join(' · ')}</p>
      </div>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#0891b2;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">✅ Reserva confirmada</h1>
      </div>
      <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hola <strong>${params.organizer}</strong>, tu reserva fue creada exitosamente.</p>
        <div style="background:#f0f9ff;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Reunión</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.title}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Sala</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.roomName}${params.roomLocation ? ` – ${params.roomLocation}` : ''}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Fecha</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Horario</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${timeRange}</td></tr>
            ${recurrenceSection}
          </table>
        </div>
        ${inviteesSection}
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Este es un mensaje automático del sistema de reservas.</p>
      </div>
    </div>
  `;
}

function buildInvitationEmail(params: {
  inviteeName: string;
  organizer: string;
  title: string;
  roomName: string;
  roomLocation: string | null;
  start: Date;
  end: Date;
  recurrenceType?: string;
  occurrenceCount: number;
}): string {
  const timeRange = `${params.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} – ${params.end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const dateStr = formatDateTimeAR(params.start);

  const recurrenceSection = params.recurrenceType
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Recurrencia</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${recurrenceLabel(params.recurrenceType)} (${params.occurrenceCount} ocurrencias)</td></tr>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#7c3aed;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">📅 Invitación a reunión</h1>
      </div>
      <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hola <strong>${params.inviteeName}</strong>, <strong>${params.organizer}</strong> te invitó a una reunión.</p>
        <div style="background:#faf5ff;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Reunión</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.title}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Sala</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${params.roomName}${params.roomLocation ? ` – ${params.roomLocation}` : ''}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Fecha</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Horario</td><td style="padding:6px 0 6px 16px;font-size:14px;font-weight:600;">${timeRange}</td></tr>
            ${recurrenceSection}
          </table>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Este es un mensaje automático del sistema de reservas.</p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// POST /api/portal/room-booking/bookings - Create a booking
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = auth.employee.id;

    const body = await req.json();
    const {
      room_id,
      title,
      start_at,
      end_at,
      notes,
      recurrence_type,
      recurrence_end_date,
      invitees,
    } = body;

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

    // Validate recurrence
    const validRecurrenceTypes = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (recurrence_type && !validRecurrenceTypes.includes(recurrence_type)) {
      return NextResponse.json({ error: 'Invalid recurrence_type' }, { status: 400 });
    }

    if (recurrence_type && !recurrence_end_date) {
      return NextResponse.json({ error: 'recurrence_end_date is required when recurrence_type is set' }, { status: 400 });
    }

    const recurrenceEndDate = recurrence_end_date ? new Date(recurrence_end_date) : null;
    if (recurrenceEndDate && recurrenceEndDate <= startDate) {
      return NextResponse.json({ error: 'recurrence_end_date must be after start_at' }, { status: 400 });
    }

    // Validate invitees
    const inviteeIds: string[] = Array.isArray(invitees) ? invitees : [];

    const supabase = getSupabaseServer();

    // Fetch room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, name, location')
      .eq('id', room_id)
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 });
    }

    // Generate all occurrences
    const occurrences: Occurrence[] = recurrence_type && recurrenceEndDate
      ? generateOccurrences(startDate, endDate, recurrence_type, recurrenceEndDate)
      : [{ start: startDate, end: endDate }];

    if (occurrences.length === 0) {
      return NextResponse.json({ error: 'No valid occurrences generated for this recurrence' }, { status: 400 });
    }

    // Check overlaps for ALL occurrences before inserting anything
    for (const occ of occurrences) {
      const { data: overlapping, error: overlapError } = await supabase
        .from('room_bookings')
        .select('id')
        .eq('room_id', room_id)
        .eq('status', 'confirmed')
        .lt('start_at', occ.end.toISOString())
        .gt('end_at', occ.start.toISOString())
        .limit(1);

      if (overlapError) {
        return NextResponse.json({ error: overlapError.message }, { status: 500 });
      }

      if (overlapping && overlapping.length > 0) {
        const conflictDate = occ.start.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        return NextResponse.json(
          { error: `Conflicto de horario el ${conflictDate}. Ya existe una reserva en ese horario.` },
          { status: 409 }
        );
      }
    }

    // Insert the first booking
    const { data: firstBooking, error: firstError } = await supabase
      .from('room_bookings')
      .insert({
        room_id,
        employee_id: employeeId,
        title,
        start_at: occurrences[0].start.toISOString(),
        end_at: occurrences[0].end.toISOString(),
        notes: notes || null,
        recurrence_type: recurrence_type || null,
        recurrence_end_date: recurrenceEndDate?.toISOString() || null,
        status: 'confirmed',
      })
      .select('id')
      .single();

    if (firstError || !firstBooking) {
      console.error('Error creating first booking:', firstError);
      return NextResponse.json({ error: firstError?.message || 'Error creating booking' }, { status: 500 });
    }

    const allBookingIds: string[] = [firstBooking.id];

    // Insert remaining recurrence occurrences
    if (occurrences.length > 1) {
      const recurrenceRows = occurrences.slice(1).map((occ) => ({
        room_id,
        employee_id: employeeId,
        title,
        start_at: occ.start.toISOString(),
        end_at: occ.end.toISOString(),
        notes: notes || null,
        recurrence_type: recurrence_type || null,
        recurrence_end_date: recurrenceEndDate?.toISOString() || null,
        parent_booking_id: firstBooking.id,
        status: 'confirmed',
      }));

      const { data: restBookings, error: restError } = await supabase
        .from('room_bookings')
        .insert(recurrenceRows)
        .select('id');

      if (restError) {
        console.error('Error creating recurrence bookings:', restError);
      } else {
        allBookingIds.push(...(restBookings || []).map((b: any) => b.id));
      }
    }

    // Insert invitees for all bookings
    let inviteeEmployees: Array<{ id: string; first_name: string; last_name: string; work_email: string | null }> = [];

    if (inviteeIds.length > 0) {
      const inviteeRows = allBookingIds.flatMap((bookingId) =>
        inviteeIds.map((empId) => ({ booking_id: bookingId, employee_id: empId }))
      );

      const { error: inviteeError } = await supabase
        .from('room_booking_invitees')
        .insert(inviteeRows);

      if (inviteeError) {
        console.error('Error inserting invitees:', inviteeError);
      }

      // Fetch invitee details for emails
      const { data: invData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, work_email')
        .in('id', inviteeIds);

      inviteeEmployees = invData || [];
    }

    // Fetch organizer details for email
    const { data: organizer } = await supabase
      .from('employees')
      .select('first_name, last_name, work_email')
      .eq('id', employeeId)
      .single();

    const organizerName = organizer ? `${organizer.first_name} ${organizer.last_name}` : 'el organizador';
    const organizerEmail = organizer?.work_email;
    const inviteeNames = inviteeEmployees.map((e) => `${e.first_name} ${e.last_name}`);

    // Send confirmation email to organizer (fire-and-forget)
    if (organizerEmail) {
      sendSimpleEmail({
        to: organizerEmail,
        subject: `✅ Reserva confirmada: ${title}`,
        html: buildConfirmationEmail({
          organizer: organizerName,
          title,
          roomName: room.name,
          roomLocation: room.location,
          firstStart: occurrences[0].start,
          firstEnd: occurrences[0].end,
          recurrenceType: recurrence_type,
          recurrenceEndDate: recurrenceEndDate ?? undefined,
          occurrenceCount: occurrences.length,
          invitees: inviteeNames,
        }),
      }).catch((err) => console.error('Error sending confirmation email:', err));
    }

    // Send invitation emails to invitees
    for (const invitee of inviteeEmployees) {
      const email = invitee.work_email;
      if (!email) continue;
      sendSimpleEmail({
        to: email,
        subject: `📅 Invitación: ${title}`,
        html: buildInvitationEmail({
          inviteeName: `${invitee.first_name} ${invitee.last_name}`,
          organizer: organizerName,
          title,
          roomName: room.name,
          roomLocation: room.location,
          start: occurrences[0].start,
          end: occurrences[0].end,
          recurrenceType: recurrence_type,
          occurrenceCount: occurrences.length,
        }),
      }).catch((err) => console.error('Error sending invitation email:', err));
    }

    return NextResponse.json(
      { ...firstBooking, occurrences_created: allBookingIds.length },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/portal/room-booking/bookings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
