// Publicación de los mensajes programados. Corre en el lote de la mañana
// (src/app/api/cron/daily-automations/route.ts).

import { getSupabaseServer } from '@/lib/supabaseServer';
import { publishMessage } from '@/lib/messagePublish';
import { createSystemNotification } from '@/lib/notificationService';

/**
 * Fecha de HOY en Argentina, en formato YYYY-MM-DD.
 *
 * El cron corre a las 09:00 UTC, o sea 06:00 en Argentina, así que la fecha UTC
 * y la local coinciden en ese momento. Igual se calcula explícito: si algún día
 * se mueve el horario del cron a antes de las 03:00 UTC, `new Date()` en UTC
 * daría el día siguiente y los mensajes saldrían con un día de adelanto.
 */
export function todayInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type ScheduledRunResult = {
  publicados: number;
  fallidos: number;
  detalle: { id: string; title: string; ok: boolean; error?: string }[];
};

/**
 * Publica los borradores cuya fecha programada ya llegó.
 *
 * Toma `<=` y no `=` para no perder mensajes: si un día el cron no corre, al día
 * siguiente sale igual en vez de quedar programado para siempre.
 */
export async function publishScheduledMessages(now: Date = new Date()): Promise<ScheduledRunResult> {
  const supabase = getSupabaseServer();
  const hoy = todayInArgentina(now);

  const { data: pendientes, error } = await supabase
    .from('messages')
    .select('id, title, created_by, scheduled_for')
    .eq('status', 'draft')
    .eq('type', 'broadcast')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', hoy)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[scheduled-messages] no se pudieron leer los programados:', error.message);
    return { publicados: 0, fallidos: 0, detalle: [] };
  }

  const result: ScheduledRunResult = { publicados: 0, fallidos: 0, detalle: [] };

  for (const m of pendientes ?? []) {
    const id = m.id as string;
    const title = (m.title as string) ?? '(sin título)';
    const creador = m.created_by as string | null;

    // Sin autor no se puede evaluar el permiso de envío masivo, y publicar sin
    // evaluarlo convertiría la programación en una forma de evadir el gate.
    if (!creador) {
      await marcarFallo(id, 'El mensaje no tiene autor registrado, así que no se puede validar el permiso de envío.', null, title);
      result.fallidos++;
      result.detalle.push({ id, title, ok: false, error: 'sin autor' });
      continue;
    }

    // El permiso se revalida acá y no sólo al programar: si el autor perdió
    // mass_sender entre que programó y hoy, el mensaje no sale.
    const res = await publishMessage(id, creador);

    if (res.ok) {
      result.publicados++;
      result.detalle.push({ id, title, ok: true });
    } else {
      await marcarFallo(id, res.error, creador, title);
      result.fallidos++;
      result.detalle.push({ id, title, ok: false, error: res.error });
    }
  }

  if (result.publicados || result.fallidos) {
    console.log(`[scheduled-messages] publicados: ${result.publicados}, fallidos: ${result.fallidos}`);
  }
  return result;
}

/**
 * Un envío programado que falla no puede quedar reintentándose en silencio todos
 * los días: se limpia la fecha (el mensaje vuelve a ser un borrador común), se
 * deja el motivo en metadata y se avisa a quien lo programó.
 */
async function marcarFallo(messageId: string, motivo: string, creador: string | null, title: string) {
  const supabase = getSupabaseServer();

  const { data: actual } = await supabase.from('messages').select('metadata').eq('id', messageId).single();
  const metadata = { ...((actual?.metadata ?? {}) as Record<string, unknown>) };
  metadata.schedule_error = { at: new Date().toISOString(), reason: motivo };

  await supabase.from('messages').update({ scheduled_for: null, metadata }).eq('id', messageId);

  if (creador) {
    await createSystemNotification({
      userIds: [creador],
      title: 'No se pudo enviar un mensaje programado',
      body: `"${title}" quedó como borrador: ${motivo}`,
      deepLink: '/admin/messages',
      // Sin sufijo el dedupe de createSystemNotification matchea sobre todo el
      // historial y un segundo fallo del mismo mensaje no avisaría nunca.
      dedupeKey: `schedule-error-${messageId}-${Date.now()}`,
    });
  }
}
