import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/validate - Validate settlements and mark valid ones as READY_TO_SEND
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Verify period exists
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    // Get all DRAFT settlements for validation
    const { data: settlements, error: fetchError } = await supabase
      .from('payroll_employee_settlements')
      .select('id, contract_type_snapshot, employee_id')
      .eq('period_id', id)
      .eq('status', 'DRAFT');

    if (fetchError) {
      console.error('Error fetching settlements for validation:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({
        validated_count: 0,
        invalid_count: 0,
        details: [],
        message: 'No hay liquidaciones en borrador para validar',
      });
    }

    let validatedCount = 0;
    let invalidCount = 0;
    const details: { settlement_id: string; employee_id: string; valid: boolean; reason?: string }[] = [];

    for (const settlement of settlements) {
      let isValid = false;
      let reason: string | undefined;

      if (settlement.contract_type_snapshot === 'MONOTRIBUTO') {
        const { data: breakdown } = await supabase
          .from('payroll_monotributo_breakdown')
          .select('total_a_facturar')
          .eq('settlement_id', settlement.id)
          .single();

        if (breakdown && breakdown.total_a_facturar > 0) {
          isValid = true;
        } else {
          reason = 'El total a facturar debe ser mayor a 0';
        }
      } else if (settlement.contract_type_snapshot === 'RELACION_DEPENDENCIA') {
        const { data: payslip } = await supabase
          .from('payroll_payslips')
          .select('pdf_storage_path')
          .eq('settlement_id', settlement.id)
          .single();

        if (payslip && payslip.pdf_storage_path) {
          isValid = true;
        } else {
          reason = 'Falta cargar el recibo de sueldo (PDF)';
        }
      }

      if (isValid) {
        const { error: updateError } = await supabase
          .from('payroll_employee_settlements')
          .update({
            status: 'READY_TO_SEND',
            updated_at: new Date().toISOString(),
          })
          .eq('id', settlement.id);

        if (updateError) {
          console.error(`Error validating settlement ${settlement.id}:`, updateError);
          invalidCount++;
          details.push({
            settlement_id: settlement.id,
            employee_id: settlement.employee_id,
            valid: false,
            reason: `Error al actualizar: ${updateError.message}`,
          });
        } else {
          validatedCount++;
          details.push({
            settlement_id: settlement.id,
            employee_id: settlement.employee_id,
            valid: true,
          });
        }
      } else {
        invalidCount++;
        details.push({
          settlement_id: settlement.id,
          employee_id: settlement.employee_id,
          valid: false,
          reason,
        });
      }
    }

    return NextResponse.json({ validated_count: validatedCount, invalid_count: invalidCount, details });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/validate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
