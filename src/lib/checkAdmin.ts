import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';

/**
 * Guarda de admin para las 12 rutas que históricamente resolvían el permiso
 * contra la tabla `admins`.
 *
 * Hasta acá había DOS fuentes de verdad y nadie las cruzaba: 130 rutas usan
 * `requireAdmin` de checkAuth.ts, que lee `user_roles`, y estas 12 leían sólo
 * `admins`. Consecuencia real: a quien se le daba el rol `admin` en `user_roles`
 * el middleware lo dejaba entrar al panel, pero Reclutamiento, Beneficios,
 * Plantillas de email, respuestas de Evaluaciones y Objetivos por empleado le
 * devolvían 401. Un admin a medias, sin ningún mensaje que lo explicara.
 *
 * Ahora se aceptan las dos fuentes. `user_roles` es la fuente de verdad de acá
 * en adelante —es la que gestiona /admin/configuracion— y `admins` se sigue
 * honrando para no sacarle el acceso a las cuentas que sólo están ahí.
 *
 * El mismo criterio que usa el middleware (src/middleware.ts): lee las dos y
 * agrega 'admin' si aparece en cualquiera.
 */
export async function requireAdmin() {
	const supabase = await getSupabaseAuthServer();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		return { user: null, isAdmin: false };
	}

	const [legacy, roles] = await Promise.all([
		supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(),
		supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
	]);

	// Un error de lectura no puede resolverse como "no es admin" en silencio
	// sobre una sola de las fuentes: si falla una, la otra todavía puede
	// autorizar. Sólo se niega cuando ninguna de las dos afirmó el permiso.
	if (legacy.error) console.error('[checkAdmin] error leyendo admins:', legacy.error.message);
	if (roles.error) console.error('[checkAdmin] error leyendo user_roles:', roles.error.message);

	const isAdmin = Boolean(legacy.data) || Boolean(roles.data);
	if (!isAdmin) {
		return { user: null, isAdmin: false };
	}

	return { user, isAdmin: true };
}
