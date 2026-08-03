import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { MANAGEABLE_ROLES, type ManageableRole, canRevoke } from '@/lib/roles';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

type UserRow = {
  user_id: string;
  email: string | null;
  employee_name: string | null;
  job_title: string | null;
  department: string | null;
  is_employee: boolean;
  is_leader: boolean;
  roles: string[];
  granted_by_email: Record<string, string | null>;
};

/**
 * Arma la lista de cuentas con login: sus roles otorgados, los derivados y
 * quién otorgó cada uno. Se necesita el admin API de auth porque hay cuentas
 * (admin, administracion) que no son empleados y sólo existen en auth.users.
 */
async function buildUsersView() {
  const supabase = getSupabaseServer();
  const supabaseAdmin = getSupabaseAdmin();

  const [authRes, rolesRes, employeesRes, deptsRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('user_roles').select('user_id, role, granted_by'),
    supabase.from('employees').select('id, user_id, first_name, last_name, job_title, department_id, manager_id, status'),
    supabase.from('departments').select('id, name'),
  ]);

  // Igual criterio que en el resto del módulo: un error de lectura no se puede
  // confundir con "no hay filas", porque acá eso mostraría a todos sin roles.
  if (authRes.error) throw new Error(authRes.error.message);
  for (const r of [rolesRes, employeesRes, deptsRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const authUsers = authRes.data?.users ?? [];
  const roleRows = rolesRes.data ?? [];
  const employees = employeesRes.data ?? [];
  const depts = new Map<string, string>((deptsRes.data ?? []).map((d) => [d.id as string, d.name as string]));

  const emailByUserId = new Map<string, string | null>(authUsers.map((u) => [u.id, u.email ?? null]));
  const empByUserId = new Map<string, (typeof employees)[number]>();
  for (const e of employees) if (e.user_id) empByUserId.set(e.user_id as string, e);

  // `leader` se deriva de tener reportes directos, igual que checkIsLeader.
  const managerIds = new Set(employees.filter((e) => e.status === 'active').map((e) => e.manager_id).filter(Boolean) as string[]);

  const rolesByUser = new Map<string, { role: string; granted_by: string | null }[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.user_id as string) ?? [];
    list.push({ role: r.role as string, granted_by: (r as { granted_by?: string | null }).granted_by ?? null });
    rolesByUser.set(r.user_id as string, list);
  }

  const rows: UserRow[] = authUsers.map((u) => {
    const emp = empByUserId.get(u.id);
    const mine = rolesByUser.get(u.id) ?? [];
    const grantedBy: Record<string, string | null> = {};
    for (const r of mine) grantedBy[r.role] = r.granted_by ? emailByUserId.get(r.granted_by) ?? null : null;

    return {
      user_id: u.id,
      email: u.email ?? null,
      employee_name: emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : null,
      job_title: (emp?.job_title as string) ?? null,
      department: emp?.department_id ? depts.get(emp.department_id as string) ?? null : null,
      is_employee: Boolean(emp && emp.status === 'active'),
      is_leader: Boolean(emp && managerIds.has(emp.id as string)),
      roles: mine.map((r) => r.role),
      granted_by_email: grantedBy,
    };
  });

  // Primero quien tiene roles otorgados, después el resto por nombre.
  const weight = (r: UserRow) => (r.roles.some((x) => (MANAGEABLE_ROLES as string[]).includes(x)) ? 0 : 1);
  rows.sort((a, b) => {
    const w = weight(a) - weight(b);
    if (w !== 0) return w;
    return (a.employee_name ?? a.email ?? '').localeCompare(b.employee_name ?? b.email ?? '');
  });

  const totalAdmins = rows.filter((r) => r.roles.includes('admin')).length;
  return { rows, totalAdmins };
}

// GET /api/admin/roles
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await buildUsersView());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const bodySchema = z.object({
  action: z.enum(['grant', 'revoke']),
  user_id: z.string().uuid('Identificador de usuario inválido.'),
  role: z.enum(['admin', 'administracion', 'mass_sender']),
});

/**
 * POST /api/admin/roles — otorga o revoca uno de los roles gestionables.
 *
 * Sólo `admin`. Se rechazan los roles derivados (`employee`, `leader`) por el
 * enum de zod: otorgarlos no haría nada porque salen de los datos.
 */
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const { action, user_id: targetUserId, role } = parsed.data;
    const supabase = getSupabaseServer();

    // El usuario destino tiene que existir en auth: si no, se crearía una fila
    // de rol huérfana que nadie puede usar ni ver.
    const { data: target, error: targetError } = await getSupabaseAdmin().auth.admin.getUserById(targetUserId);
    if (targetError || !target?.user) {
      return NextResponse.json({ error: 'La cuenta no existe.' }, { status: 400 });
    }

    if (action === 'grant') {
      const inserted = await insertRole(supabase, targetUserId, role, user.id);
      if (inserted.error) return NextResponse.json({ error: inserted.error }, { status: 500 });
      return NextResponse.json({ ...(await buildUsersView()), applied: 'grant' });
    }

    // ── revoke ──
    const { count, error: countError } = await supabase
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

    const guard = canRevoke({
      role,
      targetUserId,
      actorUserId: user.id,
      totalAdmins: count ?? 0,
    });
    if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 400 });

    const { error: delError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('role', role);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    // Red de seguridad para la carrera del conteo: dos revocaciones simultáneas
    // pueden ver ambas "quedan 2 admins" y borrar las dos. PostgREST no da
    // transacción, así que se vuelve a contar y, si quedó en cero, se repone.
    if (role === 'admin') {
      const { count: after, error: afterError } = await supabase
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (!afterError && (after ?? 0) === 0) {
        await supabase
          .from('user_roles')
          .upsert({ user_id: targetUserId, role: 'admin' }, { onConflict: 'user_id,role' });
        return NextResponse.json(
          { error: 'Otro admin se quitó el rol al mismo tiempo. Se restauró para no dejar el panel sin acceso.' },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({ ...(await buildUsersView()), applied: 'revoke' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Inserta el rol registrando quién lo otorgó. `granted_by` la agrega
 * migration-roles-trazabilidad.sql; mientras no esté aplicada se reintenta sin
 * ella, para que la feature funcione igual y se empiece a registrar sola en
 * cuanto la columna exista.
 */
async function insertRole(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  role: ManageableRole,
  actorId: string,
): Promise<{ error: string | null }> {
  const withAuthor = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role, granted_by: actorId }, { onConflict: 'user_id,role' });
  if (!withAuthor.error) return { error: null };

  const missingColumn =
    withAuthor.error.code === 'PGRST204' || /granted_by/i.test(withAuthor.error.message);
  if (!missingColumn) return { error: withAuthor.error.message };

  console.warn('[Roles] granted_by no existe todavía; se otorga sin registrar el autor.');
  const fallback = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
  return { error: fallback.error?.message ?? null };
}
