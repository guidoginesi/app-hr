import { NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { hasReimbursementAccess } from '@/lib/reimbursementAccess';

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
    if (!auth.user) return NextResponse.json({ canAdmin: false, canPortal: false, canReimburse: false });

    // El ítem de Reintegros no es para todo el equipo: se muestra sólo a quien
    // está en la lista de habilitados. La API igual revalida, porque esconder el
    // menú no es una barrera.
    const canReimburse = auth.employee ? await hasReimbursementAccess(auth.employee.id) : false;

    return NextResponse.json({
      canReimburse,
      // Mismo criterio que el middleware para /admin: admin completo o el perfil
      // Administración, que entra a un subconjunto de rutas.
      canAdmin: auth.isAdmin || auth.isAdministracion,
      // /portal exige requirePortalAccess (employee o leader). La cuenta admin
      // compartida no es empleada, así que para ella el link no tiene sentido.
      canPortal: auth.isEmployee || auth.isLeader,
    });
  } catch {
    // Ante la duda, no ofrecer el cambio de shell.
    return NextResponse.json({ canAdmin: false, canPortal: false, canReimburse: false });
  }
}
