/**
 * Reflejo de las licencias aprobadas en el calendario compartido del equipo.
 *
 * Hay una sola función pública, `sincronizarLicencia`, y todas las rutas que
 * tocan una licencia la llaman después de guardar. Es un **reconciliador**, no
 * un "crear evento": mira cómo está la licencia hoy y deja el calendario igual,
 * cree, actualice o borre. Así aprobar, cancelar, cambiar fechas y el backfill
 * son la misma llamada, y llamarla dos veces no duplica nada.
 *
 * Nunca se hace `await` de esto en el camino del usuario ni se deja que su error
 * suba: si Google está caído, la licencia igual se aprueba. Lo que queda mal es
 * el calendario, y para eso está `calendar_synced_at`.
 */

import { getSupabaseServer } from '@/lib/supabaseServer';
import { TIPOS_SINCRONIZABLES, textoDelEvento } from '@/lib/leaveCalendarText';
import { crearEvento, actualizarEvento, borrarEvento, type EventoDeCalendario } from '@/lib/googleCalendar';

type Fila = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  google_event_id: string | null;
  leave_type_code: string;
  leave_type_name: string;
  count_type: string;
  employee_name: string;
};

function evento(fila: Fila): EventoDeCalendario {
  const { titulo, descripcion } = textoDelEvento(fila);
  return { titulo, descripcion, desde: fila.start_date, hasta: fila.end_date };
}

/** Sólo las aprobadas y de un tipo que se publica. Todo lo demás sale del calendario. */
function deberiaEstarEnElCalendario(fila: Fila): boolean {
  return fila.status === 'approved' && TIPOS_SINCRONIZABLES.includes(fila.leave_type_code);
}

export type ResultadoDeSincronizacion = 'creado' | 'actualizado' | 'borrado' | 'sin_cambios';

/**
 * Deja el calendario de acuerdo con la licencia. Idempotente.
 *
 * Desde una ruta va sin await:
 *   sincronizarLicencia(id).catch((e) => console.error('[calendar]', e));
 */
export async function sincronizarLicencia(requestId: string): Promise<ResultadoDeSincronizacion> {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('leave_requests_with_details')
    .select(
      'id, status, start_date, end_date, days_requested, google_event_id, leave_type_code, leave_type_name, count_type, employee_name',
    )
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la licencia ${requestId}: ${error.message}`);
  if (!data) return 'sin_cambios';

  const fila = data as unknown as Fila;
  const ahora = new Date().toISOString();

  // Ya no corresponde que esté: se borra y se olvida el id.
  if (!deberiaEstarEnElCalendario(fila)) {
    if (!fila.google_event_id) return 'sin_cambios';
    await borrarEvento(fila.google_event_id);
    await supabase
      .from('leave_requests')
      .update({ google_event_id: null, calendar_synced_at: ahora })
      .eq('id', requestId);
    return 'borrado';
  }

  // Corresponde y ya está: se actualiza, por si cambiaron las fechas o el nombre.
  if (fila.google_event_id) {
    const seguiaAhi = await actualizarEvento(fila.google_event_id, evento(fila));
    if (seguiaAhi) {
      await supabase.from('leave_requests').update({ calendar_synced_at: ahora }).eq('id', requestId);
      return 'actualizado';
    }
    // Lo borraron a mano en Google: se cae al alta de abajo, en vez de quedar
    // apuntando para siempre a un evento que no existe.
  }

  const eventId = await crearEvento(evento(fila));
  if (!eventId) return 'sin_cambios'; // el calendario no está configurado

  await supabase
    .from('leave_requests')
    .update({ google_event_id: eventId, calendar_synced_at: ahora })
    .eq('id', requestId);
  return 'creado';
}
