import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Respuesta "Voy / No voy" a un mensaje de Comunicaciones desde el mail, sin
 * iniciar sesión. Cada botón lleva un link firmado para ese mensaje y esa
 * persona, así nadie puede responder por otro cambiando el id en la URL.
 *
 * La clave sale de RSVP_SECRET y, si no está, de la service role de Supabase
 * (que ya es secreta y existe en todos los entornos). Cambiar cualquiera de las
 * dos invalida los links de los mails ya enviados.
 */
function key(): string {
  const k = process.env.RSVP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('Falta RSVP_SECRET o SUPABASE_SERVICE_ROLE_KEY para firmar las respuestas.');
  return k;
}

export function signRsvp(messageId: string, userId: string): string {
  return createHmac('sha256', key()).update(`rsvp:${messageId}:${userId}`).digest('base64url').slice(0, 32);
}

export function verifyRsvp(messageId: string, userId: string, token: string): boolean {
  const expected = Buffer.from(signRsvp(messageId, userId));
  const given = Buffer.from(String(token ?? ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type RsvpAnswer = 'yes' | 'no';

export function rsvpUrl(appUrl: string, messageId: string, userId: string, answer: RsvpAnswer): string {
  const q = new URLSearchParams({ m: messageId, u: userId, r: answer, t: signRsvp(messageId, userId) });
  return `${appUrl}/rsvp?${q.toString()}`;
}
