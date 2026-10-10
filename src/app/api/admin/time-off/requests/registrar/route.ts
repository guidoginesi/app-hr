import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { isUnlimitedLeaveType, isHrOnlyApprovalType, puedenSuperponerse } from '@/lib/leaveTypes';
import { argentinaDay } from '@/lib/leaveCertificates';
import { parseLocalDate } from '@/lib/dateUtils';
import { disponibleParaPedido } from '@/lib/saldoEntreAnios';
import { MARCA_DE_TRASPASO, PRIMER_TRASPASO_AUTOMATICO } from '@/lib/traspasoDeAnio';
import { calculateEntitledDays } from '@/lib/leaveBalanceCalculation';
import { sincronizarLicencia } from '@/lib/leaveCalendar';
import { duracionDeLicencia, fechaIso, semanaIso } from '@/lib/registroDeLicencia';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fecha = /^\d{4}-\d{2}-\d{2}$/;

const RegistroSchema = z.object({
  employee_id: z.string().regex(uuid, 'Elegí a la persona'),
  leave_type_id: z.string().regex(uuid, 'Elegí el tipo de licencia'),
  start_date: z.string().regex(fecha, 'Fecha de inicio inválida'),
  end_date: z.string().regex(fecha, 'Fecha de fin inválida'),
  motivo: z.string().trim().min(3, 'Contá por qué se registra desde el admin').max(500),
});

/**
 * POST /api/admin/time-off/requests/registrar
 *
 * RRHH registra una licencia en nombre de alguien: una que ya se tomó y no se
 * pudo cargar a tiempo, o una que el portal no deja pedir. Es la única forma de
 * cargar un día que ya pasó: el portal no acepta fechas pasadas.
 *
 * Valida lo mismo que el pedido del portal (saldo con la bolsa entre años,
 * superposición, semanas remotas de lunes a domingo, cumpleaños de un día),
 * salvo la anticipación. Nace aprobada, descuenta de lo usado y no manda mails
 * ni notificaciones: quien la registra ya habló con la persona.
 */
