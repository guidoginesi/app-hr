import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * El chequeo de admin de las rutas con las que RRHH aprueba y rechaza
 * licencias, sin las idas que esas rutas tiraban.
 *
 * `requireAdmin` pasa por `getAuthResult`: getUser, después roles y legajo en
 * paralelo, y después `checkIsLeader`, que acá no sirve. Además descarta el
 * legajo, y cada ruta lo volvía a pedir para guardar quién aprobó. Esto hace
 * getUser y después roles ‖ legajo, y devuelve el legajo: dos idas en serie en
 * vez de cuatro.
 *
 * La regla es la misma: es admin quien tiene el rol `admin` en user_roles. El
 * legajo es opcional (un admin puede no tenerlo) y, como en las rutas, si la
 * consulta falla queda en null.
 */
export type LegajoDelAdmin = { id: string };

export async function requireAdminConLegajo(): Promise<{
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  adminEmployee: LegajoDelAdmin | null;
}> {
  const supabaseAuth = await getSupabaseAuthServer();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false, adminEmployee: null };
  }

  const supabase = getSupabaseServer();
  const [{ data: roles }, { data: adminEmployee }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  return {
    user: { id: user.id, email: user.email },
    isAdmin: (roles ?? []).some((r) => r.role === 'admin'),
    adminEmployee: (adminEmployee as LegajoDelAdmin | null) ?? null,
  };
}
