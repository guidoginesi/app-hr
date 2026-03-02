import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';

type RouteContext = { params: Promise<{ id: string }> };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// POST /api/admin/payroll/periods/[id]/claim-invoices
// Notifica a todos los Monotributistas SENT sin factura cargada
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('year, month')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    const periodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pow.la';

    // Buscar Monotributistas SENT sin factura
    const { data: settlements, error: fetchError } = await supabase
      .from('payroll_settlements_with_details')
      .select('id, first_name, last_name, email_to, user_id, invoice_storage_path')
      .eq('period_id', id)
      .eq('contract_type_snapshot', 'MONOTRIBUTO')
      .eq('status', 'SENT')
      .is('invoice_storage_path', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({
        notified_count: 0,
        message: 'No hay Monotributistas con facturas pendientes',
      });
    }

    let notifiedCount = 0;

    for (const s of settlements) {
      const employeeName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();

      // Email
      if (s.email_to) {
        sendSimpleEmail({
          to: s.email_to,
          subject: `Recordatorio: factura pendiente ${periodLabel}`,
          html: `
            <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#18181b">
              <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">Factura pendiente — ${periodLabel}</h2>
              <p style="color:#71717a;margin-top:0">Hola ${employeeName},</p>
              <p>Todavía no recibimos tu factura correspondiente a la liquidación de <strong>${periodLabel}</strong>.</p>
              <p>Por favor, emití la factura por el importe de tu liquidación y cargala en el portal o enviala a
                <a href="mailto:manuela@pow.la" style="color:#4f46e5">manuela@pow.la</a> a la brevedad.
              </p>
              <a href="${portalUrl}/portal/liquidaciones" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-top:16px">
                Cargar factura en el portal
              </a>
            </div>`,
        }).catch((err) => {
          console.error(`[ClaimInvoices] Email failed for settlement ${s.id}:`, err);
        });
      }

      // In-app notification
      const employeeUserId = s.employee_user_id ?? s.user_id;
      if (employeeUserId) {
        createSystemNotification({
          userIds: [employeeUserId],
          title: `Factura pendiente — ${periodLabel}`,
          body: `Todavía no recibimos tu factura de ${periodLabel}. Por favor cargala en el portal.`,
          deepLink: '/portal/liquidaciones',
          dedupeKey: `claim-invoice-${s.id}-${period.year}-${period.month}`,
        }).catch((err) => {
          console.error(`[ClaimInvoices] In-app notification failed for settlement ${s.id}:`, err);
        });
      }

      notifiedCount++;
    }

    return NextResponse.json({
      notified_count: notifiedCount,
      message: `Recordatorio enviado a ${notifiedCount} Monotributista${notifiedCount !== 1 ? 's' : ''} con factura pendiente`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/claim-invoices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
