import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  /** Admin por la tabla legada `admins`, tenga o no fila en `user_roles`. */
  legacy_admin: boolean;
  granted_by_email: Record<string, string | null>;
};

/**
 * listUsers devuelve UNA página. Sin paginar, con más de 1000 cuentas habría
 * admins invisibles e imposibles de revocar desde la pantalla — y en una
 * pantalla de permisos una lista parcial es peor que un error.
 */
async function listAllAuthUsers(supabaseAdmin: SupabaseClient) {
  const users: { id: string; email?: string | null }[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return { users: [], error };
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) return { users, error: null };
  }
  return { users, error: null };
}

/** `granted_by` la agrega migration-roles-trazabilidad.sql; sin ella se lee igual. */
async function selectUserRoles(supabase: SupabaseClient) {
  const withAuthor = await supabase.from('user_roles').select('user_id, role, granted_by');
  if (!withAuthor.error) return withAuthor;

  const missing = withAuthor.error.code === '42703' || /granted_by/i.test(withAuthor.error.message);
  if (!missing) return withAuthor;
  return supabase.from('user_roles').select('user_id, role');
}

async function buildUsersView() {
  const supabase = getSupabaseServer();
  const supabaseAdmin = getSupabaseAdmin();

  const [authRes, rolesRes, employeesRes, deptsRes, legacyRes] = await Promise.all([
    listAllAuthUsers(supabaseAdmin),
    selectUserRoles(supabase),
    supabase.from('employees').select('id, user_id, first_name, last_name, job_title, department_id, manager_id, status'),
    supabase.from('departments').select('id, name'),
    // Segunda fuente de admin: sin leerla, la pantalla mostraría el checkbox
    // vacío para alguien que sí es admin y diría que revocó cuando no revocó.
    supabase.from('admins').select('user_id'),
  ]);

  if (authRes.error) throw new Error(authRes.error.message);
  for (const r of [rolesRes, employeesRes, deptsRes, legacyRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const authUsers = authRes.users;
  const roleRows = (rolesRes.data ?? []) as { user_id: string; role: string; granted_by?: string | null }[];
  const employees = employeesRes.data ?? [];
  const depts = new Map<string, string>((deptsRes.data ?? []).map((d) => [d.id as string, d.name as string]));
  const legacyAdmins = new Set((legacyRes.data ?? []).map((a) => a.user_id as string));

  const emailByUserId = new Map<string, string | null>(authUsers.map((u) => [u.id, u.email ?? null]));
  const empByUserId = new Map<string, (typeof employees)[number]>();
  for (const e of employees) if (e.user_id) empByUserId.set(e.user_id as string, e);

  // Mismo criterio que checkIsLeader en checkAuth.ts: NO filtra por status del
  // reporte. Filtrarlo escondería el badge de alguien que sí pasa el gate.
  const managerIds = new Set(employees.map((e) => e.manager_id).filter(Boolean) as string[]);

  const rolesByUser = new Map<string, { role: string; granted_by: string | null }[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push({ role: r.role, granted_by: r.granted_by ?? null });
    rolesByUser.set(r.user_id, list);
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
      // Igual que checkAuth: `roles.includes('employee') || !!employee`, sin
      // filtrar status. Filtrarlo diría "sin acceso" de alguien que sí entra.
      is_employee: mine.some((r) => r.role === 'employee') || Boolean(emp),
      is_leader: Boolean(emp && managerIds.has(emp.id as string)),
      roles: mine.map((r) => r.role),
      legacy_admin: legacyAdmins.has(u.id),
      granted_by_email: grantedBy,
    };
  });

  const weight = (r: UserRow) =>
    r.legacy_admin || r.roles.some((x) => (MANAGEABLE_ROLES as string[]).includes(x)) ? 0 : 1;
  rows.sort((a, b) => {
    const w = weight(a) - weight(b);
    if (w !== 0) return w;
    return (a.employee_name ?? a.email ?? '').localeCompare(b.employee_name ?? b.email ?? '');
  });

  return { rows, totalAdmins: rows.filter((r) => r.roles.includes('admin') || r.legacy_admin).length };
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
  // Normalizado: la baranda de auto-revocación compara strings y el mismo UUID
  // en mayúsculas pasaba el uuid() de zod, esquivando la comparación.
  user_id: dbId('Identificador de usuario inválido.').transform((v) => v.toLowerCase()),
  role: z.enum(['admin', 'administracion', 'mass_sender']),
});

