/**
 * Link de Google Calendar para que la persona se agende "Fuera de oficina"
 * cuando le aprueban vacaciones o Días Pow.
 *
 * Es un link de plantilla (`action=TEMPLATE`): abre Calendar con el título, las
 * fechas y la descripción cargados, y la persona guarda. Lo hace ella y en su
 * calendario, a propósito: no le escribimos en el calendario a nadie.
 *
 * Esos links sólo arman eventos comunes, marcados como ocupado: la pantalla que
 * abren no deja elegir el tipo "Fuera de la oficina" (probado el 24/11/2026).
 */

import { finExclusivo } from './googleCalendar';

/** Los tipos de licencia que llevan el botón. */
export const TIPOS_CON_FUERA_DE_OFICINA = ['vacation', 'pow_days'] as const;

export function llevaFueraDeOficina(codigo: string | null | undefined): boolean {
  return !!codigo && (TIPOS_CON_FUERA_DE_OFICINA as readonly string[]).includes(codigo);
}

const compacta = (fecha: string) => fecha.replaceAll('-', '');

/**
 * @param desde YYYY-MM-DD, inclusive.
 * @param hasta YYYY-MM-DD, inclusive (Google lo quiere exclusivo: se convierte acá).
 */
export function linkFueraDeOficina(params: {
  tipoLicencia: string;
  desde: string;
  hasta: string;
  fechaInicioTexto: string;
  fechaFinTexto: string;
}): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `Fuera de oficina — ${params.tipoLicencia}`);
  url.searchParams.set('dates', `${compacta(params.desde)}/${compacta(finExclusivo(params.hasta))}`);
  url.searchParams.set(
    'details',
    params.desde === params.hasta
      ? `${params.tipoLicencia}: ${params.fechaInicioTexto}. Aprobado en el portal de Pow.`
      : `${params.tipoLicencia}: del ${params.fechaInicioTexto} al ${params.fechaFinTexto}. Aprobado en el portal de Pow.`,
  );
  // Que figure como ocupado: un evento de día completo es "disponible" por defecto.
  url.searchParams.set('crm', 'BUSY');
  // La barra entre las fechas va literal: es lo que documenta Google.
  return url.toString().replace(/dates=(\d{8})%2F(\d{8})/, 'dates=$1/$2');
}

export const AYUDA_FUERA_DE_OFICINA =
  'Se abre Google Calendar con todo cargado: revisalo y tocá Guardar. Así quien te quiera agendar ve que esos días no estás.';

/**
 * Lo que se le suma al mail de aprobación: el botón y la ayuda, o nada si el
 * tipo de licencia no lo lleva. Se esparce en `sendTimeOffEmail({ ... })`.
 */
export function extrasFueraDeOficina(params: {
  codigo: string | null | undefined;
  tipoLicencia: string;
  desde: string;
  hasta: string;
  fechaInicioTexto: string;
  fechaFinTexto: string;
}): { cta?: { label: string; url: string }; outro?: string } {
  if (!llevaFueraDeOficina(params.codigo)) return {};
  return {
    cta: { label: 'Agendar Fuera de oficina', url: linkFueraDeOficina(params) },
    outro: AYUDA_FUERA_DE_OFICINA,
  };
}
