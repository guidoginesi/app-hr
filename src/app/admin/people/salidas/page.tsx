import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PeopleLayout } from '../PeopleLayout';
import { SalidasClient, type SalidaConRespuesta } from './SalidasClient';

export const dynamic = 'force-dynamic';

/**
 * Las entrevistas de salida, para leerlas.
 *
 * Hasta ahora las respuestas se guardaban y no había dónde verlas: la encuesta
 * escribía en una tabla que no leía nadie. Esta es esa pantalla.
 *
 * Sólo admin. Administración no entra: acá hay motivos de desvinculación y lo
 * que cada uno opinó de su líder, que no hace falta para conciliar sueldos.
 */
export default async function SalidasPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const supabase = getSupabaseServer();

  // Dos consultas y el cruce en memoria: son las bajas de la empresa, decenas,
  // no miles. Un embed de PostgREST acá sólo agrega una forma rara de fallar.
  const { data: bajas } = await supabase
    .from('employees')
    .select('id, first_name, last_name, job_title, termination_date, termination_reason, offboarding_enabled')
    .eq('status', 'terminated')
    .order('termination_date', { ascending: false });

  const ids = (bajas ?? []).map((b) => b.id);
  const { data: respuestas } = ids.length
    ? await supabase
        .from('offboarding_responses')
        .select('employee_id, status, responses, submitted_at')
        .in('employee_id', ids)
    : { data: [] };

  const porEmpleado = new Map((respuestas ?? []).map((r) => [r.employee_id, r]));

  const salidas: SalidaConRespuesta[] = (bajas ?? []).map((b) => {
    const r = porEmpleado.get(b.id);
    return {
      id: b.id,
      nombre: `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim(),
      puesto: b.job_title ?? null,
      fechaDeBaja: b.termination_date ?? null,
      motivo: b.termination_reason ?? null,
      encuestaHabilitada: !!b.offboarding_enabled,
      contestada: r?.status === 'submitted',
      enviadaEl: r?.submitted_at ?? null,
      respuestas: (r?.responses ?? {}) as Record<string, unknown>,
    };
  });

  return (
    <PeopleLayout active="salidas">
      <SalidasClient salidas={salidas} />
    </PeopleLayout>
  );
}