/**
 * Devuelve la vista recalculada, pero NUNCA convierte un fallo del recálculo en
 * un error de la mutación: la escritura ya se aplicó, así que responder 500
 * haría que la pantalla diga "no se guardó" sobre algo que sí se guardó.
 */
async function respondAfterWrite(extra: Record<string, unknown>) {
  try {
    return NextResponse.json({ ...(await buildUsersView()), ...extra });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[Roles] la escritura se aplicó pero falló el recálculo:', message);
    return NextResponse.json({
      ...extra,
      stale: true,
      warning: 'El cambio se guardó, pero no se pudo refrescar la lista. Recargá la página.',
    });
  }
}

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

    const { data: target, error: targetError } = await getSupabaseAdmin().auth.admin.getUserById(targetUserId);
    if (targetError || !target?.user) {
      return NextResponse.json({ error: 'La cuenta no existe.' }, { status: 400 });
    }

    if (action === 'grant') {
      const inserted = await insertRole(supabase, targetUserId, role, user.id);
      if (inserted.error) return NextResponse.json({ error: inserted.error }, { status: 500 });
      return respondAfterWrite({ applied: 'grant' });
    }

    // ── revoke ──
    // El conteo es la UNIÓN de las dos fuentes: contando sólo user_roles, la
    // baranda del último admin contaría mal.
    const before = await countAdmins(supabase);
    if (before.error) return NextResponse.json({ error: before.error }, { status: 500 });

    const guard = canRevoke({
      role,
      targetUserId,
      actorUserId: user.id.toLowerCase(),
      totalAdmins: before.total,
    });
    if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 400 });

    const { error: delError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('role', role);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    if (role === 'admin') {
      // Quitar admin sólo de user_roles no revoca nada: el middleware, las 12
      // rutas de checkAdmin.ts y las policies RLS de payroll leen `admins`.
      const { error: legacyError } = await supabase.from('admins').delete().eq('user_id', targetUserId);
      if (legacyError) {
        return NextResponse.json(
          {
            error:
              'Se quitó el rol pero no se pudo borrar de la tabla admins, así que la persona sigue teniendo acceso: ' +
              legacyError.message,
          },
          { status: 500 },
        );
      }

      // Compensación de la carrera del conteo: PostgREST no da transacción, así
      // que se recuenta y, si quedó en cero, se repone el rol.
      const after = await countAdmins(supabase);
      if (after.error || after.total === 0) {
        const restore = await supabase
          .from('user_roles')
          .upsert({ user_id: targetUserId, role: 'admin' }, { onConflict: 'user_id,role' });
        return NextResponse.json(
          {
            error: restore.error
              ? `El panel quedó sin admins y la restauración falló: ${restore.error.message}. Hay que reponer el rol por base de datos.`
              : 'Otro admin se quitó el rol al mismo tiempo. Se restauró el rol para no dejar el panel sin acceso.',
          },
          { status: 409 },
        );
      }
    }

    return respondAfterWrite({ applied: 'revoke' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cuenta admins uniendo `user_roles` y la tabla legada `admins`. */
async function countAdmins(supabase: SupabaseClient): Promise<{ total: number; error: string | null }> {
  const [roles, legacy] = await Promise.all([
    supabase.from('user_roles').select('user_id').eq('role', 'admin'),
    supabase.from('admins').select('user_id'),
  ]);
  if (roles.error) return { total: 0, error: roles.error.message };
  if (legacy.error) return { total: 0, error: legacy.error.message };

  const ids = new Set<string>();
  for (const r of roles.data ?? []) ids.add(r.user_id as string);
  for (const a of legacy.data ?? []) ids.add(a.user_id as string);
  return { total: ids.size, error: null };
}

async function insertRole(
  supabase: SupabaseClient,
  userId: string,
  role: ManageableRole,
  actorId: string,
): Promise<{ error: string | null }> {
  const withAuthor = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role, granted_by: actorId }, { onConflict: 'user_id,role' });
  if (!withAuthor.error) return { error: null };

  const missingColumn =
    withAuthor.error.code === 'PGRST204' ||
    withAuthor.error.code === '42703' ||
    /granted_by/i.test(withAuthor.error.message);
  if (!missingColumn) return { error: withAuthor.error.message };

  console.warn('[Roles] granted_by no existe todavía; se otorga sin registrar el autor.');
  const fallback = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
  return { error: fallback.error?.message ?? null };
}
