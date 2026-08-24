/**
 * A qué parte del admin entra el perfil Administración.
 *
 * Existe como lista única porque antes había dos, y se desincronizaron: la nav
 * le ofrecía Ayuda y el middleware la rebotaba, así que el ítem estaba pero no
 * llevaba a ningún lado. Cuando abrimos Liquidaciones pasó lo mismo — permiso en
 * las rutas, permiso en la pantalla, y el middleware sin enterarse.
 *
 * Ahora el middleware decide con esta lista y la nav se filtra con esta lista.
 * Sumar un módulo es tocar un solo lugar; olvidarse deja el ítem afuera del menú
 * en vez de dejarlo puesto y roto.
 *
 * Es un permiso de ENTRADA, no de acción: qué puede hacer adentro lo define cada
 * ruta con su propio guard (ver requirePayrollViewer y compañía en checkAuth).
 *
 * Vive en un módulo sin dependencias porque lo importa el middleware, que corre
 * en el runtime Edge.
 */
export const RUTAS_DE_ADMINISTRACION = [
  '/admin/salary-advances',
  '/admin/recibos',
  '/admin/reintegros',
  // Lectura de liquidaciones: montos, recibos y facturas. No envía ni cierra.
  '/admin/payroll',
  // El índice de Ayuda le muestra sólo los manuales de sus módulos.
  '/admin/ayuda',
];

/** Dónde cae si intenta entrar a otra cosa. */
export const INICIO_DE_ADMINISTRACION = '/admin/salary-advances';

export function administracionPuedeEntrar(pathname: string): boolean {
  return RUTAS_DE_ADMINISTRACION.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