export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = RegistroSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(', ') }, { status: 400 });
  }
  const { employee_id, leave_type_id, start_date, end_date, motivo } = parsed.data;
  if (end_date < start_date) {
    return NextResponse.json({ error: 'La fecha de fin tiene que ser igual o posterior a la de inicio' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const hoy = argentinaDay();
  const anioActual = Number(hoy.slice(0, 4));
  const anioPedido = Number(start_date.slice(0, 4));

  const [{ data: empleado }, { data: tipo }, { data: admin }, filas, traspaso, { data: superpuestas }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, hire_date, is_studying, status')
      .eq('id', employee_id)
      .maybeSingle(),
    supabase.from('leave_types').select('id, code, name, count_type, is_active').eq('id', leave_type_id).maybeSingle(),
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('leave_balances')
      .select('id, year, entitled_days, carried_over, bonus_days, used_days, pending_days')
      .eq('employee_id', employee_id)
      .eq('leave_type_id', leave_type_id)
      .in('year', [...new Set([anioPedido, anioActual - 1, anioActual, anioActual + 1])]),
    anioActual >= PRIMER_TRASPASO_AUTOMATICO
      ? supabase
          .from('automation_log')
          .select('id')
          .eq('employee_id', employee_id)
          .eq('template_key', MARCA_DE_TRASPASO)
          .eq('triggered_year', anioActual)
          .maybeSingle()
      : Promise.resolve({ data: { id: 'manual' }, error: null }),
    supabase
      .from('leave_requests')
      .select('leave_types(code)')
      .eq('employee_id', employee_id)
      .not('status', 'in', '("cancelled","rejected","rejected_leader","rejected_hr")')
      .lte('start_date', end_date)
      .gte('end_date', start_date),
  ]);

  if (!empleado || empleado.status !== 'active') {
    return NextResponse.json({ error: 'La persona no está activa' }, { status: 400 });
  }
  if (!tipo || !tipo.is_active) {
    return NextResponse.json({ error: 'Ese tipo de licencia no está activo' }, { status: 400 });
  }
  if (filas.error || traspaso.error) {
    return NextResponse.json({ error: 'No se pudo leer el saldo. Probá de nuevo en un rato.' }, { status: 500 });
  }

  const dias = duracionDeLicencia(tipo.count_type, start_date, end_date);
  if (dias <= 0) {
    return NextResponse.json({ error: 'Las fechas elegidas no tienen días para descontar' }, { status: 400 });
  }
  if (tipo.code === 'remote_work' && (parseLocalDate(start_date).getDay() !== 1 || parseLocalDate(end_date).getDay() !== 0)) {
    return NextResponse.json({ error: 'El trabajo remoto va en semanas completas, de lunes a domingo' }, { status: 400 });
  }
  if (tipo.code === 'birthday' && dias > 1) {
    return NextResponse.json({ error: 'El día de cumpleaños es un solo día' }, { status: 400 });
  }

  const derechoDe = (anio: number) =>
    tipo.code === 'birthday'
      ? 1
      : calculateEntitledDays(tipo.code, { hire_date: empleado.hire_date, is_studying: empleado.is_studying }, anio, parseLocalDate(hoy));
  const saldo = (filas.data ?? []).find((f) => f.year === anioPedido);

  if (!isUnlimitedLeaveType(tipo.code)) {
    const disponible = disponibleParaPedido({
      codigo: tipo.code,
      anioVigente: traspaso.data ? anioActual : anioActual - 1,
      anioPedido,
      saldos: Object.fromEntries((filas.data ?? []).map((f) => [f.year, f])),
      derechoDe,
    });
    if (dias > disponible) {
      return NextResponse.json(
        { error: `A ${empleado.first_name} no le alcanza el saldo: tiene ${Math.max(0, disponible)} y esto son ${dias}` },
        { status: 400 },
      );
    }
  }

  const bloquea = (superpuestas ?? []).some((r) => {
    const lt = r.leave_types as unknown as { code: string } | { code: string }[] | null;
    return !puedenSuperponerse(tipo.code, (Array.isArray(lt) ? lt[0] : lt)?.code);
  });
  if (bloquea) {
    return NextResponse.json({ error: `${empleado.first_name} ya tiene una licencia en esas fechas` }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const aprobador = admin?.id ?? null;
  const { data: creada, error } = await supabase
    .from('leave_requests')
    .insert({
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      days_requested: dias,
      status: 'approved',
      notes: `Registrado por RRHH: ${motivo}`,
      // Igual que cuando RRHH aprueba salteando al líder: el paso del líder
      // queda a nombre de quien registra.
      leader_id: isHrOnlyApprovalType(tipo.code) ? null : aprobador,
      leader_approved_at: isHrOnlyApprovalType(tipo.code) ? null : ahora,
      approved_by: aprobador,
      approved_at: ahora,
      hr_approved_by: aprobador,
      hr_approved_at: ahora,
    })
    .select('id')
    .single();
  if (error || !creada) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo registrar la licencia' }, { status: 500 });
  }

  // Descuenta de lo usado del año en que empieza, como cualquier licencia
  // aprobada. Si falla, la solicitud se borra: sin el saldo movido, quedaría un
  // día tomado que no le resta a nadie.
  if (!isUnlimitedLeaveType(tipo.code)) {
    // El filtro por used_days evita pisar otro movimiento que haya entrado
    // entre la lectura y acá: si no matchea ninguna fila, se trata como falla.
    const { data: movidas, error: saldoError } = saldo
      ? await supabase
          .from('leave_balances')
          .update({ used_days: Number(saldo.used_days) + dias })
          .eq('id', saldo.id)
          .eq('used_days', saldo.used_days)
          .select('id')
      : await supabase
          .from('leave_balances')
          .insert({
            employee_id,
            leave_type_id,
            year: anioPedido,
            // El cumpleaños también nace con su día: si no, la fila queda en
            // negativo hasta que lo acredite el cron, que sólo fija el 1.
            entitled_days: derechoDe(anioPedido),
            used_days: dias,
            pending_days: 0,
          })
          .select('id');
    if (saldoError || !movidas?.length) {
      await supabase.from('leave_requests').delete().eq('id', creada.id);
      return NextResponse.json({ error: 'No se pudo descontar el saldo. Probá de nuevo.' }, { status: 500 });
    }
  }

  if (tipo.code === 'remote_work') {
    const semanas = [];
    for (const lunes = parseLocalDate(start_date); fechaIso(lunes) <= end_date; lunes.setDate(lunes.getDate() + 7)) {
      const domingo = new Date(lunes);
      domingo.setDate(domingo.getDate() + 6);
      semanas.push({
        employee_id,
        year: lunes.getFullYear(),
        week_number: semanaIso(lunes),
        week_start_date: fechaIso(lunes),
        week_end_date: fechaIso(domingo),
        leave_request_id: creada.id,
      });
    }
    await supabase.from('remote_work_weeks').insert(semanas);
  }

  after(() => sincronizarLicencia(creada.id).catch((err) => console.error('[calendar] al registrar desde el admin:', err)));

  return NextResponse.json({ id: creada.id, dias });
}
