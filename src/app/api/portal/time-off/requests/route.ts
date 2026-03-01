import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';

// Regex for UUID format (more permissive than RFC 4122)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Parse date string as local date to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const CreateRequestSchema = z.object({
  leave_type_id: z.string().regex(uuidRegex, 'Tipo de licencia inválido'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de inicio inválida'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de fin inválida'),
  days_requested: z.number().positive('Los días deben ser positivos'),
  notes: z.string().optional().nullable(),
  attachment_url: z.string().url().optional().nullable(),
});

// GET /api/portal/time-off/requests - Get my leave requests
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const year = searchParams.get('year');

    let query = supabase
      .from('leave_requests_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.gte('start_date', startOfYear).lte('end_date', endOfYear);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leave requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/portal/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/time-off/requests - Create a leave request
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
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

    // Get leave type details
    const { data: leaveType, error: typeError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('id', parsed.data.leave_type_id)
      .single();

    if (typeError || !leaveType) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 400 });
    }

    // Validate advance notice
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseLocalDate(parsed.data.start_date);
    const daysUntilStart = Math.floor(
      (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilStart < leaveType.advance_notice_days) {
      return NextResponse.json(
        {
          error: `Debes solicitar ${leaveType.name} con al menos ${leaveType.advance_notice_days} días de anticipación`,
        },
        { status: 400 }
      );
    }

    // Validate study leave requires is_studying
    if (leaveType.code === 'study' && !auth.employee.is_studying) {
      return NextResponse.json(
        { error: 'No tienes habilitada la licencia por estudio. Contacta a HR.' },
        { status: 400 }
      );
    }

    // Validate study leave requires attachment
    if (leaveType.requires_attachment && !parsed.data.attachment_url) {
      return NextResponse.json(
        { error: `${leaveType.name} requiere adjuntar un comprobante` },
        { status: 400 }
      );
    }

    // Validate remote work weeks
    if (leaveType.code === 'remote_work') {
      const startDay = startDate.getDay();
      const endDate = parseLocalDate(parsed.data.end_date);
      const endDay = endDate.getDay();

      // Monday is 1, Sunday is 0
      if (startDay !== 1) {
        return NextResponse.json(
          { error: 'Las semanas de trabajo remoto deben comenzar un lunes' },
          { status: 400 }
        );
      }

      if (endDay !== 0) {
        return NextResponse.json(
          { error: 'Las semanas de trabajo remoto deben terminar un domingo' },
          { status: 400 }
        );
      }
    }

    // Check balance
    const startYear = parseLocalDate(parsed.data.start_date).getFullYear();
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .eq('leave_type_id', parsed.data.leave_type_id)
      .eq('year', startYear)
      .single();

    if (balance) {
      const available =
        balance.entitled_days + balance.carried_over - balance.used_days - balance.pending_days;
      if (parsed.data.days_requested > available) {
        return NextResponse.json(
          { error: `No tienes suficientes días disponibles. Disponible: ${available}` },
          { status: 400 }
        );
      }
    }

    // Check for overlapping requests (exclude final rejected/cancelled statuses)
    const { data: overlapping } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', auth.employee.id)
      .not('status', 'in', '("cancelled","rejected","rejected_leader","rejected_hr")')
      .lte('start_date', parsed.data.end_date)
      .gte('end_date', parsed.data.start_date)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una solicitud que se superpone con estas fechas' },
        { status: 400 }
      );
    }

    // Get employee's manager for two-level approval flow
    const { data: employee } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', auth.employee.id)
      .single();

    if (!employee?.manager_id) {
      return NextResponse.json(
        { error: 'No tienes un líder asignado. Contacta a HR para configurar tu manager.' },
        { status: 400 }
      );
    }

    // Create the request with pending_leader status and assigned leader
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: auth.employee.id,
        status: 'pending_leader',
        leader_id: employee.manager_id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update pending days in balance
    if (balance) {
      await supabase
        .from('leave_balances')
        .update({
          pending_days: balance.pending_days + parsed.data.days_requested,
        })
        .eq('id', balance.id);
    } else {
      // Create balance if not exists
      await supabase.from('leave_balances').insert({
        employee_id: auth.employee.id,
        leave_type_id: parsed.data.leave_type_id,
        year: startYear,
        pending_days: parsed.data.days_requested,
      });
    }

    // Handle remote work weeks
    if (leaveType.code === 'remote_work') {
      const weeks = [];
      let currentDate = parseLocalDate(parsed.data.start_date);
      const endDateForWeeks = parseLocalDate(parsed.data.end_date);

      while (currentDate <= endDateForWeeks) {
        const weekNumber = getISOWeek(currentDate);
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        weeks.push({
          employee_id: auth.employee.id,
          year: currentDate.getFullYear(),
          week_number: weekNumber,
          week_start_date: weekStart.toISOString().split('T')[0],
          week_end_date: weekEnd.toISOString().split('T')[0],
          leave_request_id: data.id,
        });

        currentDate.setDate(currentDate.getDate() + 7);
      }

      if (weeks.length > 0) {
        await supabase.from('remote_work_weeks').insert(weeks);
      }
    }

    // Send email notifications
    const formatDate = (date: string) => {
      return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const emailVariables = {
      nombre: `${auth.employee.first_name}`,
      fecha_inicio: formatDate(parsed.data.start_date),
      fecha_fin: formatDate(parsed.data.end_date),
      cantidad_dias: String(parsed.data.days_requested),
      tipo_licencia: leaveType.name,
    };

    // Email to employee: request submitted (prefer work_email)
    const employeeEmail = auth.employee.work_email || auth.employee.personal_email;
    if (employeeEmail) {
      sendTimeOffEmail({
        templateKey: 'time_off_request_submitted',
        to: employeeEmail,
        variables: emailVariables,
        leaveRequestId: data.id,
      }).catch((err) => console.error('Error sending request submitted email:', err));
    }

    // Email to leader: new request to approve
    const { data: manager } = await supabase
      .from('employees')
      .select('first_name, personal_email, work_email, user_id')
      .eq('id', employee.manager_id)
      .single();

    if (!manager) {
      console.error(
        `[TimeOff] manager_id=${employee.manager_id} not found in employees for leave_request=${data.id}`
      );
    }

    if (manager) {
      let managerEmail: string | null = manager.work_email || manager.personal_email;

      // Fallback: if the employee record has no email, try the auth account email
      if (!managerEmail && manager.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(manager.user_id);
        if (authUser?.user?.email) {
          managerEmail = authUser.user.email;
          console.warn(
            `[TimeOff] Manager ${employee.manager_id} has no work/personal email — falling back to auth email for leave_request=${data.id}`
          );
        }
      }

      if (managerEmail) {
        sendTimeOffEmail({
          templateKey: 'time_off_leader_notification',
          to: managerEmail,
          variables: {
            nombre_lider: manager.first_name,
            nombre_colaborador: `${auth.employee.first_name} ${auth.employee.last_name}`,
            ...emailVariables,
          },
          leaveRequestId: data.id,
        }).catch((err) => console.error('Error sending leader notification email:', err));
      } else {
        console.error(
          `[TimeOff] Cannot notify leader ${employee.manager_id}: no email found anywhere for leave_request=${data.id}`
        );
      }

      // In-app notification to leader
      if (manager.user_id) {
        createSystemNotification({
          userIds: [manager.user_id],
          title: 'Nueva solicitud de licencia pendiente',
          body: `${auth.employee.first_name} ${auth.employee.last_name} solicitó ${parsed.data.days_requested} día(s) de ${leaveType.name}.`,
          priority: 'info',
          deepLink: '/portal/team',
          metadata: { entity_type: 'leave_request', entity_id: data.id },
          dedupeKey: `leave_request:${data.id}:pending_leader`,
        }).catch((err) => console.error('Error creating leader in-app notification:', err));
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
