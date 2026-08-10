/**
 * POW Design System — layout de emails (email-safe)
 * ------------------------------------------------------------
 * El DS de la app vive en OKLCH + variables CSS + Tailwind v4, que los
 * clientes de mail no interpretan. Acá traducimos los tokens a hex fijos
 * y estilos inline, con la misma escala tipográfica del DS:
 *   display 20 · title 14 · subtitle 13 · body 12 · label 10.
 *
 * Único punto de armado de HTML de mails. Todos los senders pasan por
 * `renderEmail` (estructurado) o `renderPlainTemplate` (plantillas de DB).
 */

// ---------- Tokens (hex, email-safe) ----------
export const EMAIL = {
  bg: '#f5f6f8',
  card: '#ffffff',
  border: '#ECEDEF',
  borderSoft: '#EEF0F2',
  detailBg: '#FAFAFB',
  ink: '#1A1D23', // primary / títulos / CTA
  brand: '#FE722B', // acento de marca (barra superior)
  link: '#C2410C', // naranja accesible sobre blanco
  body: '#374151', // texto de párrafo
  muted: '#6B7280',
  faint: '#9AA1AC', // pie, notas finas
  success: '#15803D',
  successBg: '#ECFDF3',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  neutral: '#4B5563',
  neutralBg: '#F5F6F8',
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Helvetica, Arial, sans-serif",
} as const;

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';
export type Badge = { tone: BadgeTone; label: string };
export type DetailRow = { label: string; value: string; strong?: boolean };

export type EmailContent = {
  /** Título principal (heading). */
  title: string;
  /** Etiqueta de contexto bajo el wordmark, ej. "People · Licencias". */
  contextLabel?: string;
  /** Badge de estado (verde/ámbar/rojo/neutro). El color comunica estado. */
  badge?: Badge;
  /** Texto de preheader (oculto, se ve en la preview del inbox). */
  preheader?: string;
  /** Párrafo(s) de intro. Texto plano (se convierte) o HTML ya armado. */
  intro?: string;
  /** Bloque de HTML ya renderizado (para plantillas de texto de la DB). */
  bodyHtml?: string;
  /** Filas de detalle → panel con borde. */
  details?: DetailRow[];
  /** CTA primario (botón tinta). */
  cta?: { label: string; url: string };
  /** Nota secundaria en muted, debajo del CTA. */
  outro?: string;
  /** Letra chica bajo la firma del pie. */
  footerNote?: string;
};

// ---------- Helpers de texto ----------
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ¿El string ya trae markup HTML? (para no escapar plantillas ya en HTML) */
function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

/** Quita el emoji/símbolo inicial de un subject para usarlo como heading. */
export function stripLeadingEmoji(text: string): string {
  return text.replace(
    /^[\s\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]+/u,
    '',
  ).trim();
}

/**
 * Convierte texto plano (con \n) en párrafos HTML con la tipografía del DS.
 * Doble salto = párrafo nuevo; salto simple = <br>. Escapa el contenido.
 */
export function textToParagraphs(text: string): string {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, '<br>');
      return `<p style="margin:0 0 13px;font-size:13px;line-height:1.55;color:${EMAIL.body};">${inner}</p>`;
    })
    .join('');
}

/** Dirección `from` con nombre visible: "Pow People <noreply@pow-apps.com>". */
export function getEmailFrom(): string {
  const raw = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  if (raw.includes('<')) return raw; // ya trae display name
  return `Pow People <${raw}>`;
}

/** Base URL de la app para los CTA. */
/** Reply-To para mails internos (env RESEND_REPLY_TO_EMAIL). Sin valor = no-reply. */
export function getReplyTo(): string | undefined {
  const raw = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  return raw || undefined;
}

export function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.pow.la'
  ).replace(/\/$/, '');
}

