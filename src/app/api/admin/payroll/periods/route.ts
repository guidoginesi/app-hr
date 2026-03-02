import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreatePeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

// GET /api/admin/payroll/periods - List all periods with settlement counts
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data: periods, error } = await supabase
      .from('payroll_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      console.error('Error fetching payroll periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const periodsWithCounts = await Promise.all(
      (periods || []).map(async (period) => {
        const { data: settlements } = await supabase
          .from('payroll_employee_settlements')
          .select('status')
          .eq('period_id', period.id);

        const counts = {
          total: settlements?.length || 0,
          draft: settlements?.filter((s) => s.status === 'DRAFT').length || 0,
          ready_to_send: settlements?.filter((s) => s.status === 'READY_TO_SEND').length || 0,
          sent: settlements?.filter((s) => s.status === 'SENT').length || 0,
        };

        return { ...period, settlement_counts: counts };
      })
    );

    return NextResponse.json({ periods: periodsWithCounts });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/payroll/periods - Create a new period with auto-generated settlements
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreatePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { year, month } = parsed.data;
    const period_key = `${year}-${String(month).padStart(2, '0')}`;

    const supabase = getSupabaseServer();

    // Check for duplicate period
    const { data: existing } = await supabase
      .from('payroll_periods')
      .select('id')
      .eq('period_key', period_key)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un período para ${period_key}` },
        { status: 400 }
      );
    }

    // Create the period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .insert({
        year,
        month,
        period_key,
        status: 'DRAFT',
        created_by: user.id,
      })
      .select()
      .single();

    if (periodError) {
      console.error('Error creating payroll period:', periodError);
      return NextResponse.json({ error: periodError.message }, { status: 500 });
    }

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, employment_type, personal_email, work_email')
      .eq('status', 'active');

    if (empError) {
      console.error('Error fetching employees:', empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ period, settlement_count: 0 }, { status: 201 });
    }

    // Bulk insert all settlements in one round-trip
    const settlementsToInsert = employees.map((emp) => ({
      period_id: period.id,
      employee_id: emp.id,
      contract_type_snapshot: emp.employment_type === 'dependency' ? 'RELACION_DEPENDENCIA' : 'MONOTRIBUTO',
      currency: 'ARS',
      status: 'DRAFT',
      email_to: emp.work_email || emp.personal_email || null,
    }));

    const { data: createdSettlements, error: settError } = await supabase
      .from('payroll_employee_settlements')
      .insert(settlementsToInsert)
      .select('id, contract_type_snapshot');

    if (settError || !createdSettlements) {
      console.error('Error bulk-creating settlements:', settError);
      return NextResponse.json({ error: settError?.message || 'Error al crear liquidaciones' }, { status: 500 });
    }

    const monotributoIds = createdSettlements
      .filter((s) => s.contract_type_snapshot === 'MONOTRIBUTO')
      .map((s) => s.id);

    const relDepIds = createdSettlements
      .filter((s) => s.contract_type_snapshot === 'RELACION_DEPENDENCIA')
      .map((s) => s.id);

    // Bulk insert breakdowns and payslips in parallel (2 round-trips total)
    const inserts: Promise<unknown>[] = [];

    if (monotributoIds.length > 0) {
      inserts.push(
        supabase.from('payroll_monotributo_breakdown').insert(
          monotributoIds.map((id) => ({
            settlement_id: id,
            sueldo: 0,
            monotributo: 0,
            reintegro_internet: 0,
            reintegro_extraordinario: 0,
            plus_vacacional: 0,
            total_a_facturar: 0,
          }))
        ).then()
      );
    }

    if (relDepIds.length > 0) {
      inserts.push(
        supabase.from('payroll_payslips').insert(
          relDepIds.map((id) => ({
            settlement_id: id,
            pdf_storage_path: null,
            pdf_filename: null,
            pdf_uploaded_at: null,
            pdf_uploaded_by: null,
          }))
        ).then()
      );
    }

    await Promise.all(inserts);

    return NextResponse.json(
      { period, settlement_count: createdSettlements.length },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
