// Módulos del admin que muestran bullet de novedades.
//
// Este archivo NO importa nada del server: lo consume el sidebar, que es un
// componente de cliente, y arrastrar acá el cliente de Supabase metería la
// service role key en el bundle del navegador. Los conteos viven en
// adminPending.ts.

export const ADMIN_MODULES = [
  'time-off',
  'reintegros',
  'adelantos',
  'capacitaciones',
  'consultas',
  'reclutamiento',
  'referidos',
  'recibos',
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

/** Ruta base de cada módulo, para saber cuál se está mirando. */
export const MODULE_PATHS: Record<AdminModule, string[]> = {
  'time-off': ['/admin/time-off'],
  reintegros: ['/admin/reintegros'],
  adelantos: ['/admin/salary-advances'],
  capacitaciones: ['/admin/training'],
  consultas: ['/admin/consultas'],
  reclutamiento: ['/admin/recruiting', '/admin/jobs', '/admin/candidates'],
  referidos: ['/admin/referidos'],
  recibos: ['/admin/recibos'],
};

export function moduleForPath(pathname: string): AdminModule | null {
  for (const [key, paths] of Object.entries(MODULE_PATHS) as [AdminModule, string[]][]) {
    if (paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return key;
  }
  return null;
}

export type PendingCounts = Record<AdminModule, number>;
