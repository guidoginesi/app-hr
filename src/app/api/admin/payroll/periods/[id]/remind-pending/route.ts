import { NextRequest, NextResponse } from 'next/server';
import { requirePayrollReceiptsViewer } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { findPendingReceipts, sendReceiptReminders } from '@/lib/payrollReceiptReminders';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/remind-pending
// Recordatorio manual a quienes todavía no confirmaron la recepción de su recibo.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePayrollReceiptsViewer();
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = auth.user;

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const pending = await findPendingReceipts(supabase, { periodId: id });
    if (pending.length === 0) {
      return NextResponse.json({
        notified_count: 0,
        message: 'No hay recibos pendientes de confirmación en este período',
      });
    }

    const { notified } = await sendReceiptReminders(supabase, pending, {
      automated: false,
      sentBy: user.id,
    });

    return NextResponse.json({
      notified_count: notified,
      message: `Recordatorio enviado a ${notified} colaborador${notified !== 1 ? 'es' : ''} con recibo pendiente de confirmar`,
    });
  } catch (error: any) {
    console.error('Error in POST /remind-pending:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
