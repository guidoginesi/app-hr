import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdatePeriodSchema = z.object({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SENT', 'CLOSED']),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/payroll/periods/[id] - Get period with all settlements
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (periodError) {
      if (periodError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: periodError.message }, { status: 500 });
    }

    const { data: settlements, error: settError } = await supabase
      .from('payroll_settlements_with_details')
      .select('*')
      .eq('period_id', id);

    if (settError) {
      console.error('Error fetching settlements:', settError);
      return NextResponse.json({ error: settError.message }, { status: 500 });
    }

    return NextResponse.json({ period, settlements: settlements || [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/payroll/periods/[id] - Update period status with transition validation
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdatePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get current period
    const { data: period, error: fetchError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    const currentStatus = period.status;
    const newStatus = parsed.data.status;

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['IN_REVIEW'],
      IN_REVIEW: ['SENT', 'DRAFT'],
      SENT: ['CLOSED'],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transición de estado no permitida: ${currentStatus} → ${newStatus}` },
        { status: 400 }
      );
    }

    // Get settlements for validation
    const { data: settlements } = await supabase
      .from('payroll_employee_settlements')
      .select('status')
      .eq('period_id', id);

    // DRAFT → IN_REVIEW: all settlements must exist
    if (currentStatus === 'DRAFT' && newStatus === 'IN_REVIEW') {
      if (!settlements || settlements.length === 0) {
        return NextResponse.json(
          { error: 'No se puede pasar a revisión sin liquidaciones generadas' },
          { status: 400 }
        );
      }
    }

    // IN_REVIEW → SENT: all settlements must be READY_TO_SEND or SENT
    if (currentStatus === 'IN_REVIEW' && newStatus === 'SENT') {
      const notReady = settlements?.filter(
        (s) => s.status !== 'READY_TO_SEND' && s.status !== 'SENT'
      );
      if (notReady && notReady.length > 0) {
        return NextResponse.json(
          { error: `Hay ${notReady.length} liquidación(es) que no están listas para enviar` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('payroll_periods')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payroll period:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/payroll/periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/payroll/periods/[id] - Delete period (only DRAFT, no SENT settlements)
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get period
    const { data: period, error: fetchError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    if (period.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar períodos en estado BORRADOR' },
        { status: 400 }
      );
    }

    // Check for SENT settlements
    const { data: sentSettlements } = await supabase
      .from('payroll_employee_settlements')
      .select('id')
      .eq('period_id', id)
      .eq('status', 'SENT')
      .limit(1);

    if (sentSettlements && sentSettlements.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un período con liquidaciones enviadas' },
        { status: 400 }
      );
    }

    // Delete related records first (breakdowns, payslips, settlements)
    const { data: settlementIds } = await supabase
      .from('payroll_employee_settlements')
      .select('id')
      .eq('period_id', id);

    if (settlementIds && settlementIds.length > 0) {
      const ids = settlementIds.map((s) => s.id);

      await supabase
        .from('payroll_monotributo_breakdown')
        .delete()
        .in('settlement_id', ids);

      await supabase
        .from('payroll_payslips')
        .delete()
        .in('settlement_id', ids);

      await supabase
        .from('payroll_employee_settlements')
        .delete()
        .eq('period_id', id);
    }

    const { error } = await supabase
      .from('payroll_periods')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payroll period:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/payroll/periods/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
