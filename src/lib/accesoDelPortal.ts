/**
 * Quién puede entrar al portal.
 *
 * Al dar de baja a alguien no se le toca ni el usuario de Supabase ni el rol
 * `employee`: los dos siguen ahí. Así que el rol no alcanza para saber si la
 * persona todavía tiene que poder entrar — hay que mirar el estado del legajo.
 *
 * Eso no se estaba mirando en ningún lado, y el login del portal es con mail y
 * contraseña propios, no con Google: suspender la cuenta de Workspace no cierra
 * la app. Con su contraseña, alguien que ya se fue entraba al portal completo.
 *
 * La única excepción es la encuesta de salida, que justamente es para alguien
 * que ya se fue. Por eso vive acá y no adentro del middleware: la misma regla
 * la aplican el middleware (para redirigir) y `checkAuth` (para cortar de
 * verdad, incluidas las rutas de /api/portal, que el middleware no toca).
 */

/** La única pantalla del portal que un desvinculado puede abrir. */
export const ENCUESTA_DE_SALIDA = '/portal/offboarding';

/** El legajo dice que la persona ya no trabaja acá. */
export function estaDesvinculado(status: string | null | undefined): boolean {
  return status === 'terminated';
}

/** ¿Esta ruta es la encuesta de salida (o algo colgando de ella)? */
export function esLaEncuestaDeSalida(pathname: string): boolean {
  return pathname === ENCUESTA_DE_SALIDA || pathname.startsWith(`${ENCUESTA_DE_SALIDA}/`);
}