// ---------- Bloques ----------
function badgeHtml(badge: Badge): string {
  const map: Record<BadgeTone, { fg: string; bg: string }> = {
    success: { fg: EMAIL.success, bg: EMAIL.successBg },
    warning: { fg: EMAIL.warning, bg: EMAIL.warningBg },
    danger: { fg: EMAIL.danger, bg: EMAIL.dangerBg },
    neutral: { fg: EMAIL.neutral, bg: EMAIL.neutralBg },
  };
  const c = map[badge.tone];
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${c.fg};background:${c.bg};padding:4px 9px;border-radius:999px;margin:0 0 13px;">${escapeHtml(
    badge.label,
  )}</span>`;
}

function detailHtml(rows: DetailRow[]): string {
  const trs = rows
    .map((r, i) => {
      const border = i < rows.length - 1 ? `border-bottom:1px solid ${EMAIL.borderSoft};` : '';
      const lblColor = r.strong ? EMAIL.ink : EMAIL.muted;
      const lblWeight = r.strong ? '600' : '400';
      return `<tr>
        <td style="padding:8px 0;font-size:12px;color:${lblColor};font-weight:${lblWeight};${border}">${escapeHtml(
          r.label,
        )}</td>
        <td style="padding:8px 0;font-size:12px;color:${EMAIL.ink};font-weight:600;text-align:right;${border}">${escapeHtml(
          r.value,
        )}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${EMAIL.border};border-radius:8px;background:${EMAIL.detailBg};margin:4px 0 16px;">
    <tr><td style="padding:2px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${trs}</table>
    </td></tr>
  </table>`;
}

function ctaHtml(cta: { label: string; url: string }): string {
  return `<a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${EMAIL.ink};color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:8px 15px;border-radius:8px;">${escapeHtml(
    cta.label,
  )}</a>`;
}

// ---------- Layout principal ----------
export function renderEmail(content: EmailContent): string {
  const logoUrl = process.env.EMAIL_LOGO_URL;
  const brandMark = logoUrl
    ? `<img src="${escapeHtml(
        logoUrl,
      )}" alt="Pow" height="20" style="display:block;border:0;height:20px;">`
    : `<span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:${EMAIL.ink};">Pow</span>`;

  const context = content.contextLabel
    ? `<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${EMAIL.faint};margin-top:3px;">${escapeHtml(
        content.contextLabel,
      )}</div>`
    : '';

  const badge = content.badge ? badgeHtml(content.badge) : '';

  const introHtml = content.intro
    ? looksLikeHtml(content.intro)
      ? content.intro
      : textToParagraphs(content.intro)
    : '';

  const body = content.bodyHtml ?? '';
  const details = content.details && content.details.length ? detailHtml(content.details) : '';
  const cta = content.cta ? `<div style="margin:2px 0 4px;">${ctaHtml(content.cta)}</div>` : '';
  const outro = content.outro
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${EMAIL.faint};">${escapeHtml(
        content.outro,
      )}</p>`
    : '';

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
        content.preheader,
      )}</div>`
    : '';

  const footerNote = content.footerNote
    ? `<br>${escapeHtml(content.footerNote)}`
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
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;font-family:${EMAIL.fontStack};">
      <tr><td style="background:${EMAIL.card};border:1px solid ${EMAIL.border};border-radius:10px;overflow:hidden;">
        <div style="height:3px;background:${EMAIL.brand};line-height:3px;font-size:0;">&nbsp;</div>
        <div style="padding:20px 26px 0;">
          ${brandMark}
          ${context}
        </div>
        <div style="padding:18px 26px 8px;">
          ${badge}
          <h1 style="margin:0 0 9px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${EMAIL.ink};line-height:1.2;">${escapeHtml(
            content.title,
          )}</h1>
          ${introHtml}
          ${body}
          ${details}
          ${cta}
          ${outro}
        </div>
        <div style="padding:16px 26px 22px;border-top:1px solid ${EMAIL.borderSoft};margin-top:14px;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:${EMAIL.faint};">
            <span style="color:${EMAIL.muted};font-weight:600;">Equipo de People · Pow</span>${footerNote}
          </p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ---------- Config por template_key (plantillas de DB) ----------
