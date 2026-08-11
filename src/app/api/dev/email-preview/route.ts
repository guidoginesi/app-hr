import { NextRequest, NextResponse } from 'next/server';
import { renderEmail, renderPlainTemplate, type DetailRow } from '@/lib/email/layout';
import { blockInProduction } from '@/lib/devOnly';

/**
 * QA visual de emails — renderiza cada mail del sistema con datos de ejemplo.
 *
 *   GET /api/dev/email-preview           → índice con todos los mails en iframes
 *   GET /api/dev/email-preview?key=<id>  → el HTML de ese mail (para ver/enviar de prueba)
 *
 * Solo usa datos de ejemplo (no toca la DB). Pensado para revisar el DS en
 * Gmail/Outlook antes de producción.
 */

const SAMPLE = {
  nombre: 'Giovanna',
  periodo: '20 de julio de 2026 a 20 de julio de 2026',
};

function build(): Record<string, { label: string; html: string }> {
  const previews: Record<string, { label: string; html: string }> = {};

  // ---- Time-off (plantillas de DB) ----
  previews['time_off_leader_notification'] = {
    label: 'Time-off · nueva solicitud para aprobar (líder)',
    html: renderPlainTemplate({
      templateKey: 'time_off_leader_notification',
      subject: '📩 Nueva solicitud de licencia para aprobar',
      body: `Hola Guido Daniel,\n\nGiovanna Sol Maratta cargó una solicitud de licencia con el siguiente detalle:\n\nPeríodo: ${SAMPLE.periodo}\nCantidad: 1 día(s)\nTipo: Días Pow\n\nTe pedimos que la revises y la apruebes o rechaces desde la plataforma.\n\nGracias,\nEquipo de People`,
    }),
  };
  previews['time_off_approved_hr'] = {
    label: 'Time-off · aprobada (HR)',
    html: renderPlainTemplate({
      templateKey: 'time_off_approved_hr',
      subject: '✅ Tu solicitud de licencia fue aprobada',
      body: `Hola ${SAMPLE.nombre},\n\n¡Tu solicitud de licencia fue aprobada!\n\nPeríodo: ${SAMPLE.periodo}\nCantidad de días: 1\n\nMás cerca de la fecha de inicio te vamos a enviar un recordatorio con algunos pasos a tener en cuenta.\n\nEquipo de People`,
    }),
  };
  previews['time_off_rejected'] = {
    label: 'Time-off · rechazada',
    html: renderPlainTemplate({
      templateKey: 'time_off_rejected',
      subject: '❌ Tu solicitud de licencia no fue aprobada',
      body: `Hola ${SAMPLE.nombre},\n\nTu solicitud de licencia para el período ${SAMPLE.periodo} no pudo ser aprobada en esta oportunidad.\n\nComentario:\nNecesitamos cobertura del equipo esa semana.\n\nSi querés, podés revisar fechas alternativas y volver a cargar la solicitud.\n\nEquipo de People`,
    }),
  };

  // ---- Recruiting (plantillas de DB) ----
  previews['application_confirmation'] = {
    label: 'Recruiting · confirmación de postulación',
    html: renderPlainTemplate({
      templateKey: 'application_confirmation',
      subject: '¡Recibimos tu postulación en Pow!',
      body: `Hola Julián,\n\n¡Gracias por postularte a la búsqueda de Backend Developer en Pow!\n\nRecibimos tu postulación y nuestro equipo la va a revisar. Si tu perfil avanza, nos vamos a poner en contacto para coordinar los próximos pasos.\n\nGracias,\nEquipo de Talento`,
    }),
  };
  previews['candidate_rejected'] = {
    label: 'Recruiting · descartado (general)',
    html: renderPlainTemplate({
      templateKey: 'candidate_rejected',
      subject: 'Actualización sobre tu postulación en Pow',
      body: `Hola Julián,\n\nGracias por tu interés en la búsqueda de Backend Developer y por el tiempo que dedicaste al proceso.\n\nEn esta oportunidad decidimos avanzar con otros perfiles, pero vamos a guardar tu CV para futuras búsquedas.\n\n¡Éxitos!\nEquipo de Talento`,
    }),
  };

  // ---- Banco de Talentos ----
  previews['talent_pool_digest'] = {
    label: 'Banco de Talentos · resumen diario a People',
    html: renderEmail({
      title: '3 perfiles sin revisar en el Banco de Talentos',
      contextLabel: 'People · Reclutamiento',
      badge: { tone: 'success', label: '2 nuevo(s)' },
      preheader: 'Resumen diario del Banco de Talentos',
      intro: 'Esta gente dejó sus datos y todavía está sin revisar:',
      bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px;">
        <tr><td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
          <div style="font-size:13px;font-weight:600;color:#1A1D23;">Lucía Fernández <span style="color:#C2410C;">· nuevo</span></div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px;">Producto, Growth · Semi Senior</div>
        </td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
          <div style="font-size:13px;font-weight:600;color:#1A1D23;">Martín Díaz <span style="color:#C2410C;">· nuevo</span></div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px;">Comercial · Senior</div>
        </td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
          <div style="font-size:13px;font-weight:600;color:#1A1D23;">Alicia Prats</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px;">Diseño, CX · Lead</div>
        </td></tr>
      </table>`,
      cta: { label: 'Ir al Banco de Talentos', url: 'https://hr.pow-apps.com/admin/recruiting/banco' },
      outro:
        'Este resumen se arma cada mañana con lo que sigue en Nuevo. Al pasar un perfil a En espera, Descartado o Asignado deja de aparecer.',
    }),
  };

  // ---- Auth ----
  previews['reset'] = {
    label: 'Auth · restablecer contraseña',
    html: renderEmail({
      title: 'Restablecé tu contraseña',
      contextLabel: 'Portal · Seguridad',
      preheader: 'El enlace para restablecer tu contraseña vence en 1 hora.',
      intro:
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé clic en el botón para crear una nueva. El enlace vence en 1 hora.',
      cta: { label: 'Restablecer contraseña', url: 'https://app.pow.la/auth/reset-password?token=demo' },
      outro: 'Si no solicitaste este cambio, ignorá este mail: tu contraseña actual sigue siendo válida.',
    }),
  };
  previews['invite'] = {
    label: 'Auth · invitación / bienvenida',
    html: renderEmail({
      title: '¡Hola Giovanna! Bienvenido/a a Pow',
      contextLabel: 'Portal · Acceso',
      badge: { tone: 'success', label: 'Cuenta creada' },
      intro:
        'Creamos tu cuenta en el portal de Pow. Para empezar a usarlo, configurá tu contraseña haciendo clic en el botón. El enlace vence en 7 días.',
      cta: { label: 'Configurar mi contraseña', url: 'https://app.pow.la/auth/reset-password?token=demo' },
      outro: 'Vas a ingresar al portal con tu email: giovanna@pow.la',
    }),
  };

  // ---- Payroll ----
  const liqDetails: DetailRow[] = [
    { label: 'Sueldo', value: '$ 850.000,00' },
    { label: 'Reintegro Internet', value: '$ 20.000,00' },
    { label: 'Bonificación Anual', value: '$ 120.000,00' },
    { label: 'Adelanto de Sueldo', value: '−$ 20.000,00' },
    { label: 'Total a Facturar', value: '$ 970.000,00', strong: true },
  ];
  previews['payroll_liquidacion'] = {
    label: 'Payroll · liquidación (monotributo)',
    html: renderEmail({
      title: 'Tu liquidación está disponible',
      contextLabel: 'People · Liquidaciones',
      badge: { tone: 'neutral', label: 'Julio 2026' },
      intro: 'Hola Giovanna Maratta, ya podés ver el detalle de tu liquidación.',
      details: liqDetails,
      cta: { label: 'Ver en el portal', url: 'https://app.pow.la/portal/liquidaciones' },
      outro: 'Recordá: emití la factura por el Total a Facturar y cargala en el portal dentro de 1 día hábil.',
    }),
  };
  previews['payroll_factura'] = {
    label: 'Payroll · factura pendiente',
    html: renderEmail({
      title: 'Tenés una factura pendiente',
      contextLabel: 'People · Liquidaciones',
      badge: { tone: 'warning', label: 'Factura pendiente' },
      intro:
        'Hola Giovanna Maratta, todavía no recibimos tu factura correspondiente a la liquidación de Julio 2026. Por favor, emitíla por el importe de tu liquidación y cargala en el portal a la brevedad.',
      cta: { label: 'Cargar factura', url: 'https://app.pow.la/portal/liquidaciones' },
    }),
  };

  // ---- Room-booking ----
  previews['booking_confirmation'] = {
    label: 'Room-booking · reserva confirmada',
    html: renderEmail({
      title: 'Reserva confirmada',
      contextLabel: 'Salas · Reservas',
      badge: { tone: 'success', label: 'Confirmada' },
      intro: 'Hola Giovanna, tu reserva fue creada exitosamente.',
      details: [
        { label: 'Reunión', value: 'Kickoff Q3' },
        { label: 'Sala', value: 'Sala Naranja – Piso 3' },
        { label: 'Fecha', value: 'martes, 21 de julio de 2026' },
        { label: 'Horario', value: '10:00 – 11:00' },
      ],
      outro: 'Participantes invitados: ana@pow.la · lucas@pow.la',
      footerNote: 'Mensaje automático del sistema de reservas.',
    }),
  };

  // ---- ART Teletrabajo ----
  previews['art'] = {
    label: 'ART · teletrabajo (roster)',
    html: renderEmail({
      title: 'Formulario de Teletrabajo ART actualizado',
      contextLabel: 'ART · Teletrabajo',
      badge: { tone: 'neutral', label: 'Salida' },
      intro: 'Se adjunta el formulario Teletrabajo Berkley ART actualizado por cambio de domicilio de teletrabajo (inicio mañana).',
      bodyHtml:
        '<p style="margin:0 0 4px;font-size:13px;line-height:1.55;color:#374151;"><strong>Fecha de referencia del listado:</strong> 2026-07-21</p>' +
        '<p style="margin:0 0 13px;font-size:13px;line-height:1.55;color:#374151;"><strong>Empleados en relación de dependencia incluidos:</strong> 12</p>' +
        '<ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.7;"><li><strong>Ana Pérez</strong> (Trabajo remoto) — 2026-07-21 a 2026-07-25</li></ul>',
      footerNote: 'Envío automático desde app-hr.',
    }),
  };

  // ---- Automations ----
  previews['birthday'] = {
    label: 'Automations · cumpleaños',
    html: renderPlainTemplate({
      templateKey: 'birthday_greeting',
      subject: '🎂 ¡Feliz cumpleaños, Giovanna!',
      body: `¡Feliz cumpleaños, Giovanna!\n\nDe parte de todo el equipo de Pow, te deseamos un día increíble. ¡Que lo disfrutes!\n\nCon cariño,\nEquipo de People`,
    }),
  };

  return previews;
}

export async function GET(req: NextRequest) {
  // Sólo datos de ejemplo, pero igual expone el diseño interno de los mails.
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const previews = build();
  const key = new URL(req.url).searchParams.get('key');

  if (key) {
    const entry = previews[key];
    if (!entry) return NextResponse.json({ error: 'key no encontrada' }, { status: 404 });
    return new NextResponse(entry.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const cards = Object.entries(previews)
    .map(
      ([k, { label }]) => `
      <section style="margin:0 0 40px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;max-width:600px;margin:0 auto 10px;">
          <h2 style="margin:0;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#374151;letter-spacing:-0.01em;">${label}</h2>
          <a href="?key=${k}" target="_blank" style="font:600 11px -apple-system,sans-serif;color:#C2410C;text-decoration:none;">abrir ↗</a>
        </div>
        <iframe src="?key=${k}" style="width:100%;max-width:600px;height:560px;border:1px solid #DDDFE3;border-radius:12px;display:block;margin:0 auto;background:#fff;" loading="lazy"></iframe>
      </section>`,
    )
    .join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preview · Pow</title></head>
  <body style="margin:0;background:#e9eaed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:800px;margin:0 auto;padding:40px 16px 80px;">
      <h1 style="font:800 22px -apple-system,sans-serif;letter-spacing:-0.03em;color:#1A1D23;margin:0 0 4px;">Preview de emails · Pow</h1>
      <p style="font-size:13px;color:#6B7280;margin:0 0 36px;">Datos de ejemplo. Escala DS · CTA compacta.</p>
      ${cards}
    </div>
  </body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
