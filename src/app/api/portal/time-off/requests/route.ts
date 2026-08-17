import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail, logTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';
import { isUnlimitedLeaveType, isHrOnlyApprovalType, isSelfRegisteredType } from '@/lib/leaveTypes';
import { requiresLeaveCertificate, leaveCertRule, leaveCertDeadline } from '@/lib/leaveCertificates';
import { BIRTHDAY_LEAVE_CODE, birthdayWindow, isWithinBirthdayWindow } from '@/lib/birthdayLeave';
import { sincronizarLicencia } from '@/lib/leaveCalendar';

// Regex for UUID format (more permissive than RFC 4122)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retry a DB fetch up to `retries` times with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/** Días del año en que la persona ya está ausente por una licencia vigente. */
async function busyDaysForEmployee(
  supabase: ReturnType<typeof getSupabaseServer>,
  employeeId: string,
  year: number,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('leave_requests')
    .select('start_date, end_date')
    .eq('employee_id', employeeId)
    .in('status', ['approved', 'pending_hr', 'pending_leader'])
    .gte('end_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`);

  const set = new Set<string>();
  for (const r of data ?? []) {
    const d = new Date(`${r.start_date}T00:00:00Z`);
    const fin = new Date(`${r.end_date}T00:00:00Z`);
    while (d <= fin) {
      set.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return set;
}

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

    // La licencia por enfermedad se reporta con el inicio casi siempre ya
    // ocurrido (te enfermás y avisás), así que se exime de la anticipación: si
    // no, un inicio en el pasado quedaría bloqueado.
    const selfRegistered = isSelfRegisteredType(leaveType.code);
    if (!selfRegistered && daysUntilStart < leaveType.advance_notice_days) {
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

    // Los tipos que se acreditan con certificado (enfermedad, estudio) NO exigen
    // el adjunto al crear: se sube después, con su plazo y su recordatorio. Este
    // chequeo es el que dejó a la licencia por estudio sin poder enviarse — el
    // formulario nunca mandó attachment_url — hasta que alguien apagó
    // requires_attachment en la base y con eso se perdió la exigencia.
    if (
      leaveType.requires_attachment &&
      !requiresLeaveCertificate(leaveType.code) &&
      !parsed.data.attachment_url
    ) {
      return NextResponse.json(
        { error: `${leaveType.name} requiere adjuntar un comprobante` },
        { status: 400 }
      );
    }

    // El día de cumpleaños sólo se puede tomar dentro de su ventana: del día del
    // cumple (o el próximo hábil disponible) hasta 7 días corridos después.
    if (leaveType.code === BIRTHDAY_LEAVE_CODE) {
      if (!auth.employee.birth_date) {
        return NextResponse.json(
          { error: 'No tenés fecha de nacimiento cargada. Escribinos por Consultas para completarla.' },
          { status: 400 },
        );
      }
      if (parsed.data.days_requested > 1) {
        return NextResponse.json({ error: 'El día de cumpleaños es un solo día.' }, { status: 400 });
      }

      const ventana = birthdayWindow({
        birthDate: auth.employee.birth_date,
        year: Number(parsed.data.start_date.slice(0, 4)),
        // Se excluye la propia solicitud que se está creando: todavía no existe.
        busyDays: await busyDaysForEmployee(supabase, auth.employee.id, Number(parsed.data.start_date.slice(0, 4))),
      });

      if (
        !isWithinBirthdayWindow(parsed.data.start_date, ventana) ||
        !isWithinBirthdayWindow(parsed.data.end_date, ventana)
      ) {
        return NextResponse.json(
          {
            error: `El día de cumpleaños se toma entre el ${ventana.start.split('-').reverse().join('/')} y el ${ventana.end
              .split('-')
              .reverse()
              .join('/')}.`,
          },
          { status: 400 },
        );
      }
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

    // Check balance (skip for unlimited / notification-only types)
    const startYear = parseLocalDate(parsed.data.start_date).getFullYear();
    if (!isUnlimitedLeaveType(leaveType.code)) {
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .eq('leave_type_id', parsed.data.leave_type_id)
        .eq('year', startYear)
        .single();

      if (balance) {
        const available =
          balance.entitled_days + (balance.bonus_days ?? 0) + balance.carried_over - balance.used_days - balance.pending_days;
        if (parsed.data.days_requested > available) {
          return NextResponse.json(
            { error: `No tienes suficientes días disponibles. Disponible: ${available}` },
            { status: 400 }
          );
        }
      }
    }

    // Check for overlapping requests (exclude final rejected/cancelled statuses)
    // pow_days and remote_work are allowed to overlap with each other
    const { data: overlapping } = await supabase
      .from('leave_requests')
      .select('id, leave_type_id, leave_types(code)')
      .eq('employee_id', auth.employee.id)
      .not('status', 'in', '("cancelled","rejected","rejected_leader","rejected_hr")')
      .lte('start_date', parsed.data.end_date)
      .gte('end_date', parsed.data.start_date);

    const blockingOverlap = (overlapping ?? []).filter((r) => {
      const lt = r.leave_types;
      const existingCode = (Array.isArray(lt) ? lt[0] : lt as unknown as { code: string } | null)?.code;
      if (
        (leaveType.code === 'pow_days' && existingCode === 'remote_work') ||
        (leaveType.code === 'remote_work' && existingCode === 'pow_days') ||
        (leaveType.code === 'remote_work_trip' && existingCode === 'remote_work') ||
        (leaveType.code === 'remote_work' && existingCode === 'remote_work_trip')
      ) return false;
      return true;
    });

    if (blockingOverlap.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una solicitud que se superpone con estas fechas' },
        { status: 400 }
      );
    }

    // Get employee's manager for two-level approval (not required for HR-only types)
    const hrOnlyApproval = isHrOnlyApprovalType(leaveType.code);

    const { data: employee } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', auth.employee.id)
      .single();

    // El líder es obligatorio sólo cuando hace falta que alguien apruebe. La
    // licencia por enfermedad no se aprueba, así que no lo exige: alguien sin
    // líder cargado igual puede reportar que está enfermo (sólo no se notifica).
    if (!hrOnlyApproval && !selfRegistered && !employee?.manager_id) {
      return NextResponse.json(
        { error: 'No tienes un líder asignado. Contacta a HR para configurar tu manager.' },
        { status: 400 }
      );
    }

    // Create the request:
    //  - self-registered (enfermedad): queda 'approved' (vigente) sin aprobador;
    //    el líder se guarda para notificarlo y para la vista de cobertura.
    //  - HR-only: salta al líder y va directo a 'pending_hr'.
    //  - resto: circuito de dos niveles desde 'pending_leader'.
    const initialStatus = selfRegistered ? 'approved' : hrOnlyApproval ? 'pending_hr' : 'pending_leader';
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: auth.employee.id,
        status: initialStatus,
        leader_id: hrOnlyApproval ? null : employee?.manager_id ?? null,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Los tipos autorregistrados —enfermedad— nacen aprobados y no pasan por
    // ninguna aprobación después: si el evento no se crea acá, no se crea nunca.
    if (initialStatus === 'approved') {
      sincronizarLicencia(data.id).catch((err) => console.error('[calendar] al registrar:', err));
    }

    // Update pending days in balance (skip for unlimited types)
    if (!isUnlimitedLeaveType(leaveType.code)) {
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .eq('leave_type_id', parsed.data.leave_type_id)
        .eq('year', startYear)
        .single();

      if (balance) {
        await supabase
          .from('leave_balances')
          .update({
            pending_days: balance.pending_days + parsed.data.days_requested,
          })
          .eq('id', balance.id);
      } else {
        await supabase.from('leave_balances').insert({
          employee_id: auth.employee.id,
          leave_type_id: parsed.data.leave_type_id,
          year: startYear,
          pending_days: parsed.data.days_requested,
        });
      }
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
      unidad_tiempo: leaveType.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
      tipo_licencia: leaveType.name,
    };

    // Email + in-app to employee: request submitted
    const employeeEmail = auth.employee.work_email || auth.employee.personal_email;
    if (employeeEmail) {
      // La plantilla genérica habla de "solicitud", de revisión del líder y de
      // avisar "cuando esté aprobada". En una licencia auto-registrada nada de
      // eso pasa, así que va una plantilla propia con lo que sí ocurre: quedó
      // vigente, se avisó al líder, y falta el certificado con su fecha límite.
      const certRule = leaveCertRule(leaveType.code);
      const vencimiento =
        selfRegistered && certRule
          ? leaveCertDeadline({
              leaveTypeCode: leaveType.code,
              startDate: parsed.data.start_date,
              endDate: parsed.data.end_date,
            })
          : null;

      sendTimeOffEmail({
        templateKey: selfRegistered ? 'time_off_sick_registered' : 'time_off_request_submitted',
        to: employeeEmail,
        variables: vencimiento
          ? {
              ...emailVariables,
              fecha_vencimiento: formatDate(vencimiento),
              plazo_certificado: String(certRule!.businessDays),
            }
          : emailVariables,
        leaveRequestId: data.id,
      }).catch((err) => console.error('Error sending request submitted email:', err));
    }
    // In-app notification to the employee who submitted
    if (auth.user?.id) {
      const submittedBody = selfRegistered
        ? `Registramos tu ${leaveType.name} del ${emailVariables.fecha_inicio} al ${emailVariables.fecha_fin}. Acordate de subir el certificado médico dentro de los ${leaveCertRule(leaveType.code)?.businessDays ?? 3} días hábiles.`
        : hrOnlyApproval
          ? `Tu solicitud de ${leaveType.name} del ${emailVariables.fecha_inicio} al ${emailVariables.fecha_fin} fue enviada y está pendiente de aprobación de HR.`
          : `Tu solicitud de ${leaveType.name} del ${emailVariables.fecha_inicio} al ${emailVariables.fecha_fin} fue enviada y está pendiente de aprobación de tu líder.`;
      createSystemNotification({
        userIds: [auth.user.id],
        title: selfRegistered ? 'Licencia por enfermedad registrada' : 'Solicitud de licencia enviada',
        body: submittedBody,
        priority: 'info',
        deepLink: '/portal/time-off',
        metadata: { entity_type: 'leave_request', entity_id: data.id },
        dedupeKey: `leave_request:${data.id}:submitted`,
      }).catch((err) => console.error('Error creating employee submission in-app notification:', err));
    }

    if (selfRegistered) {
      // Licencia por enfermedad: al líder se lo NOTIFICA para que organice la
      // cobertura. Ve la ausencia y los días, nunca el motivo ni el certificado.
      if (employee?.manager_id) {
        const managerResult = await withRetry(async () =>
          supabase
            .from('employees')
            .select('first_name, personal_email, work_email, user_id')
            .eq('id', employee.manager_id)
            .single()
        ).catch(() => ({ data: null as null }));
        const manager = managerResult?.data ?? null;

        if (manager) {
          const managerEmail = manager.work_email || manager.personal_email;
          if (managerEmail) {
            sendTimeOffEmail({
              templateKey: 'time_off_sick_leader_notification',
              to: managerEmail,
              variables: {
                nombre_lider: manager.first_name,
                nombre_colaborador: `${auth.employee.first_name} ${auth.employee.last_name}`,
                ...emailVariables,
              },
              leaveRequestId: data.id,
            }).catch((err) => console.error('Error sending sick-leave leader notification email:', err));
          }

          if (manager.user_id) {
            createSystemNotification({
              userIds: [manager.user_id],
              title: 'Licencia por enfermedad en tu equipo',
              body: `${auth.employee.first_name} ${auth.employee.last_name} está de licencia por enfermedad del ${emailVariables.fecha_inicio} al ${emailVariables.fecha_fin} (${parsed.data.days_requested} día(s)).`,
              priority: 'info',
              deepLink: '/portal/team',
              metadata: { entity_type: 'leave_request', entity_id: data.id },
              dedupeKey: `leave_request:${data.id}:sick_leader_notified`,
            }).catch((err) => console.error('Error creating sick-leave leader in-app notification:', err));
          }
        }
      }
    } else if (hrOnlyApproval) {
      // Notify HR directly — no leader step
      const { data: admins } = await supabase.from('admins').select('user_id').limit(5);

      if (admins && admins.length > 0) {
        const adminUserIds = admins.map((a) => a.user_id);
        const { data: hrEmployees } = await supabase
          .from('employees')
          .select('personal_email, work_email')
          .in('user_id', adminUserIds);

        for (const hr of hrEmployees || []) {
          const hrEmail = hr.work_email || hr.personal_email;
          if (hrEmail) {
            sendTimeOffEmail({
              templateKey: 'time_off_hr_notification',
              to: hrEmail,
              variables: {
                nombre_colaborador: `${auth.employee.first_name} ${auth.employee.last_name}`,
                nombre_lider: '—',
                ...emailVariables,
              },
              leaveRequestId: data.id,
            }).catch((err) => console.error('Error sending HR notification email:', err));
          }
        }

        createSystemNotification({
          userIds: adminUserIds,
          title: 'Notificación de trabajo fuera de domicilio',
          body: `${auth.employee.first_name} ${auth.employee.last_name} registró ${parsed.data.days_requested} día(s) de ${leaveType.name} que requiere tu revisión.`,
          priority: 'info',
          deepLink: '/admin/time-off/requests',
          metadata: { entity_type: 'leave_request', entity_id: data.id },
          dedupeKey: `leave_request:${data.id}:pending_hr`,
        }).catch((err) => console.error('Error creating HR in-app notification:', err));
      }
    } else if (employee?.manager_id) {
      // Email to leader: new request to approve (with retry for transient DB failures)
      const managerResult = await withRetry(async () =>
        supabase
          .from('employees')
          .select('first_name, personal_email, work_email, user_id')
          .eq('id', employee.manager_id)
          .single()
      ).catch(() => ({ data: null as null }));
      const manager = managerResult?.data ?? null;

      if (!manager) {
        console.error(
          `[TimeOff] manager_id=${employee.manager_id} not found in employees for leave_request=${data.id}`
        );
        logTimeOffEmail({
          leaveRequestId: data.id,
          recipientEmail: 'unknown',
          templateKey: 'time_off_leader_notification',
          subject: 'ERROR: manager not found',
          body: '',
          error: `manager_id=${employee.manager_id} not found in employees table`,
        }).catch(() => {});
      }

      if (manager) {
        let managerEmail: string | null = manager.work_email || manager.personal_email;

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
          logTimeOffEmail({
            leaveRequestId: data.id,
            recipientEmail: 'unknown',
            templateKey: 'time_off_leader_notification',
            subject: 'ERROR: no email available for leader',
            body: '',
            error: `manager_id=${employee.manager_id} has no work_email, personal_email, or auth email`,
          }).catch(() => {});
        }

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
