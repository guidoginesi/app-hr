/**
 * El buscador de la Ayuda del portal.
 *
 * Corre en el navegador sobre todo lo que la persona puede ver —son decenas de
 * contenidos, no miles—, así que filtra mientras se escribe, sin ir al servidor.
 *
 * Ignora tildes y mayúsculas: "dias" encuentra "Días Pow". Pide que estén todas
 * las palabras, y descarta las que no dicen nada ("de", "la"), que si no
 * aparecerían resaltadas en todos lados.
 */

import type { ItemDeAyuda, TemaDeAyuda } from '@/lib/ayudaContenidos';

const VACIAS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los',
  'me', 'mi', 'o', 'por', 'que', 'se', 'su', 'un', 'una', 'y',
]);

/** "Días Pow" → "dias pow". */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Las palabras de una búsqueda, normalizadas y sin las vacías (salvo que sea lo único que hay). */
export function palabrasDe(consulta: string): string[] {
  const todas = normalizar(consulta).split(/\s+/).filter(Boolean);
  const utiles = todas.filter((p) => !VACIAS.has(p));
  return utiles.length > 0 ? utiles : todas;
}

/**
 * El texto normalizado y, para cada uno de sus caracteres, de qué posición del
 * original viene. Hace falta para resaltar en el texto con tildes lo que se
 * encontró en el texto sin ellas.
 */
function mapear(texto: string): { normal: string; origen: number[] } {
  let normal = '';
  const origen: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]);
    for (let k = 0; k < n.length; k++) {
      normal += n[k];
      origen.push(i);
    }
  }
  return { normal, origen };
}

/** Los tramos del texto original donde aparece alguna de las palabras, ordenados y sin solaparse. */
export function rangosDe(texto: string, palabras: string[]): Array<[number, number]> {
  if (!texto || palabras.length === 0) return [];
  const { normal, origen } = mapear(texto);
  const rangos: Array<[number, number]> = [];
  for (const p of palabras) {
    let i = normal.indexOf(p);
    while (i !== -1) {
      rangos.push([origen[i], origen[i + p.length - 1] + 1]);
      i = normal.indexOf(p, i + p.length);
    }
  }
  rangos.sort((a, b) => a[0] - b[0]);
  const fusionados: Array<[number, number]> = [];
  for (const [desde, hasta] of rangos) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo && desde <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], hasta);
    else fusionados.push([desde, hasta]);
  }
  return fusionados;
}

/**
 * Un pedazo del cuerpo alrededor de la primera coincidencia, cortado en
 * palabras enteras. Es lo que explica por qué apareció un resultado cuya
 * búsqueda no está ni en el título ni en el resumen.
 */
export function fragmentoDe(texto: string, palabras: string[], largo = 160): string | null {
  if (!texto) return null;
  const { normal, origen } = mapear(texto);
  let pos = -1;
  for (const p of palabras) {
    const i = normal.indexOf(p);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) return null;

  const centro = origen[pos];
  let desde = Math.max(0, centro - 60);
  let hasta = Math.min(texto.length, desde + largo);
  if (desde > 0) {
    const espacio = texto.indexOf(' ', desde);
    if (espacio !== -1 && espacio < centro) desde = espacio + 1;
  }
  if (hasta < texto.length) {
    const espacio = texto.lastIndexOf(' ', hasta);
    if (espacio > centro) hasta = espacio;
  }
  return `${desde > 0 ? '…' : ''}${texto.slice(desde, hasta).trim()}${hasta < texto.length ? '…' : ''}`;
}

export type Resultado = {
  tema: TemaDeAyuda;
  item: ItemDeAyuda;
  /** Sólo si la búsqueda no está en el título ni en el resumen. */
  fragmento: string | null;
  puntaje: number;
};

/**
 * Lo que coincide con la búsqueda, lo más relevante primero: pesa más estar en
 * el título que en el resumen, y en el resumen que en el cuerpo.
 */
export function buscar(temas: TemaDeAyuda[], consulta: string): Resultado[] {
  const palabras = palabrasDe(consulta);
  if (palabras.length === 0) return [];

  const resultados: Resultado[] = [];
  for (const tema of temas) {
    const enTema = normalizar(tema.nombre);
    for (const item of tema.items) {
      const titulo = normalizar(item.titulo);
      const resumen = normalizar(item.resumen ?? '');
      const texto = item.tipo === 'contenido' ? item.texto : '';
      const cuerpo = normalizar(texto);

      let puntaje = 0;
      let estanTodas = true;
      for (const p of palabras) {
        if (titulo.includes(p)) puntaje += titulo.startsWith(p) || titulo.includes(` ${p}`) ? 6 : 4;
        else if (resumen.includes(p)) puntaje += 2;
        else if (cuerpo.includes(p)) puntaje += 1;
        else if (enTema.includes(p)) puntaje += 1;
        else {
          estanTodas = false;
          break;
        }
      }
      if (!estanTodas) continue;

      const seVeArriba = palabras.every((p) => titulo.includes(p) || resumen.includes(p));
      resultados.push({ tema, item, puntaje, fragmento: seVeArriba ? null : fragmentoDe(texto, palabras) });
    }
  }
  return resultados.sort((a, b) => b.puntaje - a.puntaje || a.item.titulo.localeCompare(b.item.titulo));
}
