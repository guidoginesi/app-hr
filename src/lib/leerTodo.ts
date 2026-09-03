/**
 * Leer una tabla entera, sin quedarse en la primera página.
 *
 * PostgREST corta las respuestas en 1000 filas y no avisa: una consulta sin
 * `.range()` devuelve las primeras mil como si fueran todas. Una pantalla que
 * filtra en memoria sobre eso no muestra "pocos resultados", muestra resultados
 * equivocados — y sin ningún síntoma, porque la lista se ve llena.
 *
 * Pasó de verdad: la lista de candidatos traía 1000 de 1435, así que buscar por
 * mail a alguien que se había postulado hacía unos meses no encontraba nada.
 */

/** Lo único que se necesita del query builder de Supabase. */
type Consulta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Tamaño de página. Debajo del tope de PostgREST para que el corte lo marquemos nosotros. */
export const PAGINA = 1000;

/**
 * Trae todas las páginas de una consulta ya filtrada y ordenada.
 *
 * `armar` recibe el offset y tiene que devolver la consulta con su `.range()`:
 *
 *   const { filas } = await leerTodo<Candidato>((desde) =>
 *     supabase.from('candidates').select('id,name').order('created_at').range(desde, desde + PAGINA - 1),
 *   );
 *
 * El orden importa: sin `.order()` estable, dos páginas pueden traer la misma
 * fila y saltearse otra.
 */
export async function leerTodo<T = Record<string, unknown>>(
  armar: (desde: number) => Consulta<T>,
): Promise<{ filas: T[]; error: string | null }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armar(desde);
    if (error) return { filas, error: error.message };
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return { filas, error: null };
}
