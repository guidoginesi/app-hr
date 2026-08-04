import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { computeBudget } from '@/lib/training';
import type { TrainingRequestStatus } from '@/types/training';

export const dynamic = 'force-dynamic';

const DEFAULT_BUDGET_USD = 500;
// Tope de cordura: un budget individual por encima de esto es casi seguro un
// error de tipeo (un cero de más), no una decisión.
const MAX_BUDGET_USD = 100_000;

type BudgetRow = {
  employee_id: string;
  employee_name: string;
  department: string;
  total_usd: number;
  committed_usd: number;
  consumed_usd: number;
  available_usd: number;
  is_override: boolean;
  note: string | null;
};

/**
 * Arma la vista completa del budget de un año: fila por persona activa, el
 * agregado por área y el global. Lo usan tanto el GET como el POST, para que
 * después de escribir la UI reciba el estado ya recalculado y no tenga que
 * pedirlo de nuevo.
 */
async function buildBudgetView(year: number) {
  const supabase = getSupabaseServer();

  const results = await Promise.all([
    supabase.from('training_budget_config').select('default_amount_usd').eq('year', year).maybeSingle(),
    supabase.from('training_budget_overrides').select('employee_id, amount_usd, note').eq('year', year),
    supabase.from('employees').select('id, first_name, last_name, department_id').eq('status', 'active'),
    supabase.from('training_requests').select('employee_id, cost_usd, status').eq('budget_year', year),
    supabase.from('departments').select('id, name'),
  ]);

  // Sin esto una query fallada es indistinguible de "no hay filas": el ?? [] la
  // silencia y la vista sale con 200. Después de una escritura es peor todavía,
  // porque los warnings salen vacíos y confirman que no pasó nada raro.
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const [{ data: cfg }, { data: overrides }, { data: employees }, { data: requests }, { data: departments }] =
    results;

  const defaultUsd = cfg ? Number(cfg.default_amount_usd) : DEFAULT_BUDGET_USD;
  const overrideMap = new Map<string, { amount: number; note: string | null }>(
    (overrides ?? []).map((o) => [o.employee_id as string, { amount: Number(o.amount_usd), note: (o.note as string) ?? null }]),
  );
  const deptMap = new Map<string, string>((departments ?? []).map((d) => [d.id as string, d.name as string]));

  const reqByEmp = new Map<string, { status: TrainingRequestStatus; cost_usd: number | null }[]>();
  for (const r of requests ?? []) {
    const list = reqByEmp.get(r.employee_id as string) ?? [];
    list.push({ status: r.status as TrainingRequestStatus, cost_usd: r.cost_usd });
    reqByEmp.set(r.employee_id as string, list);
  }

  const rows: BudgetRow[] = (employees ?? []).map((e) => {
    const ov = overrideMap.get(e.id as string);
    const total = ov?.amount ?? defaultUsd;
    const b = computeBudget(total, reqByEmp.get(e.id as string) ?? []);
    return {
      employee_id: e.id as string,
      employee_name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      department: e.department_id ? deptMap.get(e.department_id as string) ?? 'Sin área' : 'Sin área',
      total_usd: b.total_usd,
      committed_usd: b.committed_usd,
      consumed_usd: b.consumed_usd,
      available_usd: b.available_usd,
      is_override: ov !== undefined,
      note: ov?.note ?? null,
    };
  });

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

  return { year, rows, byArea, global, default_usd: defaultUsd };
}

// GET /api/admin/training/budget?year=2026
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const raw = new URL(req.url).searchParams.get('year');
    const parsedYear = yearSchema.safeParse(Number(raw) || new Date().getFullYear());
    if (!parsedYear.success) return NextResponse.json({ error: 'Año inválido.' }, { status: 400 });

    return NextResponse.json(await buildBudgetView(parsedYear.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const yearSchema = z.number().int().min(2020, 'Año inválido.').max(2100, 'Año inválido.');
const amountSchema = z
  .number({ message: 'El monto tiene que ser un número.' })
  .finite('El monto tiene que ser un número.')
  .min(0, 'El monto no puede ser negativo.')
  .max(MAX_BUDGET_USD, `El monto no puede superar USD ${MAX_BUDGET_USD.toLocaleString('es-AR')}.`);

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_override'),
    year: yearSchema,
    employee_ids: z.array(dbId('Identificador inválido.')).min(1, 'Elegí al menos una persona.').max(500, 'Máximo 500 personas por vez.'),
    amount_usd: amountSchema,
    note: z.string().trim().max(280, 'La nota no puede superar 280 caracteres.').optional(),
  }),
  z.object({
    action: z.literal('clear_override'),
    year: yearSchema,
    employee_ids: z.array(dbId('Identificador inválido.')).min(1, 'Elegí al menos una persona.').max(500, 'Máximo 500 personas por vez.'),
  }),
  z.object({
    action: z.literal('set_default'),
    year: yearSchema,
    default_amount_usd: amountSchema,
  }),
]);