type KeyConfig = {
  context: string;
  badge?: Badge;
  cta?: { label: string; path: string };
  footerNote?: string;
};

const KEY_CONFIG: Record<string, KeyConfig> = {
  // Time-off
  time_off_request_submitted: {
    context: 'People · Licencias',
    badge: { tone: 'neutral', label: 'Solicitud recibida' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  time_off_leader_notification: {
    context: 'People · Aprobaciones',
    badge: { tone: 'warning', label: 'Pendiente de aprobación' },
    cta: { label: 'Revisar solicitud', path: '/portal/team' },
    footerNote: 'Recibís este mail como líder asignado en el portal de Pow.',
  },
  // Enfermedad: no se aprueba, se registra. Por eso badge propio y CTA al
  // historial, que es donde se sube el certificado.
  time_off_sick_registered: {
    context: 'People · Licencias',
    badge: { tone: 'success', label: 'Registrada' },
    cta: { label: 'Subir el certificado', path: '/portal/time-off/requests' },
  },
  time_off_sick_leader_notification: {
    context: 'People · Licencias',
    // "Aviso", no "pendiente": al líder no se le pide que apruebe nada.
    badge: { tone: 'neutral', label: 'Aviso de ausencia' },
    cta: { label: 'Ver mi equipo', path: '/portal/team' },
    footerNote: 'Recibís este mail como líder asignado en el portal de Pow.',
  },
  time_off_hr_notification: {
    context: 'People · Aprobaciones',
    badge: { tone: 'warning', label: 'Pendiente aprobación HR' },
    cta: { label: 'Revisar solicitud', path: '/admin/time-off/requests' },
  },
  time_off_approved_leader: {
    context: 'People · Licencias',
    badge: { tone: 'success', label: 'Aprobada por tu líder' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  time_off_approved_hr: {
    context: 'People · Licencias',
    badge: { tone: 'success', label: 'Aprobada' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  time_off_rejected: {
    context: 'People · Licencias',
    badge: { tone: 'danger', label: 'No aprobada' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  time_off_modified: {
    context: 'People · Licencias',
    badge: { tone: 'neutral', label: 'Actualizada' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  time_off_pre_leave_reminder: {
    context: 'People · Licencias',
    badge: { tone: 'warning', label: 'Tu licencia empieza mañana' },
    cta: { label: 'Ver mis licencias', path: '/portal/time-off' },
  },
  // Recruiting (candidatos externos, sin CTA al portal)
  application_confirmation: {
    context: 'Pow · Talento',
    badge: { tone: 'neutral', label: 'Postulación recibida' },
  },
  interview_coordination: {
    context: 'Pow · Talento',
    badge: { tone: 'success', label: 'Buenas noticias' },
  },
  candidate_rejected: { context: 'Pow · Talento' },
  candidate_rejected_location: { context: 'Pow · Talento' },
  candidate_rejected_salary: { context: 'Pow · Talento' },
  // Automations
  birthday_greeting: { context: 'Pow · Equipo' },
  work_anniversary: { context: 'Pow · Equipo' },
};

/**
 * Arma una plantilla de DB (subject + body de texto plano o HTML) dentro del
 * layout POW. El heading sale del subject (sin emoji); el badge/context/CTA
 * salen del template_key.
 */
export function renderPlainTemplate(params: {
  templateKey: string;
  subject: string;
  body: string;
}): string {
  const cfg = KEY_CONFIG[params.templateKey] ?? { context: 'Pow' };
  const bodyHtml = looksLikeHtml(params.body)
    ? params.body
    : textToParagraphs(params.body);

  const cta = cfg.cta
    ? { label: cfg.cta.label, url: `${getAppUrl()}${cfg.cta.path}` }
    : undefined;

  return renderEmail({
    title: stripLeadingEmoji(params.subject),
    contextLabel: cfg.context,
    badge: cfg.badge,
    preheader: stripLeadingEmoji(params.subject),
    bodyHtml,
    cta,
    footerNote: cfg.footerNote,
  });
}
