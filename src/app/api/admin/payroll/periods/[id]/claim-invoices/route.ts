import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { findPendingInvoices, sendInvoiceReminders } from '@/lib/payrollInvoiceReminders';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/payroll/periods/[id]/claim-invoices
 *
 * El reclamo a mano de un período. Comparte el texto y el registro con la
 * cadencia automática (ver payrollInvoiceReminders): si fueran dos caminos, el
 * mail terminaría diciendo dos cosas distintas según quién lo dispare.
 *
 * Queda registrado como NO automático, así que no le gasta el cupo a la cadencia:
 * apretar el botón no apaga los recordatorios que iban a salir solos.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const pendientes = await findPendingInvoices(supabase, { periodId: id });
    if (pendientes.length === 0) {
      return NextResponse.json({
        notified_count: 0,
        message: 'No hay Monotributistas con facturas pendientes',
      });
    }

    const res = await sendInvoiceReminders(supabase, pendientes, { automated: false, sentBy: user.id });

    return NextResponse.json({
      notified_count: res.notified,
      message: `Recordatorio enviado a ${res.notified} Monotributista${res.notified !== 1 ? 's' : ''} con factura pendiente`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('Error in POST /api/admin/payroll/periods/[id]/claim-invoices:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
