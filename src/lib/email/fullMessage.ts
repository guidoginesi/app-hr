/**
 * Mail "completo" de un mensaje de Comunicaciones, con la estética de los
 * artifacts de Pow: Plus Jakarta Sans, fondo cálido, tarjeta redondeada, el
 * naranja como acento. Lleva carátula arriba, los datos destacados en recuadros
 * naranja claro y el cuerpo entero tal como se escribió en el editor.
 *
 * Es distinto de `renderEmail`, que es el aviso corto (título + resumen + botón).
 * Como `layout.ts`, no importa nada con `@/` para que se pueda usar desde scripts.
 *
 * Todo va con estilos inline: Gmail y Outlook ignoran casi todo lo demás. La
 * fuente se pide a Google Fonts; donde no carga (Gmail web, Outlook) cae en la
 * pila de sistema, que es la misma del resto de los mails.
 */
import { EMAIL, escapeHtml, getAppUrl } from './layout';

/** Paleta de los artifacts de Pow (skill pow-artifacts). */
export const POW_MAIL = {
  bg: '#F3F1ED',
  card: '#FFFFFF',
  ink: '#171614',
  body: '#2E2C28',
  muted: '#8F8B83',
  line: '#EFECE6',
  accent: '#FE722B',
  accentText: '#D9480F',
  accentSoft: '#FFF1E8',
  soft: '#F4F1EC',
  font: `'Plus Jakarta Sans', ${EMAIL.fontStack}`,
};

export type Highlight = { label: string; value: string };

export type FullMessageEmail = {
  title: string;
  /** HTML del editor (tiptap), ya con las variables reemplazadas. */
  bodyHtml: string;
  /** URL pública de la carátula. Sin ella, el mail arranca con el título. */
  coverUrl?: string | null;
  /**
   * La carátula ya trae el título escrito encima (la arma el formulario). En
   * ese caso no se repite el título abajo.
   */
  coverHasTitle?: boolean;
  /** Hasta 3 datos en recuadros (Cuándo / Dónde / Confirmá), después del primer párrafo. */
  highlights?: Highlight[];
  /** Texto que muestran los clientes de mail al lado del asunto. */
  preheader?: string;
  /** Texto chico del pie, a la izquierda del logo. */
  footerLabel?: string;
  /**
   * Botones de respuesta, con links ya firmados para este destinatario: Voy /
   * No voy, o una lista de preguntas con sus opciones.
   */
  rsvp?:
    | {
        question?: string | null;
        yes: { label: string; url: string };
        no: { label: string; url: string };
      }
    | { questions: { question: string; options: { label: string; url: string }[] }[] }
    | null;
};

const P = `margin:0 0 14px;font-size:15px;line-height:1.6;color:${POW_MAIL.body};`;
const SMALL_LABEL = `font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${POW_MAIL.accentText};`;

/**
 * El HTML del editor viene sin estilos (o con clases de Tailwind que en un mail
 * no existen), así que se le pone el estilo a cada etiqueta que puede generar.
 * Una cita (blockquote) se dibuja como el recuadro gris de las preguntas
 * frecuentes, y un subtítulo h3 como el rótulo chico naranja.
 */
