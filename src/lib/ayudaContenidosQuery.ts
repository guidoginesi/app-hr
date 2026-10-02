import 'server-only';
import { getSupabaseServer } from '@/lib/supabaseServer';
import type { EmploymentType } from '@/types/employee';
import { formatDateLocal } from '@/lib/dateUtils';
import { esNuevo, type ManualCard } from '@/components/manual/ManualIndex';
import {
  TEMA_MANUALES,
  agruparPorSeccion,
  esNombreDeIcono,
  linkValido,
  slugDe,
  visiblePara,
  type AyudaContenido,
  type ItemDeAyuda,
  type TemaDeAyuda,
} from '@/lib/ayudaContenidos';
import { limpiarHtml, textoDe, tieneCuerpo } from '@/lib/ayudaContenidosHtml';

/** Lo publicado para esta forma de contratación. Si la tabla falla, vacío: la Ayuda sigue con los manuales. */
export async function contenidosDeAyudaPara(tipo: EmploymentType | null | undefined): Promise<AyudaContenido[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('ayuda_contenidos')
    .select('id, slug, seccion, titulo, resumen, icono, orden, updated_at, cuerpo_html, link_url, audiencia')
    .eq('publicado', true)
    .order('orden');
  if (error || !data) return [];
  return (data as AyudaContenido[]).filter((c) => visiblePara(c, tipo));
}

/**
 * Los temas del índice de Ayuda: las secciones de People y, al final, los
 * manuales del portal.
 *
 * Viaja todo de una, cuerpos incluidos: son pocos, y así el buscador encuentra
 * lo que está adentro del texto y el panel abre sin esperar.
 */
export function armarTemas(contenidos: AyudaContenido[], manuales: ManualCard[]): TemaDeAyuda[] {
  const temas = new Map<string, TemaDeAyuda>();

  for (const { seccion, items } of agruparPorSeccion(contenidos)) {
    const lista = items.flatMap((c): ItemDeAyuda[] => {
      const link = linkValido(c.link_url);
      const base = { id: c.id, titulo: c.titulo, resumen: c.resumen, icono: esNombreDeIcono(c.icono) ? c.icono : null };
      if (tieneCuerpo(c.cuerpo_html)) {
        const html = limpiarHtml(c.cuerpo_html);
        return [{ ...base, tipo: 'contenido', slug: c.slug, html, texto: textoDe(html), link, actualizado: c.updated_at }];
      }
      // Sin cuerpo y sin link no hay nada que abrir.
      return link ? [{ ...base, tipo: 'link', href: link }] : [];
    });
    if (lista.length === 0) continue;

    // "Beneficios" y "beneficios" son dos grupos con el mismo slug: van juntos.
    const id = slugDe(seccion);
    const previo = temas.get(id);
    if (previo) {
      previo.items.push(...lista);
      continue;
    }

    const ultimo = items.reduce((max, c) => (c.updated_at > max ? c.updated_at : max), '');
    temas.set(id, {
      id,
      nombre: seccion,
      // Lo que se reemplaza es una página que quedó vieja: decir cuándo se tocó
      // por última vez es lo que la hace creíble.
      descripcion: `Actualizado el ${formatDateLocal(ultimo.slice(0, 10))}`,
      items: lista,
    });
  }

  const hoy = new Date();
  const deManuales: ItemDeAyuda[] = [...manuales]
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .map((m) => ({
      tipo: 'manual',
      id: m.href,
      titulo: m.title,
      resumen: m.desc,
      icono: null,
      href: m.href,
      nuevo: esNuevo(m.updated, hoy),
    }));

  const existente = temas.get(TEMA_MANUALES);
  if (existente) existente.items.push(...deManuales);
  else if (deManuales.length > 0) {
    temas.set(TEMA_MANUALES, {
      id: TEMA_MANUALES,
      nombre: 'Cómo usar el portal',
      descripcion: 'Paso a paso de cada pantalla del portal.',
      items: deManuales,
    });
  }

  return [...temas.values()];
}

/** Un contenido para su página, con el HTML ya limpio. null si no corresponde mostrarlo. */
export async function contenidoParaElPortal(
  slug: string,
  tipo: EmploymentType | null | undefined,
): Promise<(AyudaContenido & { html: string }) | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('ayuda_contenidos')
    .select('*')
    .eq('slug', slug)
    .eq('publicado', true)
    .maybeSingle();
  if (!data) return null;
  const c = data as AyudaContenido;
  if (!visiblePara(c, tipo)) return null;
  return { ...c, html: limpiarHtml(c.cuerpo_html) };
}
