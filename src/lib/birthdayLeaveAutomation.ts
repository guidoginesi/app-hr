// Acreditación y vencimiento automáticos del día de cumpleaños.
//
// El cron es el dueño de este saldo, a diferencia del resto de las licencias
// donde el derecho anual sale de calculateEntitledDays. La razón: el día sólo
// se puede tomar dentro de una ventana corta. Si el derecho fuera un "1" fijo
// todo el año, alguien fuera de su ventana vería un día disponible que no puede
// usar, y el saldo estaría mintiendo.
//
// Corre todos los días, no sólo el 1°: si el cron falla un día, al siguiente
// recupera. La idempotencia la da automation_log (una acreditación por persona
// y año) y, en el vencimiento, que sólo toca saldos que siguen sin usar.

import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderPlainTemplate } from '@/lib/email/layout';
import { createSystemNotification } from '@/lib/notificationService';
import {
  BIRTHDAY_LEAVE_CODE,
  birthdayInYear,
  birthdayWindow,
  qualifiesForBirthdayLeave,
} from '@/lib/birthdayLeave';

const LOG_KEY = 'birthday_leave_credit';

function argentinaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Días en los que la persona ya está ausente por una licencia aprobada. */
async function busyDaysFor(employeeId: string, year: number): Promise<Set<string>> {
  const supabase = getSupabaseServer();
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

export async function runBirthdayLeaveAutomation(): Promise<{
  acreditados: string[];
  vencidos: string[];
  errores: string[];
}> {
  const supabase = getSupabaseServer();
  const acreditados: string[] = [];
  const vencidos: string[] = [];
  const errores: string[] = [];

  const hoy = argentinaDay();
  const year = Number(hoy.slice(0, 4));
  const mesActual = hoy.slice(5, 7);

  const { data: tipo } = await supabase
    .from('leave_types')
    .select('id')
    .eq('code', BIRTHDAY_LEAVE_CODE)
    .maybeSingle();
  if (!tipo) {
    errores.push('No existe el tipo de licencia "birthday": ¿falta aplicar la migración?');
    return { acreditados, vencidos, errores };
  }
  const tipoId = tipo.id as string;

  const { data: empleados, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, birth_date, hire_date, work_email, personal_email, user_id')
    .eq('status', 'active')
    .not('birth_date', 'is', null);
  if (error) {
    errores.push(`No se pudieron leer los empleados: ${error.message}`);
    return { acreditados, vencidos, errores };
  }

  for (const emp of empleados ?? []) {
    const nombre = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
    try {
      const cumple = birthdayInYear(emp.birth_date as string, year);
      const esSuMes = cumple.slice(5, 7) === mesActual;

      // ── ACREDITACIÓN: durante el mes del cumpleaños ──────────────────
      if (esSuMes) {
        const corresponde = qualifiesForBirthdayLeave({
          birthDate: emp.birth_date as string,
          hireDate: emp.hire_date as string,
          year,
        });
        if (!corresponde) continue;

        const { data: yaAcreditado } = await supabase
          .from('automation_log')
          .select('id')
          .eq('employee_id', emp.id)
          .eq('template_key', LOG_KEY)
          .eq('triggered_year', year)
          .maybeSingle();
        if (yaAcreditado) continue;

        const ventana = birthdayWindow({
          birthDate: emp.birth_date as string,
          year,
          busyDays: await busyDaysFor(emp.id as string, year),
        });

        // upsert: si la fila del saldo no existe se crea, y si existe se le
        // fija el derecho sin pisar lo usado.
        const { data: existente } = await supabase
          .from('leave_balances')
          .select('id')
          .eq('employee_id', emp.id)
          .eq('leave_type_id', tipoId)
          .eq('year', year)
          .maybeSingle();

        const saldoError = existente
          ? (await supabase.from('leave_balances').update({ entitled_days: 1 }).eq('id', existente.id)).error
          : (
              await supabase.from('leave_balances').insert({
                employee_id: emp.id,
                leave_type_id: tipoId,
                year,
                entitled_days: 1,
                used_days: 0,
                pending_days: 0,
                carried_over: 0,
              })
            ).error;
        if (saldoError) throw new Error(saldoError.message);

        await supabase.from('automation_log').insert({
          employee_id: emp.id,
          template_key: LOG_KEY,
          triggered_year: year,
          metadata: { ventana_desde: ventana.start, ventana_hasta: ventana.end },
        });

        // Aviso: mail + campanita. El saludo del cumpleaños va aparte, el día
        // exacto; esto avisa que el beneficio ya está disponible.
        const to = (emp.work_email as string) || (emp.personal_email as string);
        const firstName = (emp.first_name as string)?.split(' ')[0] || nombre;
        if (to) {
          const { data: tpl } = await supabase
            .from('email_templates')
            .select('subject, body, is_active')
            .eq('template_key', 'birthday_leave_available')
            .maybeSingle();

          if (tpl?.is_active) {
            const vars: Record<string, string> = {
              firstName,
              ventanaDesde: formatearFecha(ventana.start),
              ventanaHasta: formatearFecha(ventana.end),
            };
            const reemplazar = (t: string) =>
              Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v), t);
            const subject = reemplazar(tpl.subject as string);
            await sendSimpleEmail({
              to,
              subject,
              html: renderPlainTemplate({
                templateKey: 'birthday_leave_available',
                subject,
                body: reemplazar(tpl.body as string),
              }),
            });
          }
        }

        if (emp.user_id) {
          await createSystemNotification({
            userIds: [emp.user_id as string],
            title: '🎂 Tenés tu día de cumpleaños disponible',
            body: `Podés tomarlo entre el ${formatearFecha(ventana.start)} y el ${formatearFecha(ventana.end)}. Se carga desde Time Off, con el tipo "Día de cumpleaños".`,
            priority: 'info',
            deepLink: '/portal/time-off/new',
            dedupeKey: `birthday_leave:${emp.id}:${year}`,
          }).catch(() => {});
        }

        acreditados.push(nombre);
        continue;
      }

      // ── VENCIMIENTO: pasada la ventana y sin usar ────────────────────
      const ventana = birthdayWindow({
        birthDate: emp.birth_date as string,
        year,
        busyDays: await busyDaysFor(emp.id as string, year),
      });
      if (hoy <= ventana.end) continue;

      const { data: saldo } = await supabase
        .from('leave_balances')
        .select('id, entitled_days, used_days, pending_days')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', tipoId)
        .eq('year', year)
        .maybeSingle();

      // Sólo se vence lo que sigue intacto: si lo tomó o está pendiente de
      // aprobación, el día ya está comprometido y tocarlo dejaría el saldo en
      // negativo.
      if (!saldo || Number(saldo.entitled_days) === 0) continue;
      if (Number(saldo.used_days) > 0 || Number(saldo.pending_days) > 0) continue;

      const { error: vencError } = await supabase
        .from('leave_balances')
        .update({ entitled_days: 0 })
        .eq('id', saldo.id);
      if (vencError) throw new Error(vencError.message);
      vencidos.push(nombre);
    } catch (e) {
      errores.push(`${nombre}: ${e instanceof Error ? e.message : 'error inesperado'}`);
    }
  }

  return { acreditados, vencidos, errores };
}
