/**
 * Mail "completo" de un mensaje de Comunicaciones: carátula arriba, el cuerpo
 * entero tal como se escribió en el editor y un link al portal abajo.
 *
 * Es distinto de `renderEmail`, que es el aviso corto (título + resumen + botón).
 * Este es para comunicados que se leen en el mail mismo: un evento, una
 * invitación, algo con foto. Como `layout.ts`, no importa nada con `@/` para que
 * se pueda usar desde scripts.
 */
import { EMAIL, escapeHtml } from './layout';

export type FullMessageEmail = {
  title: string;
  /** HTML del editor (tiptap), ya con las variables reemplazadas. */
  bodyHtml: string;
  /** URL pública de la carátula. Sin ella, el mail arranca con el título. */
  coverUrl?: string | null;
  /** Texto que muestran los clientes de mail al lado del asunto. */
  preheader?: string;
  /** Link al mensaje en el portal, para quien prefiera leerlo ahí. */
  portalUrl?: string;
};

const P = `margin:0 0 14px;font-size:15px;line-height:1.6;color:${EMAIL.body};`;

/**
 * El HTML del editor viene sin estilos (o con clases de Tailwind que en un mail
 * no existen). Gmail y Outlook ignoran casi todo lo que no está inline, así que
 * se le pone el estilo a cada etiqueta que puede generar el editor.
 */
export function styleBodyForEmail(html: string): string {
  return html
    .replace(/<p(\s[^>]*)?>/gi, `<p style="${P}">`)
    .replace(/<h1(\s[^>]*)?>/gi, `<h2 style="margin:22px 0 10px;font-size:20px;font-weight:700;color:${EMAIL.ink};line-height:1.25;">`)
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:22px 0 10px;font-size:18px;font-weight:700;color:${EMAIL.ink};line-height:1.25;">`)
    .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:18px 0 8px;font-size:15px;font-weight:700;color:${EMAIL.ink};line-height:1.3;">`)
    .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 14px;padding-left:22px;color:${EMAIL.body};">`)
    .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 14px;padding-left:22px;color:${EMAIL.body};">`)
    .replace(/<li(\s[^>]*)?>/gi, `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;">`)
    // Un párrafo dentro de un ítem no lleva el margen de abajo.
    .replace(/(<li [^>]*>)\s*<p style="[^"]*">/gi, '$1<p style="margin:0;font-size:15px;line-height:1.6;">')
    .replace(/<strong(\s[^>]*)?>/gi, `<strong style="color:${EMAIL.ink};font-weight:700;">`)
    .replace(/<a\s([^>]*?)class="[^"]*"([^>]*)>/gi, '<a $1$2>')
    .replace(/<a\s/gi, `<a style="color:${EMAIL.link};text-decoration:underline;" `)
    .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid ${EMAIL.brand};background:${EMAIL.detailBg};">`)
    .replace(/<hr(\s[^>]*)?\/?>/gi, `<hr style="border:0;border-top:1px solid ${EMAIL.borderSoft};margin:20px 0;">`);
}

export function renderFullMessageEmail(content: FullMessageEmail): string {
  const logoUrl = process.env.EMAIL_LOGO_URL;
  const brandMark = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Pow" height="20" style="display:block;border:0;height:20px;">`
    : `<span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:${EMAIL.ink};">Pow</span>`;

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>`
    : '';

  const cover = content.coverUrl
    ? `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(
        content.coverUrl,
      )}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`
    : `<tr><td style="height:3px;background:${EMAIL.brand};line-height:3px;font-size:0;">&nbsp;</td></tr>`;

  const portal = content.portalUrl
    ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:${EMAIL.faint};">También lo podés ver en el <a href="${escapeHtml(
        content.portalUrl,
      )}" style="color:${EMAIL.muted};text-decoration:underline;">portal de Pow</a>.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${EMAIL.bg};">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${EMAIL.bg};">
  <tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;font-family:${EMAIL.fontStack};background:${EMAIL.card};border:1px solid ${EMAIL.border};border-radius:12px;overflow:hidden;">
      ${cover}
      <tr><td style="padding:26px 30px 6px;">
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;letter-spacing:-0.025em;color:${EMAIL.ink};line-height:1.15;">${escapeHtml(
          content.title,
        )}</h1>
        ${styleBodyForEmail(content.bodyHtml)}
        ${portal}
      </td></tr>
      <tr><td style="padding:16px 30px 22px;border-top:1px solid ${EMAIL.borderSoft};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="font-size:11px;line-height:1.5;color:${EMAIL.faint};">Pow &middot; Comunicaciones</td>
          <td align="right">${brandMark}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
