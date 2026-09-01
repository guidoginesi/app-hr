import { getSupabaseServer } from '@/lib/supabaseServer';
import { esAusencia } from '@/lib/leaveTypes';

/**
 * Días del año en que la persona está efectivamente fuera del trabajo.
 *
 * Se usa para correr la ventana del día de cumpleaños: si el cumple cae en un
 * día en que no está, la ventana arranca cuando vuelve.
 *
 * El trabajo remoto NO cuenta. La persona está trabajando, sólo que desde otro
 * lado, así que puede tomarse el día igual. Contarlo empujaba la ventana de
 * quien cumple durante una semana remota, que es justo lo contrario de lo que la
 * regla quiere proteger.
 *
 * Vive en su propio módulo porque lo necesitan dos lugares —el cron que acredita
 * el día y la validación al pedirlo— y antes estaba escrito dos veces.
 */
export async function diasAusenteEnElAnio(employeeId: string, year: number): Promise<Set<string>> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('leave_requests_with_details')
    .select('start_date, end_date, leave_type_code')
    .eq('employee_id', employeeId)
    .in('status', ['approved', 'pending_hr', 'pending_leader'])
    .gte('end_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`);

  const set = new Set<string>();
  for (const r of data ?? []) {
    if (!esAusencia(r.leave_type_code as string)) continue;
    const d = new Date(`${r.start_date}T00:00:00Z`);
    const fin = new Date(`${r.end_date}T00:00:00Z`);
    while (d <= fin) {
      set.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return set;
}
