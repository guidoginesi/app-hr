import { NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me/access — qué shells puede usar quien está logueado.
 *
 * Lo consume ShellSwitch para decidir si muestra el link entre el panel y el
 * portal. Se calcula en el server porque los shells son componentes de cliente y
 * no pueden resolver roles, y porque mostrar un link que después rebota contra el
 * middleware es peor que no mostrarlo.
 */
export async function GET() {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ canAdmin: false, canPortal: false });

    return NextResponse.json({
      // Mismo criterio que el middleware para /admin: admin completo o el perfil
      // Administración, que entra a un subconjunto de rutas.
      canAdmin: auth.isAdmin || auth.isAdministracion,
      // /portal exige requirePortalAccess (employee o leader). La cuenta admin
      // compartida no es empleada, así que para ella el link no tiene sentido.
      canPortal: auth.isEmployee || auth.isLeader,
    });
  } catch {
    // Ante la duda, no ofrecer el cambio de shell.
    return NextResponse.json({ canAdmin: false, canPortal: false });
  }
}
