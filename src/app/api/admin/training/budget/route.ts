import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { computeBudget } from '@/lib/training';
import type { TrainingRequestStatus } from '@/types/training';

export const dynamic = 'force-dynamic';

// GET /api/admin/training/budget?year=2026
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseServer();
    const year = Number(new URL(req.url).searchParams.get('year')) || new Date().getFullYear();

    const [{ data: cfg }, { data: overrides }, { data: employees }, { data: requests }, { data: departments }] =
      await Promise.all([
        supabase.from('training_budget_config').select('default_amount_usd').eq('year', year).maybeSingle(),
        supabase.from('training_budget_overrides').select('employee_id, amount_usd').eq('year', year),
        supabase.from('employees').select('id, first_name, last_name, department_id').eq('status', 'active'),
        supabase.from('training_requests').select('employee_id, cost_usd, status').eq('budget_year', year),
        supabase.from('departments').select('id, name'),
      ]);

    const defaultUsd = cfg ? Number(cfg.default_amount_usd) : 500;
    const overrideMap = new Map<string, number>((overrides ?? []).map((o) => [o.employee_id as string, Number(o.amount_usd)]));
    const deptMap = new Map<string, string>((departments ?? []).map((d) => [d.id as string, d.name as string]));

    const reqByEmp = new Map<string, { status: TrainingRequestStatus; cost_usd: number | null }[]>();
    for (const r of requests ?? []) {
      const list = reqByEmp.get(r.employee_id as string) ?? [];
      list.push({ status: r.status as TrainingRequestStatus, cost_usd: r.cost_usd });
      reqByEmp.set(r.employee_id as string, list);
    }

    const rows = (employees ?? []).map((e) => {
      const total = overrideMap.get(e.id as string) ?? defaultUsd;
      const b = computeBudget(total, reqByEmp.get(e.id as string) ?? []);
      return {
        employee_id: e.id,
        employee_name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
        department: e.department_id ? deptMap.get(e.department_id as string) ?? 'Sin área' : 'Sin área',
        total_usd: b.total_usd,
        committed_usd: b.committed_usd,
        consumed_usd: b.consumed_usd,
        available_usd: b.available_usd,
      };
    });

    // Agregado por área
    const byAreaMap = new Map<string, { area: string; total: number; committed: number; consumed: number; available: number; count: number }>();
    for (const r of rows) {
      const a = byAreaMap.get(r.department) ?? { area: r.department, total: 0, committed: 0, consumed: 0, available: 0, count: 0 };
      a.total += r.total_usd; a.committed += r.committed_usd; a.consumed += r.consumed_usd; a.available += r.available_usd; a.count += 1;
      byAreaMap.set(r.department, a);
    }
    const byArea = Array.from(byAreaMap.values()).sort((x, y) => x.area.localeCompare(y.area));

    const global = rows.reduce(
      (acc, r) => ({
        total: acc.total + r.total_usd,
        committed: acc.committed + r.committed_usd,
        consumed: acc.consumed + r.consumed_usd,
        available: acc.available + r.available_usd,
      }),
      { total: 0, committed: 0, consumed: 0, available: 0 },
    );

    rows.sort((a, b) => (b.committed_usd + b.consumed_usd) - (a.committed_usd + a.consumed_usd));

    return NextResponse.json({ year, rows, byArea, global });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
