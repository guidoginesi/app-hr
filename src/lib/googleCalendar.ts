/**
 * Cliente mínimo de Google Calendar, para el calendario compartido del equipo.
 *
 * Va con una **service account** y sin delegación a nivel dominio: como los
 * eventos viven en un calendario secundario compartido y no invitamos a nadie,
 * alcanza con compartir ese calendario con el mail de la service account dándole
 * "Hacer cambios en los eventos". Es la diferencia entre pedirle dos clics a
 * alguien y pedirle acceso a los calendarios de toda la empresa.
 *
 * Sin las variables configuradas no hace nada y lo dice una vez. Que el
 * calendario no esté enchufado no puede romper una aprobación de licencia: el
 * evento es un reflejo de la licencia, no al revés.
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export type EventoDeCalendario = {
  titulo: string;
  descripcion: string;
  /** YYYY-MM-DD, inclusive. */
  desde: string;
  /** YYYY-MM-DD, inclusive: acá se convierte al fin exclusivo que espera Google. */
  hasta: string;
};

type Config = { calendarId: string; email: string; clave: string };

let avisoDeFaltante = false;

function configuracion(): Config | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // En Vercel la clave viaja con los saltos de línea escapados.
  const clave = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');

  if (!calendarId || !email || !clave) {
    if (!avisoDeFaltante) {
      console.warn('[calendar] sin GOOGLE_CALENDAR_ID / _SERVICE_ACCOUNT_EMAIL / _SERVICE_ACCOUNT_KEY: no se sincroniza');
      avisoDeFaltante = true;
    }
    return null;
  }
  return { calendarId, email, clave };
}

export function calendarioConfigurado(): boolean {
  return configuracion() !== null;
}

function base64url(dato: string | Buffer): string {
  return Buffer.from(dato).toString('base64url');
}

/**
 * Token de acceso, cacheado hasta poco antes de vencer. Se pide uno por proceso
 * y no uno por licencia: el token dura una hora y firmarlo cuesta.
 */
let cache: { token: string; vence: number } | null = null;

async function token(cfg: Config): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.vence > ahora + 60) return cache.token;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: cfg.email, scope: SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 }),
  );
  const firma = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(cfg.clave);
  const jwt = `${header}.${claims}.${base64url(firma)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`No se pudo autenticar contra Google: ${data.error_description ?? res.status}`);
  }

  cache = { token: data.access_token, vence: ahora + (data.expires_in ?? 3600) };
  return data.access_token;
}

/**
 * Google trata el fin de un evento de día completo como **exclusivo**: una
 * licencia del 17 al 23 se publica como 17 → 24. Exportada porque es el error
 * de un día que nadie ve hasta que alguien vuelve un día antes de lo que dice
 * el calendario.
 */
export function finExclusivo(hasta: string): string {
  const d = new Date(`${hasta}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function cuerpo(evento: EventoDeCalendario) {
  return {
    summary: evento.titulo,
    description: evento.descripcion,
    start: { date: evento.desde },
    end: { date: finExclusivo(evento.hasta) },
    transparency: 'transparent',
    // Que se pueda distinguir de lo que carga alguien a mano en el calendario.
    source: { title: 'app-hr', url: 'https://hr.pow-apps.com/admin/time-off/requests' },
  };
}

async function llamar(cfg: Config, ruta: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(cfg.calendarId)}${ruta}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await token(cfg)}`, 'Content-Type': 'application/json' },
  });
  return res;
}

/** Devuelve el id del evento creado, o null si el calendario no está configurado. */
export async function crearEvento(evento: EventoDeCalendario): Promise<string | null> {
  const cfg = configuracion();
  if (!cfg) return null;

  const res = await llamar(cfg, '/events', { method: 'POST', body: JSON.stringify(cuerpo(evento)) });
  if (!res.ok) throw new Error(`No se pudo crear el evento (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Actualiza un evento. Si Google contesta que ya no existe —alguien lo borró a
 * mano— devuelve false para que quien llama lo vuelva a crear en vez de dejar
 * la licencia apuntando a un evento fantasma.
 */
export async function actualizarEvento(eventId: string, evento: EventoDeCalendario): Promise<boolean> {
  const cfg = configuracion();
  if (!cfg) return true;

  const res = await llamar(cfg, `/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify(cuerpo(evento)),
  });
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new Error(`No se pudo actualizar el evento (${res.status}): ${await res.text()}`);
  return true;
}

/** Borrar algo que ya no está no es un error: el resultado buscado es el mismo. */
export async function borrarEvento(eventId: string): Promise<void> {
  const cfg = configuracion();
  if (!cfg) return;

  const res = await llamar(cfg, `/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`No se pudo borrar el evento (${res.status}): ${await res.text()}`);
  }
}
