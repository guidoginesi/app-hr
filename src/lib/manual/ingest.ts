import { createHash } from 'crypto';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { audienciaSugerida } from '@/lib/manual/audienciaSugerida';

/**
 * Recibe el Manual RRHH desde el Google Doc y lo deja sincronizado.
 *
 * El Doc es la fuente y esto es la copia. Cada importación es un diff completo:
 * lo que llegó igual se deja, lo que cambió se actualiza, y lo que ya no está en
 * el documento se jubila —no se borra— porque puede haber respuestas que lo
 * citaron y hay que poder explicar de dónde salieron.
 *
 * Lo único que NO toca es la marca de audiencia: decidir qué se le puede citar a
 * un colaborador es trabajo humano y no se pierde porque alguien corrigió una
 * coma en el Doc.
 */

export interface SeccionEntrante {
  /** Jerarquía de títulos, de la más general a la más específica. */
  ruta: string[];
  titulo: string;
  nivel: number;
  orden: number;
  texto: string;
  anchor?: string | null;
}

export interface ResultadoImportacion {
  recibidas: number;
  nuevas: string[];
  modificadas: string[];
  sinCambios: number;
  jubiladas: string[];
  sinRevisar: number;
}

/** Identidad estable entre importaciones: la jerarquía de títulos, normalizada. */
export function slugDeRuta(ruta: string[]): string {
  return ruta
    .map((parte) =>
      parte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // marcas de acento sueltas tras NFD
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60),
    )
    .filter(Boolean)
    .join('/');
}

function hashDeTexto(texto: string): string {
  return createHash('sha256').update(texto.trim()).digest('hex').slice(0, 32);
}

/**
 * El manual arrastra encabezados repetidos del armado original: un título de
 * nivel 1 sin texto seguido de otro igual un nivel más abajo, como
 * "Bajas de Personal › Bajas de Personal › Voluntaria (renuncia)".
 *
 * Se colapsan acá y no en el Apps Script porque el documento los tiene de
 * verdad: cualquier importación los va a traer, venga de donde venga.
 */
function colapsarRepetidos(secciones: SeccionEntrante[]): SeccionEntrante[] {
  // "Vacía" incluye a la que sólo tiene restos de formato: la exportación en
  // texto deja asteriscos de negrita sueltos en su propia línea.
  const vacia = (texto: string) => texto.replace(/[*#\s]/g, '') === '';

  const sobran = new Set<number>();
  for (let i = 0; i < secciones.length - 1; i++) {
    const actual = secciones[i];
    const siguiente = secciones[i + 1];
    if (vacia(actual.texto) && actual.titulo === siguiente.titulo && siguiente.nivel > actual.nivel) {
      sobran.add(i);
    }
  }
  if (sobran.size === 0) return secciones;

  // Sacar el eslabón de la ruta de todos los que colgaban de él.
  return secciones
    .map((seccion, i) => {
      if (sobran.has(i)) return null;
      const ruta = seccion.ruta.filter((parte, pos) => {
        const repetidoArriba = seccion.ruta[pos + 1] === parte;
        return !repetidoArriba;
      });
      return { ...seccion, ruta };
    })
    .filter((s): s is SeccionEntrante => s !== null);
}

export async function importarManual(
  secciones: SeccionEntrante[],
  origen: string,
): Promise<ResultadoImportacion> {
  const supabase = getSupabaseServer();

  const { data: existentes, error } = await supabase
    .from('manual_sections')
    .select('id, slug, hash, vigente');
  if (error) throw new Error(`No se pudieron leer las secciones: ${error.message}`);

  const porSlug = new Map((existentes ?? []).map((s) => [s.slug as string, s]));
  const ahora = new Date().toISOString();

  const resultado: ResultadoImportacion = {
    recibidas: secciones.length,
    nuevas: [],
    modificadas: [],
    sinCambios: 0,
    jubiladas: [],
    sinRevisar: 0,
  };

  const vistos = new Set<string>();
  const normalizadas = colapsarRepetidos(secciones);
  resultado.recibidas = normalizadas.length;
  const filas = normalizadas.map((seccion) => {
    const slug = slugDeRuta(seccion.ruta);
    vistos.add(slug);
    const hash = hashDeTexto(seccion.texto);
    const previa = porSlug.get(slug);

    if (!previa) resultado.nuevas.push(slug);
    else if (previa.hash !== hash) resultado.modificadas.push(slug);
    else resultado.sinCambios++;

    const sugerida = audienciaSugerida(seccion.ruta);

    return {
      slug,
      ruta: seccion.ruta,
      titulo: seccion.titulo,
      nivel: seccion.nivel,
      orden: seccion.orden,
      texto: seccion.texto,
      hash,
      anchor: seccion.anchor ?? null,
      // Se recalcula en cada importación: si cambia el criterio, la propuesta se
      // actualiza sola. `audiencia` —la decisión humana— no se toca nunca acá.
      audiencia_sugerida: sugerida?.audiencia ?? null,
      vigente: true,
      desaparecio_at: null,
      actualizado_at: ahora,
    };
  });

  // Una sección que vuelve después de haber desaparecido se reactiva sola:
  // `vigente: true` viaja en el upsert.
  const { error: upsertError } = await supabase
    .from('manual_sections')
    .upsert(filas, { onConflict: 'slug' });
  if (upsertError) throw new Error(`No se pudieron guardar las secciones: ${upsertError.message}`);

  const jubilar = (existentes ?? [])
    .filter((s) => s.vigente && !vistos.has(s.slug as string))
    .map((s) => s.slug as string);
  if (jubilar.length > 0) {
    const { error: jubilarError } = await supabase
      .from('manual_sections')
      .update({ vigente: false, desaparecio_at: ahora })
      .in('slug', jubilar);
    if (jubilarError) throw new Error(`No se pudieron jubilar las secciones: ${jubilarError.message}`);
    resultado.jubiladas = jubilar;
  }

  const { count } = await supabase
    .from('manual_sections')
    .select('id', { count: 'exact', head: true })
    .eq('vigente', true)
    .eq('audiencia', 'SIN_DEFINIR');
  resultado.sinRevisar = count ?? 0;

  await supabase.from('manual_imports').insert({
    origen,
    recibidas: resultado.recibidas,
    nuevas: resultado.nuevas.length,
    modificadas: resultado.modificadas.length,
    sin_cambios: resultado.sinCambios,
    jubiladas: resultado.jubiladas.length,
    detalle: {
      nuevas: resultado.nuevas,
      modificadas: resultado.modificadas,
      jubiladas: resultado.jubiladas,
    },
  });

  return resultado;
}
