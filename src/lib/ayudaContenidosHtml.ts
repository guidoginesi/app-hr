import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * El HTML que sale del editor, limpio.
 *
 * Lo escribe alguien de People y lo lee toda la empresa, así que se guarda sólo
 * lo que el editor sabe producir: títulos, párrafos, listas, énfasis y links.
 * Un `<script>` o un `onclick` pegado desde otro lado no llega al portal. Se
 * limpia al guardar y otra vez al mostrar, por si alguna fila entra por fuera
 * del editor.
 */
export function limpiarHtml(html: string): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: [
      'p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Los links de afuera abren en otra pestaña, así el portal no se pierde
    // detrás. Los del propio portal ("/portal/time-off/new") abren en la misma:
    // son el paso siguiente, no una consulta al costado.
    transformTags: {
      a: (tagName, attribs) => {
        const resto = { ...attribs };
        delete resto.target;
        delete resto.rel;
        const interno = /^\/(?!\/)/.test(resto.href ?? '');
        return {
          tagName,
          attribs: interno ? resto : { ...resto, target: '_blank', rel: 'noopener noreferrer' },
        };
      },
    },
  }).trim();
}

/**
 * El cuerpo en texto plano, para el buscador. Los cierres de bloque se vuelven
 * espacios: si no, el último renglón de un párrafo queda pegado al siguiente.
 */
export function textoDe(html: string): string {
  return sanitizeHtml(
    (html ?? '').replace(/<\/(p|h2|h3|li|blockquote|pre)>|<br\s*\/?>|<hr\s*\/?>/gi, ' '),
    { allowedTags: [], allowedAttributes: {} },
  )
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Tiene algo para leer, más allá de párrafos vacíos? */
export function tieneCuerpo(html: string | null | undefined): boolean {
  return sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} }).trim().length > 0;
}
