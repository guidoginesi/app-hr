import { redirect } from 'next/navigation';
import { requirePayrollViewer } from '@/lib/checkAuth';
import { PayrollLayout } from './PayrollLayout';
import { PayrollPeriodsClient } from './PayrollPeriodsClient';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodsPage() {
  const auth = await requirePayrollViewer();
  if (!auth?.user) {
    redirect('/admin/login');
  }

  // Administración mira; no crea períodos ni dispara nada.
  const soloLectura = !auth.isAdmin;

  return (
    <PayrollLayout advancesOnly={soloLectura}>
      <PayrollPeriodsClient soloLectura={soloLectura} />
    </PayrollLayout>
  );
}
