import { getSupabaseServer } from './supabaseServer';
import { getRoleEmails } from './notificationService';
import { sendSimpleEmail } from './emailService';
import { renderEmail, getAppUrl, escapeHtml } from './email/layout';

/**
 * Resumen diario de aprobaciones pendientes.
 *
 * Recorre las colas de aprobación de Adelantos y Capacitaciones y envía UN mail
 * consolidado a cada aprobador con lo que está esperando su decisión:
 *   - Adelantos `pending_hr`      → rol admin (RRHH / People)
 *   - Adelantos `pending_admin`   → rol administracion
 *   - Capacitaciones `requested`      → líder (manager) del colaborador
 *   - Capacitaciones `leader_approved`→ rol admin (HR)
 *
 * Se dispara desde el cron diario. No usa dedupe: es un recordatorio que se
 * repite cada mañana hasta que la cola queda vacía. Si no hay nada pendiente
 * para un aprobador, no se le manda nada (sin mails vacíos).
 */

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

type PendingItem = { title: string; sub: string };
type Areas = { advances: boolean; trainings: boolean };

function itemsHtml(items: PendingItem[]): string {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
          <div style="font-size:13px;font-weight:600;color:#1A1D23;line-height:1.3;">${escapeHtml(it.title)}</div>
          <div style="font-size:12px;color:#6B7280;line-height:1.3;margin-top:2px;">${escapeHtml(it.sub)}</div>
        </td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px;">${rows}</table>`;
}

async function sendDigest(
  recipient: { email: string; name: string },
  items: PendingItem[],
  areas: Areas,
): Promise<boolean> {
  const firstName = recipient.name?.split(' ')[0] || 'equipo';
  const count = items.length;
  const noun = count === 1 ? 'solicitud' : 'solicitudes';

  const advUrl = `${getAppUrl()}/admin/salary-advances`;
  const trUrl = `${getAppUrl()}/admin/training`;
  const cta = areas.advances
    ? { label: 'Ir a Adelantos', url: advUrl }
    : { label: 'Ir a Capacitaciones', url: trUrl };
  const secondary =
    areas.advances && areas.trainings
      ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;"><a href="${trUrl}" style="color:#1A1D23;font-weight:600;text-decoration:none;">Ver también Capacitaciones →</a></p>`
      : '';

  const html = renderEmail({
    title: `Tenés ${count} ${noun} por aprobar`,
    contextLabel: 'People · Aprobaciones',
    preheader: `Resumen diario · ${count} pendiente${count === 1 ? '' : 's'} de aprobación`,
    intro: `Hola ${firstName}, esto es lo que está esperando tu aprobación en la app de HR:`,
    bodyHtml: itemsHtml(items) + secondary,
    cta,
    outro:
      'Este resumen se arma automáticamente cada mañana con lo que sigue pendiente. Si ya lo resolviste, ignoralo.',
    footerNote: 'Recibís este correo porque sos aprobador/a en la app de HR.',
  });

  const res = await sendSimpleEmail({
    to: recipient.email,
    subject: `Tenés ${count} ${noun} por aprobar`,
    html,
  });
  return res.success;
}

export async function sendApprovalDigests(): Promise<{ sent: string[]; errors: string[] }> {
  const supabase = getSupabaseServer();
  const sent: string[] = [];
  const errors: string[] = [];

  // ── Colas pendientes ──────────────────────────────────────────────
  const { data: advances } = await supabase
    .from('salary_advances_with_details')
    .select('id, employee_name, amount, status')
    .in('status', ['pending_hr', 'pending_admin']);

  const { data: trainings } = await supabase
    .from('training_requests')
    .select('id, employee_id, course_name, cost, currency, status, leader_id')
    .in('status', ['requested', 'leader_approved']);

  const pendingHrAdv = (advances ?? []).filter((a: any) => a.status === 'pending_hr');
  const pendingAdminAdv = (advances ?? []).filter((a: any) => a.status === 'pending_admin');
  const requestedTr = (trainings ?? []).filter((t: any) => t.status === 'requested');
  const hrTr = (trainings ?? []).filter((t: any) => t.status === 'leader_approved');

  // Nombres de colaboradores + datos de líderes para capacitaciones
  const empIds = [
    ...new Set(
      [...requestedTr, ...hrTr].flatMap((t: any) => [t.employee_id, t.leader_id]).filter(Boolean),
    ),
  ];
  let emps: any[] = [];
  if (empIds.length) {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, work_email, personal_email')
      .in('id', empIds);
    emps = data ?? [];
  }
  const empById = new Map<string, any>(emps.map((e: any) => [e.id, e]));
  const empName = (id: string) => {
    const e = empById.get(id);
    return e ? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || 'Colaborador' : 'Colaborador';
  };
  const trCost = (t: any) =>
    `${t.currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(t.cost) || 0)}`;

  // ── 1. RRHH / admin: adelantos pending_hr + capacitaciones pend. de HR ──
  const adminItems: PendingItem[] = [
    ...pendingHrAdv.map((a: any) => ({
      title: `Adelanto · ${a.employee_name}`,
      sub: `${ars(a.amount)} · pendiente de RRHH`,
    })),
    ...hrTr.map((t: any) => ({
      title: `Capacitación · ${empName(t.employee_id)}`,
      sub: `${t.course_name} · ${trCost(t)} · pendiente de HR`,
    })),
  ];
  if (adminItems.length) {
    const recipients = await getRoleEmails(['admin']);
    if (!recipients.length) errors.push('admin: sin destinatarios con email');
    for (const r of recipients) {
      const ok = await sendDigest(r, adminItems, {
        advances: pendingHrAdv.length > 0,
        trainings: hrTr.length > 0,
      });
      ok ? sent.push(`admin:${r.email}(${adminItems.length})`) : errors.push(`admin:${r.email}`);
    }
  }

  // ── 2. Administración: adelantos pending_admin ───────────────────────
  const adminqItems: PendingItem[] = pendingAdminAdv.map((a: any) => ({
    title: `Adelanto · ${a.employee_name}`,
    sub: `${ars(a.amount)} · pendiente de Administración`,
  }));
  if (adminqItems.length) {
    const recipients = await getRoleEmails(['administracion']);
    if (!recipients.length) errors.push('administracion: sin destinatarios con email');
    for (const r of recipients) {
      const ok = await sendDigest(r, adminqItems, { advances: true, trainings: false });
      ok
        ? sent.push(`administracion:${r.email}(${adminqItems.length})`)
        : errors.push(`administracion:${r.email}`);
    }
  }

  // ── 3. Líderes: capacitaciones 'requested' esperando su aprobación ────
  const byLeader = new Map<string, any[]>();
  for (const t of requestedTr) {
    if (!t.leader_id) continue;
    const arr = byLeader.get(t.leader_id) ?? [];
    arr.push(t);
    byLeader.set(t.leader_id, arr);
  }
  for (const [leaderId, leaderTrainings] of byLeader) {
    const l = empById.get(leaderId);
    const email = l?.work_email || l?.personal_email;
    if (!email) {
      errors.push(`leader ${leaderId}: sin email`);
      continue;
    }
    const pending: PendingItem[] = leaderTrainings.map((t: any) => ({
      title: `Capacitación · ${empName(t.employee_id)}`,
      sub: `${t.course_name} · ${trCost(t)} · espera tu aprobación`,
    }));
    const ok = await sendDigest(
      { email, name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() },
      pending,
      { advances: false, trainings: true },
    );
    ok ? sent.push(`leader:${email}(${pending.length})`) : errors.push(`leader:${email}`);
  }

  return { sent, errors };
}
