/**
 * Formatea una fecha string (YYYY-MM-DD) a formato local sin problemas de timezone.
 * 
 * El problema: new Date("2024-12-31") se interpreta como UTC 00:00,
 * y al convertir a zona horaria local (ej: Argentina UTC-3), 
 * queda en el día anterior (2024-12-30 21:00).
 * 
 * Esta función parsea la fecha correctamente para evitar ese problema.
 */
export function formatDateLocal(dateString: string | null | undefined, locale = 'es-AR'): string {
  if (!dateString) return '';
  
  // Si es solo fecha (YYYY-MM-DD), parseamos manualmente para evitar timezone issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month es 0-indexed
    return date.toLocaleDateString(locale);
  }
  
  // Si tiene hora, usamos el parseo normal
  return new Date(dateString).toLocaleDateString(locale);
}
