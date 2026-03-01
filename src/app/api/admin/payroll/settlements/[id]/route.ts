import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateMonotributoSchema = z.object({
  sueldo: z.number().min(0).optional(),
  monotributo: z.number().min(0).optional(),
  reintegro_internet: z.number().min(0).optional(),
  reintegro_extraordinario: z.number().min(0).optional(),
  plus_vacacional: z.number().min(0).optional(),
});

const UpdateSettlementSchema = z.object({
  status: z.enum(['DRAFT', 'READY_TO_SEND', 'SENT']).optional(),
  notes_internal: z.string().optional().nullable(),
  sueldo: z.number().min(0).optional(),
  monotributo: z.number().min(0).optional(),
  reintegro_internet: z.number().min(0).optional(),
  reintegro_extraordinario: z.number().min(0).optional(),
  plus_vacacional: z.number().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/payroll/settlements/[id] - Get single settlement with details
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('payroll_settlements_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/settlements/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/payroll/settlements/[id] - Update settlement
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateSettlementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get current settlement
    const { data: settlement, error: fetchError } = await supabase
      .from('payroll_employee_settlements')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    // Don't allow editing SENT settlements unless period is reopened (DRAFT)
    if (settlement.status === 'SENT') {
      const { data: period } = await supabase
        .from('payroll_periods')
        .select('status')
        .eq('id', settlement.period_id)
        .single();

      if (period?.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'No se puede editar una liquidación ya enviada' },
          { status: 400 }
        );
      }
    }

    const { status, notes_internal, ...breakdownFields } = parsed.data;

    // Update settlement fields
    const settlementUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status !== undefined) settlementUpdate.status = status;
    if (notes_internal !== undefined) settlementUpdate.notes_internal = notes_internal;

    // Handle MONOTRIBUTO breakdown update
    const monotributoParsed = UpdateMonotributoSchema.safeParse(breakdownFields);
    if (
      settlement.contract_type_snapshot === 'MONOTRIBUTO' &&
      monotributoParsed.success &&
      Object.keys(monotributoParsed.data).length > 0
    ) {
      // Get current breakdown to merge values
      const { data: currentBreakdown } = await supabase
        .from('payroll_monotributo_breakdown')
        .select('*')
        .eq('settlement_id', id)
        .single();

      const merged = {
        sueldo: monotributoParsed.data.sueldo ?? currentBreakdown?.sueldo ?? 0,
        monotributo: monotributoParsed.data.monotributo ?? currentBreakdown?.monotributo ?? 0,
        reintegro_internet: monotributoParsed.data.reintegro_internet ?? currentBreakdown?.reintegro_internet ?? 0,
        reintegro_extraordinario: monotributoParsed.data.reintegro_extraordinario ?? currentBreakdown?.reintegro_extraordinario ?? 0,
        plus_vacacional: monotributoParsed.data.plus_vacacional ?? currentBreakdown?.plus_vacacional ?? 0,
      };

      const total_a_facturar =
        merged.sueldo +
        merged.monotributo +
        merged.reintegro_internet +
        merged.reintegro_extraordinario +
        merged.plus_vacacional;

      const { error: breakdownError } = await supabase
        .from('payroll_monotributo_breakdown')
        .update({ ...merged, total_a_facturar })
        .eq('settlement_id', id);

      if (breakdownError) {
        console.error('Error updating monotributo breakdown:', breakdownError);
        return NextResponse.json({ error: breakdownError.message }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from('payroll_employee_settlements')
      .update(settlementUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating settlement:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/payroll/settlements/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
