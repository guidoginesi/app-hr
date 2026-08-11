// Resumen diario del Banco de Talentos para People.
//
// Va un mail por día en vez de uno por cada persona que deja sus datos: el
// formulario es público y no hay forma de saber si van a entrar dos por semana
// o veinte en una tarde.
//
// Lista lo que sigue en NUEVO, no sólo lo que llegó ayer: si nadie lo revisó,
// sigue esperando y el resumen tiene que decirlo. Los del último día van
// marcados, para distinguir lo que entró de lo que se viene arrastrando.
//
// Si no hay nada en NUEVO no se manda nada. Un mail diario que dice "no hay
// novedades" es un mail que se aprende a borrar sin leer.

import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { getRoleEmails } from '@/lib/notificationService';
import { escapeHtml, getAppUrl, getReplyTo, renderEmail } from '@/lib/email/layout';

export async function sendTalentPoolDigest(): Promise<{ sent: string[]; nuevos: number }> {
  const supabase = getSupabaseServer();

  const { data: entradas } = await supabase
    .from('talent_pool_entries')
    .select('id, candidate_id, areas, seniority, created_at, last_submitted_at')
    .eq('status', 'NEW')
    .order('created_at', { ascending: false });

  const pendientes = entradas ?? [];
  if (pendientes.length === 0) return { sent: [], nuevos: 0 };

  const { data: candidatos } = await supabase
    .from('candidates')
    .select('id, name, email')
    .in(
      'id',
      pendientes.map((e) => e.candidate_id as string),
    );
  const porId = new Map((candidatos ?? []).map((c) => [c.id as string, c]));

  const desdeAyer = Date.now() - 24 * 60 * 60 * 1000;
  const recientes = pendientes.filter((e) => new Date(e.created_at as string).getTime() > desdeAyer);

  const filas = pendientes
    .map((e) => {
      const c = porId.get(e.candidate_id as string);
      const esNuevo = new Date(e.created_at as string).getTime() > desdeAyer;
      const detalle = [
        (e.areas as string[])?.join(', '),
        e.seniority as string | null,
      ]
        .filter(Boolean)
        .join(' · ');
      return `
      <tr><td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
        <div style="font-size:13px;font-weight:600;color:#1A1D23;">${escapeHtml(
          c?.name ?? 'Sin nombre',
        )}${esNuevo ? ' <span style="color:#C2410C;">· nuevo</span>' : ''}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">${escapeHtml(detalle)}</div>
      </td></tr>`;
    })
    .join('');

  const total = pendientes.length;
  const titulo = `${total} perfil${total === 1 ? '' : 'es'} sin revisar en el Banco de Talentos`;

  const recipients = await getRoleEmails(['admin']);
  const sent: string[] = [];

  for (const r of recipients) {
    const res = await sendSimpleEmail({
      to: r.email,
      subject: titulo,
      replyTo: getReplyTo(),
      html: renderEmail({
        title: titulo,
        contextLabel: 'People · Reclutamiento',
        badge:
          recientes.length > 0
            ? { tone: 'success', label: `${recientes.length} nuevo(s)` }
            : undefined,
        preheader: 'Resumen diario del Banco de Talentos',
        intro: 'Esta gente dejó sus datos y todavía está sin revisar:',
        bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px;">${filas}</table>`,
        cta: { label: 'Ir al Banco de Talentos', url: `${getAppUrl()}/admin/recruiting/banco` },
        outro:
          'Este resumen se arma cada mañana con lo que sigue en Nuevo. Al pasar un perfil a En espera, Descartado o Asignado deja de aparecer.',
      }),
    });
    if (res.success) sent.push(r.email);
  }

  return { sent, nuevos: recientes.length };
}
