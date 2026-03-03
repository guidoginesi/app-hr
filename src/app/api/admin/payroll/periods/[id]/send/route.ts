import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';

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

    const MONTH_NAMES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const formatARS = (n: number) =>
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pow.la';

    let sentCount = 0;
    const errors: { settlement_id: string; error: string }[] = [];

    for (const s of settlements) {
      // Prefer the snapshot email; fall back to the live employee email from the view
      const emailTo = (s.email_to as string | null)?.trim() || (s.employee_email as string | null)?.trim() || null;
      if (!emailTo) {
        console.warn(`[Payroll Send] Settlement ${s.id} has no email_to, skipping email`);
      }

      const periodLabel = `${MONTH_NAMES[(s.period_month as number) - 1]} ${s.period_year}`;
      const employeeName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();

      let emailHtml: string;
      let emailSubject: string;

      if (s.contract_type_snapshot === 'MONOTRIBUTO') {
        emailSubject = `Liquidación ${periodLabel}`;

        const buildRow = (label: string, amount: number, isNegative = false) =>
          amount !== 0 ? `
              <tr style="border-bottom:1px solid #e4e4e7">
                <td style="padding:10px 0;color:#52525b">${label}</td>
                <td style="padding:10px 0;text-align:right;font-weight:600">${isNegative ? '−' : ''}${formatARS(Math.abs(amount))}</td>
              </tr>` : '';

        emailHtml = `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#18181b">
            <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">Liquidación ${periodLabel}</h2>
            <p style="color:#71717a;margin-top:0">Hola ${employeeName}, ya podés ver el detalle de tu liquidación.</p>
            <table style="width:100%;border-collapse:collapse;margin:24px 0">
              ${buildRow('Sueldo', s.sueldo ?? 0)}
              ${buildRow('Monotributo', s.monotributo ?? 0)}
              ${buildRow('Reintegro Internet', s.reintegro_internet ?? 0)}
              ${buildRow('Reintegro Extraordinario', s.reintegro_extraordinario ?? 0)}
              ${buildRow('Plus Vacacional', s.plus_vacacional ?? 0)}
              ${buildRow('Bonificación Anual', s.bonificacion_anual ?? 0)}
              ${buildRow('Aguinaldo', s.aguinaldo ?? 0)}
              ${buildRow('Adelanto de Sueldo', s.adelanto_sueldo ?? 0, true)}
              <tr style="background:#f4f4f5">
                <td style="padding:12px;font-weight:700;font-size:16px">Total a Facturar</td>
                <td style="padding:12px;text-align:right;font-weight:700;font-size:16px;color:#4f46e5">${formatARS(s.total_a_facturar ?? 0)}</td>
              </tr>
            </table>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px">
              <p style="margin:0;font-size:14px;color:#92400e">
                <strong>Recordá:</strong> emití la factura por el Total a Facturar y cargala en el portal dentro de 1 día hábil.
              </p>
            </div>
            <a href="${portalUrl}/portal/liquidaciones" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver en el portal</a>
          </div>`;
      } else {
        // RELACION_DEPENDENCIA
        emailSubject = `Recibo de sueldo ${periodLabel}`;
        emailHtml = `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#18181b">
            <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">Recibo de sueldo ${periodLabel}</h2>
            <p style="color:#71717a;margin-top:0">Hola ${employeeName}, tu recibo de sueldo de ${periodLabel} ya está disponible.</p>
            <p style="color:#52525b">Podés descargarlo desde el portal haciendo clic en el botón de abajo.</p>
            <a href="${portalUrl}/portal/recibos" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Descargar recibo</a>
          </div>`;
      }

      // Mark settlement as SENT in DB
      const { error: updateError } = await supabase
        .from('payroll_employee_settlements')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', s.id);

      if (updateError) {
        console.error(`[Payroll Send] Error updating settlement ${s.id}:`, updateError);
        errors.push({ settlement_id: s.id, error: updateError.message });
        continue;
      }

      // Send email and persist Resend ID + any error for traceability
      if (emailTo) {
        sendSimpleEmail({ to: emailTo, subject: emailSubject, html: emailHtml }).then((result) => {
          if (!result.success) {
            console.error(`[Payroll Send] Email failed for settlement ${s.id}:`, result.error);
            supabase
              .from('payroll_employee_settlements')
              .update({ email_provider_id: `ERROR: ${result.error}`, updated_at: new Date().toISOString() })
              .eq('id', s.id)
              .then(() => {});
          } else if (result.id) {
            supabase
              .from('payroll_employee_settlements')
              .update({ email_provider_id: result.id, updated_at: new Date().toISOString() })
              .eq('id', s.id)
              .then(() => {});
          }
        }).catch((err) => {
          console.error(`[Payroll Send] Email exception for settlement ${s.id}:`, err);
        });
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

    const message = sentCount > 0
      ? `${sentCount} liquidación${sentCount !== 1 ? 'es' : ''} enviada${sentCount !== 1 ? 's' : ''} correctamente`
      : 'No se pudo enviar ninguna liquidación';

    return NextResponse.json({ sent_count: sentCount, errors, message });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/send:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
