/**
 * Caché de roles firmado, para el middleware.
 *
 * La cookie la manda el cliente, así que su contenido es tan confiable como
 * cualquier otro input. Sin firma, cualquiera podía mandar `roles: ["admin"]` y
 * pasar el redirect del middleware. Eso hoy no alcanzaba para ver datos —todas
 * las rutas de /api/admin revalidan contra la base— pero esa garantía dependía
 * de que cada ruta nueva se acuerde de chequear, y eso no es una garantía: es
 * una costumbre.
 *
 * Dos decisiones:
 *
 * - **Sin secreto no hay caché.** Si `ROLE_CACHE_SECRET` no está configurada, no
 *   se lee ni se escribe: se consulta la base en cada request. Más lento y
 *   correcto, en vez de rápido y crédulo.
 * - **El userId va adentro de lo firmado.** Si no, una cookie válida se podría
 *   mover de una persona a otra cambiándole el nombre.
 *
 * Va con Web Crypto y no con `node:crypto` porque el middleware corre en Edge.
 */

export type CachedRoles = {
  roles: string[];
  employeeId: string | null;
  hasDirectReports: boolean;
  timestamp: number;
};

/** Cinco minutos: un cambio de rol tarda a lo sumo eso en aplicarse. */
export const ROLE_CACHE_DURATION = 5 * 60 * 1000;

export function getRoleCacheKey(userId: string): string {
  return `hr_roles_${userId}`;
}

const enc = new TextEncoder();

function aBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(txt: string): Uint8Array<ArrayBuffer> {
  const b64 = txt.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(txt.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function clave(secreto: string | undefined): Promise<CryptoKey | null> {
  if (!secreto) return null;
  return crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

/** `<payload>.<firma>`, o null si no hay secreto — en cuyo caso no se cachea. */
export async function firmarCache(
  datos: CachedRoles,
  userId: string,
  secreto = process.env.ROLE_CACHE_SECRET,
): Promise<string | null> {
  const key = await clave(secreto);
  if (!key) return null;
  const payload = aBase64Url(enc.encode(JSON.stringify({ ...datos, uid: userId })));
  const firma = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payload}.${aBase64Url(new Uint8Array(firma))}`;
}

/**
 * Lee la cookie: verifica la firma, después el dueño, después la forma, después
 * la antigüedad. Cualquier cosa rara devuelve null y el middleware relee de la
 * base y reescribe la cookie — así una cookie corrupta se arregla sola en vez de
 * dejar a alguien afuera hasta que se le ocurra borrarla a mano.
 */
export async function leerCache(
  cookie: string | undefined,
  userId: string,
  secreto = process.env.ROLE_CACHE_SECRET,
): Promise<CachedRoles | null> {
  if (!cookie) return null;
  const key = await clave(secreto);
  if (!key) return null;

  try {
    const [payload, firma] = cookie.split('.');
    if (!payload || !firma) return null;

    // La firma primero: lo que no está firmado no merece ni que se lo parsee.
    const valida = await crypto.subtle.verify('HMAC', key, deBase64Url(firma), enc.encode(payload));
    if (!valida) return null;

    const parsed = JSON.parse(new TextDecoder().decode(deBase64Url(payload))) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const c = parsed as Partial<CachedRoles> & { uid?: unknown };
    // Firmada para otra persona: no sirve para esta.
    if (c.uid !== userId) return null;

    const formaValida =
      Array.isArray(c.roles) &&
      c.roles.every((r) => typeof r === 'string') &&
      (c.employeeId === null || typeof c.employeeId === 'string') &&
      typeof c.hasDirectReports === 'boolean' &&
      typeof c.timestamp === 'number';
    if (!formaValida) return null;

    if (Date.now() - (c.timestamp as number) < ROLE_CACHE_DURATION) {
      return { roles: c.roles!, employeeId: c.employeeId!, hasDirectReports: c.hasDirectReports!, timestamp: c.timestamp! };
    }
  } catch {
    // Base64 o JSON inválidos: se ignora y se relee de la base.
  }
  return null;
}