/**
 * POST /api/admin/training/budget
 *
 * Tres acciones, todas idempotentes:
 *  - set_override:   fija el budget de una o varias personas para el año.
 *  - clear_override: las devuelve al default del año (borra el override).
 *  - set_default:    cambia el default anual, que aplica a quien no tenga override.
 *
 * Devuelve la vista ya recalculada y, cuando corresponde, las personas que
 * quedaron con el budget por debajo de lo que ya comprometieron o gastaron.
 */
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const body = parsed.data;
    if ('employee_ids' in body) body.employee_ids = Array.from(new Set(body.employee_ids));
    const supabase = getSupabaseServer();

    if (body.action === 'set_default') {
      const { error } = await supabase
        .from('training_budget_config')
        .upsert(
          { year: body.year, default_amount_usd: body.default_amount_usd, created_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'year' },
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Asignar exige persona activa; revocar no. Si al dar de baja a alguien el
      // override quedara inmutable, un budget propio sería imposible de sacar.
      const employeeQuery = supabase.from('employees').select('id').in('id', body.employee_ids);
      const { data: valid, error: empError } = await (body.action === 'set_override'
        ? employeeQuery.eq('status', 'active')
        : employeeQuery);
      if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });

      const validIds = new Set((valid ?? []).map((e) => e.id as string));
      const unknown = body.employee_ids.filter((id) => !validIds.has(id));
      if (unknown.length > 0) {
        return NextResponse.json(
          {
            error:
              body.action === 'set_override'
                ? `${unknown.length} de las personas seleccionadas no están activas.`
                : `${unknown.length} de las personas seleccionadas no existen.`,
          },
          { status: 400 },
        );
      }

      if (body.action === 'set_override') {
        // El upsert reemplaza la fila entera, así que sin esto una edición de
        // monto borraría la nota que había cargado otra persona.
        const { data: existing, error: readError } = await supabase
          .from('training_budget_overrides')
          .select('employee_id, note')
          .eq('year', body.year)
          .in('employee_id', body.employee_ids);
        if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
        const previousNote = new Map<string, string | null>(
          (existing ?? []).map((o) => [o.employee_id as string, (o.note as string) ?? null]),
        );

        const now = new Date().toISOString();
        const { error } = await supabase.from('training_budget_overrides').upsert(
          body.employee_ids.map((employee_id) => ({
            employee_id,
            year: body.year,
            amount_usd: body.amount_usd,
            note: body.note ?? previousNote.get(employee_id) ?? null,
            // Sin tabla de historial, created_by queda como "quién lo fijó por
            // última vez". Es el dato útil cuando alguien pregunta por un monto.
            created_by: user?.id ?? null,
            updated_at: now,
          })),
          { onConflict: 'employee_id,year' },
        );
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase
          .from('training_budget_overrides')
          .delete()
          .eq('year', body.year)
          .in('employee_id', body.employee_ids);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const view = await buildBudgetView(body.year);

    // Bajar un budget por debajo de lo ya comprometido/consumido es legítimo
    // (por ejemplo al corregir una carga), pero deja a esa persona en cero sin
    // explicación visible. Se avisa en vez de bloquear.
    const touched = body.action === 'set_default'
      ? view.rows.filter((r) => !r.is_override)
      : view.rows.filter((r) => body.employee_ids.includes(r.employee_id));
    const warnings = touched
      .filter((r) => r.committed_usd + r.consumed_usd > r.total_usd)
      .map((r) => ({
        employee_name: r.employee_name,
        total_usd: r.total_usd,
        used_usd: r.committed_usd + r.consumed_usd,
      }));

    return NextResponse.json({ ...view, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
