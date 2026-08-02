import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendBatchEmails } from '@/lib/emailService';
import { renderEmail, type DetailRow } from '@/lib/email/layout';
import { createSystemNotification } from '@/lib/notificationService';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from '@/lib/payrollPeriods';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/send - Bulk send for a period
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Optional body with specific settlement IDs to send
    let settlementIds: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.settlement_ids) && body.settlement_ids.length > 0) {
        settlementIds = body.settlement_ids;
      }
    } catch { /* no body = send all */ }

    // Verify period exists
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    // Get sendable settlements: DRAFT or READY_TO_SEND (optionally filtered by IDs)
    let query = supabase
      .from('payroll_settlements_with_details')
      .select('*')
      .eq('period_id', id)
      .in('status', ['DRAFT', 'READY_TO_SEND']);

    if (settlementIds) {
      query = query.in('id', settlementIds);
    }

    const { data: settlements, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching settlements for send:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({
        sent_count: 0,
        errors: [],
        message: 'No hay liquidaciones para enviar (todas ya fueron enviadas)',
      });
    }

    const formatARS = (n: number) =>
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pow.la';

    let sentCount = 0;
    const errors: { settlement_id: string; error: string }[] = [];

    // Emails queued for batch sending: { settlementId, to, subject, html }
    const pendingEmails: Array<{ settlementId: string; to: string; subject: string; html: string }> = [];

    for (const s of settlements) {
      // Prefer the snapshot email; fall back to the live employee email from the view
      const emailTo = (s.email_to as string | null)?.trim() || (s.employee_email as string | null)?.trim() || null;
      if (!emailTo) {
        console.warn(`[Payroll Send] Settlement ${s.id} has no email_to, skipping email`);
      }

      const periodLabel = formatPayrollPeriodLabelFromKey({
        year: s.period_year as number,
        month: s.period_month as number,
        period_type: (s.period_type as PayrollPeriodType | null) ?? 'MONTHLY',
      });
      const employeeName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();

      let emailHtml: string;
      let emailSubject: string;

      if (s.contract_type_snapshot === 'MONOTRIBUTO') {
        emailSubject = `Liquidación ${periodLabel}`;

        const lineItems: Array<[string, number, boolean?]> = [
          ['Sueldo', s.sueldo ?? 0],
          ['Monotributo', s.monotributo ?? 0],
          ['Reintegro Internet', s.reintegro_internet ?? 0],
          ['Reintegro Extraordinario', s.reintegro_extraordinario ?? 0],
          ['Plus Vacacional', s.plus_vacacional ?? 0],
          ['Bonificación Anual', s.bonificacion_anual ?? 0],
          ['Aguinaldo', s.aguinaldo ?? 0],
          ['Adelanto de Sueldo', s.adelanto_sueldo ?? 0, true],
        ];
        const details: DetailRow[] = lineItems
          .filter(([, amount]) => amount !== 0)
          .map(([label, amount, isNegative]) => ({
            label,
            value: `${isNegative ? '−' : ''}${formatARS(Math.abs(amount))}`,
          }));
        details.push({ label: 'Total a Facturar', value: formatARS(s.total_a_facturar ?? 0), strong: true });

        emailHtml = renderEmail({
          title: 'Tu liquidación está disponible',
          contextLabel: 'People · Liquidaciones',
          badge: { tone: 'neutral', label: periodLabel },
          preheader: `Tu liquidación de ${periodLabel} ya está disponible.`,
          intro: `Hola ${employeeName}, ya podés ver el detalle de tu liquidación.`,
          details,
          cta: { label: 'Ver en el portal', url: `${portalUrl}/portal/liquidaciones` },
          outro: 'Recordá: emití la factura por el Total a Facturar y cargala en el portal dentro de 1 día hábil.',
        });
      } else {
        // RELACION_DEPENDENCIA
        emailSubject = `Recibo de sueldo ${periodLabel}`;
        emailHtml = renderEmail({
          title: 'Tu recibo de sueldo está disponible',
          contextLabel: 'People · Recibos',
          badge: { tone: 'neutral', label: periodLabel },
          preheader: `Tu recibo de sueldo de ${periodLabel} ya está disponible.`,
          intro: `Hola ${employeeName}, tu recibo de sueldo de ${periodLabel} ya está disponible. Podés descargarlo desde el portal.`,
          cta: { label: 'Descargar recibo', url: `${portalUrl}/portal/recibos` },
          outro:
            'Cuando lo descargues, marcá la casilla "Recibido" en el portal para dejar constancia de la recepción. No implica conformidad con lo liquidado.',
        });
      }

      // Mark settlement as SENT in DB; also persist resolved email so future re-sends work
      const { error: updateError } = await supabase
        .from('payroll_employee_settlements')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          email_to: emailTo ?? undefined,   // persist resolved email if snapshot was missing
          updated_at: new Date().toISOString(),
        })
        .eq('id', s.id);

      if (updateError) {
        console.error(`[Payroll Send] Error updating settlement ${s.id}:`, updateError);
        errors.push({ settlement_id: s.id, error: updateError.message });
        continue;
      }

      // Queue email for batch dispatch
      if (emailTo) {
        pendingEmails.push({ settlementId: s.id, to: emailTo, subject: emailSubject, html: emailHtml });
      }

      // Send in-app notification if employee has a user account
      const employeeUserId = s.employee_user_id;
      if (employeeUserId) {
        const notifTitle = s.contract_type_snapshot === 'MONOTRIBUTO'
          ? `Liquidación ${periodLabel} disponible`
          : `Recibo de sueldo ${periodLabel} disponible`;
        const notifBody = s.contract_type_snapshot === 'MONOTRIBUTO'
          ? `Ya podés ver el detalle de tu liquidación de ${periodLabel} en el portal.`
          : `Tu recibo de sueldo de ${periodLabel} ya está disponible para descargar.`;
        const deepLink = s.contract_type_snapshot === 'MONOTRIBUTO'
          ? '/portal/liquidaciones'
          : '/portal/recibos';
        createSystemNotification({
          userIds: [employeeUserId],
          title: notifTitle,
          body: notifBody,
          deepLink,
          dedupeKey: `payroll-sent-${s.id}`,
        }).catch((err) => {
          console.error(`[Payroll Send] In-app notification failed for settlement ${s.id}:`, err);
        });
      }

      sentCount++;
    }

    // Dispatch all emails in a single batch call (fire-and-forget), then persist Resend IDs
    if (pendingEmails.length > 0) {
      sendBatchEmails(pendingEmails.map((e) => ({ to: e.to, subject: e.subject, html: e.html })))
        .then((result) => {
          if (!result.success) {
            console.error('[Payroll Send] Batch email failed:', result.error);
            for (const e of pendingEmails) {
              supabase
                .from('payroll_employee_settlements')
                .update({ email_provider_id: `ERROR: ${result.error}`, updated_at: new Date().toISOString() })
                .eq('id', e.settlementId)
                .then(() => {});
            }
            return;
          }
          const ids = result.ids ?? [];
          pendingEmails.forEach((e, i) => {
            const providerId = ids[i] ?? null;
            supabase
              .from('payroll_employee_settlements')
              .update({
                email_provider_id: providerId ?? `ERROR: no ID returned`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', e.settlementId)
              .then(() => {});
          });
        })
        .catch((err) => {
          console.error('[Payroll Send] Batch email exception:', err);
        });
    }

    const message = sentCount > 0
      ? `${sentCount} liquidación${sentCount !== 1 ? 'es' : ''} enviada${sentCount !== 1 ? 's' : ''} correctamente`
      : 'No se pudo enviar ninguna liquidación';

    return NextResponse.json({ sent_count: sentCount, errors, message });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/send:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
