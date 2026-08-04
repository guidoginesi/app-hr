import { redirect } from 'next/navigation';
import { getAuthResult } from '@/lib/checkAuth';
import { AdminShell } from '../AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { ReintegrosAdminClient } from './ReintegrosAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminReintegrosPage() {
  const auth = await getAuthResult();
  // Administración valida el comprobante fiscal y la imputación, así que entra
  // igual que People. La nav se recorta para el perfil Administración.
  if (!auth.isAdmin && !auth.isAdministracion) redirect('/admin/login');

  const advancesOnly = !auth.isAdmin && auth.isAdministracion;

  return (
    <AdminShell advancesOnly={advancesOnly}>
      <div className="space-y-6">
        <PageHeader
          title="Reintegros"
          description="Gastos que el equipo pidió reintegrar: validación, pago y quiénes tienen el módulo habilitado"
        />
        <ReintegrosAdminClient canManageAccess={auth.isAdmin} />
      </div>
    </AdminShell>
  );
}
