import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Habilitación del módulo de reintegros, persona por persona.
 *
 * El módulo NO es para todo el equipo (decisión de Guido). Se eligió lista
 * explícita sobre "por área" y "por tipo de contrato" porque esos dos dan o quitan
 * el acceso solo cuando alguien cambia de área o de contrato, sin que nadie lo
 * haya decidido.
 *
 * Sólo `admin`: no lo administra Administración, porque decidir quién puede pedir
 * reintegros es una decisión de People, no del que después los paga.
 */
async function buildView() {
  const supabase = getSupabaseServer();

  const [employees, access, depts] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, job_title, department_id, work_email, personal_email')
      .eq('status', 'active'),
    supabase.from('expense_reimbursement_access').select('employee_id, granted_by, granted_at'),
    supabase.from('departments').select('id, name'),
  ]);

  // Un error de lectura acá mostraría a todos como no habilitados, que es una
  // mentira peligrosa en una pantalla de permisos.
  for (const r of [employees, access, depts]) {
    if (r.error) throw new Error(r.error.message);
  }

  const deptById = new Map<string, string>((depts.data ?? []).map((d) => [d.id as string, d.name as string]));
  const enabledBy = new Map<string, { granted_at: string }>(
    (access.data ?? []).map((a) => [a.employee_id as string, { granted_at: a.granted_at as string }]),
  );

  const rows = (employees.data ?? []).map((e) => ({
    employee_id: e.id as string,
    employee_name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
    job_title: (e.job_title as string) ?? null,
    department: e.department_id ? deptById.get(e.department_id as string) ?? 'Sin área' : 'Sin área',
    email: (e.work_email as string) || (e.personal_email as string) || null,
    enabled: enabledBy.has(e.id as string),
    granted_at: enabledBy.get(e.id as string)?.granted_at ?? null,
  }));

  // Primero los habilitados, después el resto por nombre.
  rows.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.employee_name.localeCompare(b.employee_name);
  });

  return { rows, total: rows.length, enabled: rows.filter((r) => r.enabled).length };
}

// GET /api/admin/reintegros/acceso
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await buildView());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const BodySchema = z.object({
  action: z.enum(['grant', 'revoke']),
  employee_ids: z.array(z.string().uuid()).min(1, 'Elegí al menos una persona.').max(500),
  note: z.string().trim().max(280).optional(),
});

// POST /api/admin/reintegros/acceso — habilita o deshabilita, de a uno o en lote.
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const { action, employee_ids: ids, note } = parsed.data;
    const supabase = getSupabaseServer();

    if (action === 'grant') {
      // Sólo personas activas: habilitar a alguien dado de baja crearía una fila
      // que nadie puede usar.
      const { data: valid, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('status', 'active')
        .in('id', ids);
      if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });

      const validIds = new Set((valid ?? []).map((e) => e.id as string));
      const unknown = ids.filter((i) => !validIds.has(i));
      if (unknown.length > 0) {
        return NextResponse.json(
          { error: `${unknown.length} de las personas seleccionadas no están activas.` },
          { status: 400 },
        );
      }

      const { error } = await supabase.from('expense_reimbursement_access').upsert(
        ids.map((employee_id) => ({
          employee_id,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          note: note || null,
        })),
        { onConflict: 'employee_id' },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Revocar NO exige que la persona esté activa: si no, un acceso quedaría
      // imposible de sacar después de una baja.
      const { error } = await supabase.from('expense_reimbursement_access').delete().in('employee_id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Los reintegros ya en curso de alguien a quien se le quita el acceso NO se
    // cancelan: el gasto existió y hay que terminar de pagarlo. Sólo se le impide
    // cargar nuevos.
    return NextResponse.json({ ...(await buildView()), applied: action });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
