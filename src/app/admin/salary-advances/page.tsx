import { redirect } from 'next/navigation';
import { requireAdvanceApprover } from '@/lib/checkAuth';
import { SalaryAdvancesLayout } from './SalaryAdvancesLayout';
import { SalaryAdvancesClient } from './SalaryAdvancesClient';

export const dynamic = 'force-dynamic';

export default async function AdminSalaryAdvancesPage() {
  const auth = await requireAdvanceApprover();
  if (!auth) redirect('/admin');

  // Perfil Administración (sin admin completo): nav recortada y sin acciones de RRHH.
  const advancesOnly = !auth.isAdmin && auth.isAdministracion;

  return (
    <SalaryAdvancesLayout advancesOnly={advancesOnly}>
      <SalaryAdvancesClient isAdmin={auth.isAdmin} />
    </SalaryAdvancesLayout>
  );
}
