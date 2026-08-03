// Roles y accesos: metadata de cada rol y las barandas de la gestión.
//
// Distinción clave: hay roles que se OTORGAN (filas en `user_roles`) y roles que
// se DERIVAN de los datos. `employee` sale de tener ficha de empleado y `leader`
// de tener reportes directos (ver checkIsLeader en checkAuth.ts): otorgarlos a
// mano no haría nada, así que la pantalla los muestra como información y no
// como algo que se pueda tocar.

export type ManageableRole = 'admin' | 'administracion' | 'mass_sender';

export const MANAGEABLE_ROLES: ManageableRole[] = ['admin', 'administracion', 'mass_sender'];

/** Roles cuyo alcance justifica cerrarle las sesiones al revocarlos. */
export const ELEVATED_ROLES: ManageableRole[] = ['admin', 'administracion'];

type RoleInfo = {
  label: string;
  /** Qué habilita, en concreto. Es lo que lee quien está por otorgarlo. */
  grants: string;
  /** Lo que NO habilita, cuando la confusión es probable. */
  limits?: string;
  tone: 'danger' | 'warning' | 'neutral';
};

export const ROLE_INFO: Record<ManageableRole, RoleInfo> = {
  admin: {
    label: 'Admin completo',
    grants:
      'Acceso total al panel: sueldos y liquidaciones con montos, recibos, evaluaciones, objetivos, capacitaciones y esta misma configuración.',
    tone: 'danger',
  },
  administracion: {
    label: 'Administración',
    grants:
      'Aprueba adelantos de sueldo y ve el estado de recepción de recibos (quién confirmó y quién no).',
    limits: 'No ve montos de sueldos ni el resto del panel: el middleware lo limita a Adelantos y Recepción de recibos.',
    tone: 'warning',
  },
  mass_sender: {
    label: 'Envío masivo',
    grants:
      'Publica mensajes a audiencias amplias: toda la empresa, por rol o por tipo de contrato.',
    limits: 'Sin este permiso igual puede mandar mensajes, pero sólo a personas elegidas una por una.',
    tone: 'neutral',
  },
};

/** Roles que se derivan de los datos y no se pueden otorgar. */
export const DERIVED_ROLE_INFO: Record<'employee' | 'leader', { label: string; source: string }> = {
  employee: { label: 'Colaborador', source: 'Lo tiene por tener ficha de empleado activa.' },
  leader: { label: 'Líder', source: 'Lo tiene por tener personas a cargo.' },
};

export function isManageableRole(role: string): role is ManageableRole {
  return (MANAGEABLE_ROLES as string[]).includes(role);
}

/**
 * El middleware cachea los roles en una cookie por 5 minutos
 * (ROLE_CACHE_DURATION en src/middleware.ts), así que TODO cambio de rol tarda
 * hasta ese tiempo en verse — incluida la revocación.
 *
 * Nota para quien siga esto: no alcanza con cerrarle la sesión desde el
 * servidor. `auth.admin.signOut()` de supabase-js espera el JWT de una sesión
 * activa, no un user_id, y no hay API para invalidar las sesiones de otra
 * persona. Si algún día hace falta que la revocación sea instantánea, el camino
 * es que el middleware no cachee los roles elevados, no intentar cerrar sesiones.
 */
export const ROLE_CACHE_MINUTES = 5;

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

/**
 * Barandas de la revocación. Las dos primeras evitan quedarse sin acceso:
 * sin ellas, un click deja a la empresa afuera del panel y hay que volver a
 * entrar por la base de datos.
 */
export function canRevoke(input: {
  role: ManageableRole;
  targetUserId: string;
  actorUserId: string;
  totalAdmins: number;
}): GuardrailResult {
  const { role, targetUserId, actorUserId, totalAdmins } = input;

  if (role === 'admin') {
    if (targetUserId === actorUserId) {
      return { ok: false, reason: 'No podés quitarte tu propio rol de admin: quedarías sin acceso al panel.' };
    }
    if (totalAdmins <= 1) {
      return { ok: false, reason: 'Es el único admin que queda. Asigná otro antes de quitarle el rol.' };
    }
  }

  return { ok: true };
}