export function styleBodyForEmail(html: string): string {
  return (
    html
      .replace(/<p(\s[^>]*)?>/gi, `<p style="${P}">`)
      .replace(/<h1(\s[^>]*)?>/gi, `<h2 style="margin:22px 0 10px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${POW_MAIL.ink};line-height:1.2;">`)
      .replace(/<\/h1>/gi, '</h2>')
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:22px 0 10px;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${POW_MAIL.ink};line-height:1.25;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:0 0 10px;${SMALL_LABEL}">`)
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 14px;padding-left:22px;color:${POW_MAIL.body};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 14px;padding-left:22px;color:${POW_MAIL.body};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;">`)
      // Un párrafo dentro de un ítem no lleva el margen de abajo.
      .replace(/(<li [^>]*>)\s*<p style="[^"]*">/gi, '$1<p style="margin:0;font-size:15px;line-height:1.6;">')
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="color:${POW_MAIL.ink};font-weight:700;">`)
      .replace(/<a\s([^>]*?)class="[^"]*"([^>]*)>/gi, '<a $1$2>')
      .replace(/<a\s/gi, `<a style="color:${POW_MAIL.accentText};text-decoration:underline;" `)
      .replace(
        /<blockquote(\s[^>]*)?>/gi,
        `<div style="margin:4px 0 16px;padding:14px 16px 2px;background:${POW_MAIL.soft};border-radius:10px;">`,
      )
      .replace(/<\/blockquote>/gi, '</div>')
      .replace(/<hr(\s[^>]*)?\/?>/gi, `<hr style="border:0;border-top:1px solid ${POW_MAIL.line};margin:20px 0;">`)
  );
}

function highlightsHtml(items: Highlight[]): string {
  const list = items.slice(0, 3);
  const width = Math.floor((100 - (list.length - 1) * 2) / list.length);
  // El fondo va en la celda y no en un div adentro: las celdas de una fila
  // tienen siempre la misma altura, así un dato corto ("Bariloche") no deja su
  // recuadro más bajo que los de al lado. La separación es una celda vacía,
  // porque Outlook y Gmail no respetan border-spacing ni calc().
  const cells = list
    .map((h, i) => {
      const box = `<td valign="top" width="${width}%" style="background:${POW_MAIL.accentSoft};border-radius:10px;padding:10px 12px;">
          <div style="${SMALL_LABEL}">${escapeHtml(h.label)}</div>
          <div style="margin-top:2px;font-size:14px;font-weight:700;line-height:1.35;color:${POW_MAIL.ink};">${escapeHtml(h.value)}</div>
        </td>`;
      return i === 0 ? box : `<td width="2%" style="font-size:0;line-height:0;">&nbsp;</td>${box}`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:2px 0 16px;border-collapse:separate;"><tr>${cells}</tr></table>`;
}

/** Una pregunta por recuadro, con una opción por renglón: las opciones pueden ser largas. */
function rsvpOptionsHtml(questions: { question: string; options: { label: string; url: string }[] }[]): string {
  const blocks = questions
    .map(
      (q) => `<div style="margin:0 0 12px;padding:16px 14px 8px;border:1px solid ${POW_MAIL.line};border-radius:12px;">
    <div style="margin:0 0 12px;font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${POW_MAIL.ink};">${escapeHtml(q.question)}</div>
    ${q.options
      .map(
        (o) =>
          `<a href="${escapeHtml(o.url)}" style="display:block;margin:0 0 8px;padding:12px 16px;border-radius:10px;border:1px solid #D9D4CB;background:#FFFFFF;font-family:${POW_MAIL.font};font-size:15px;font-weight:700;line-height:1.35;color:${POW_MAIL.ink};text-decoration:none;">${escapeHtml(o.label)}</a>`,
      )
      .join('')}
  </div>`,
    )
    .join('');
  return `<div style="margin:6px 0 18px;">${blocks}<div style="font-size:12px;color:${POW_MAIL.muted};text-align:center;">Tocá una opción en cada pregunta. Si cambiás de idea, tocá otra.</div></div>`;
}

function rsvpHtml(r: NonNullable<FullMessageEmail['rsvp']>): string {
  if ('questions' in r) return rsvpOptionsHtml(r.questions);
  const btn = (label: string, url: string, primary: boolean) =>
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 26px;border-radius:999px;font-family:${POW_MAIL.font};font-size:15px;font-weight:700;line-height:1;text-decoration:none;${
      primary
        ? `background:${POW_MAIL.ink};color:#FFFFFF;border:1px solid ${POW_MAIL.ink};`
        : `background:#FFFFFF;color:${POW_MAIL.ink};border:1px solid #D9D4CB;`
    }">${escapeHtml(label)}</a>`;
  const question = r.question
    ? `<div style="margin:0 0 12px;font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${POW_MAIL.ink};">${escapeHtml(r.question)}</div>`
    : '';
  return `<div style="margin:6px 0 18px;padding:18px 18px 16px;border:1px solid ${POW_MAIL.line};border-radius:12px;text-align:center;">
    ${question}
    ${btn(r.yes.label, r.yes.url, true)}&nbsp;&nbsp;${btn(r.no.label, r.no.url, false)}
    <div style="margin-top:10px;font-size:12px;color:${POW_MAIL.muted};">Si cambiás de idea, tocá el otro botón.</div>
  </div>`;
}

/** Los botones van al final, antes de la firma si el último párrafo es corto ("Guido"). */
function withRsvp(bodyHtml: string, block: string): string {
  const starts = [...bodyHtml.matchAll(/<p[\s>]/gi)].map((m) => m.index ?? 0);
  const last = starts[starts.length - 1];
  if (last === undefined) return bodyHtml + block;
  const lastText = bodyHtml.slice(last).replace(/<[^>]+>/g, '').trim();
  return lastText.length < 30 ? bodyHtml.slice(0, last) + block + bodyHtml.slice(last) : bodyHtml + block;
}

/** Los recuadros van después del primer párrafo, como en la página del borrador. */
function withHighlights(bodyHtml: string, items: Highlight[] | undefined): string {
  const list = (items ?? []).filter((h) => h.label.trim() && h.value.trim());
  if (!list.length) return bodyHtml;
  const block = highlightsHtml(list);
  // Si el primer párrafo es un saludo corto ("Hola Juan,"), van después del segundo.
  const ends = [...bodyHtml.matchAll(/<\/p>/gi)].map((m) => (m.index ?? 0) + 4);
  if (!ends.length) return block + bodyHtml;
  const firstText = bodyHtml.slice(0, ends[0]).replace(/<[^>]+>/g, '').trim();
  const at = firstText.length < 40 && ends[1] ? ends[1] : ends[0];
  return bodyHtml.slice(0, at) + block + bodyHtml.slice(at);
}

export function renderFullMessageEmail(content: FullMessageEmail): string {
  // El logo de Pow (el de los artifacts, con el destello) como PNG: los clientes
  // de mail no muestran SVG. Vive en public/email/pow-logo.png (672×104, 4x).
  const brandMark = `<img src="${escapeHtml(`${getAppUrl()}/email/pow-logo.png`)}" alt="Pow" width="90" height="14" style="display:block;border:0;width:90px;height:14px;">`;

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>`
    : '';

  const cover = content.coverUrl
    ? `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(
        content.coverUrl,
      )}" alt="${escapeHtml(content.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`
    : '';

  const showTitle = !(content.coverUrl && content.coverHasTitle);
  const title = showTitle
    ? `<h1 style="margin:0 0 16px;font-size:28px;font-weight:800;letter-spacing:-0.025em;color:${POW_MAIL.ink};line-height:1.1;">${escapeHtml(
        content.title,
      )}</h1>`
    : '';

  let body = styleBodyForEmail(withHighlights(content.bodyHtml, content.highlights));
  // Después de estilar, para que los <p> del bloque de botones no se pisen.
  if (content.rsvp) body = withRsvp(body, rsvpHtml(content.rsvp));

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${POW_MAIL.bg};">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${POW_MAIL.bg};">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;font-family:${POW_MAIL.font};background:${POW_MAIL.card};border-radius:14px;overflow:hidden;">
      ${cover}
      <tr><td style="padding:26px 28px 8px;font-family:${POW_MAIL.font};">
        ${title}
        ${body}
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid ${POW_MAIL.line};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="font-family:${POW_MAIL.font};font-size:12px;line-height:1.5;color:${POW_MAIL.muted};">${escapeHtml(
            content.footerLabel || 'Pow',
          )}</td>
          <td align="right">${brandMark}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
