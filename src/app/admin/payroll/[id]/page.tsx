import { redirect } from 'next/navigation';
import { requirePayrollViewer } from '@/lib/checkAuth';
import { PayrollLayout } from '../PayrollLayout';
import { PayrollPeriodDetailClient } from './PayrollPeriodDetailClient';
import { PeriodAdvancesSection } from './PeriodAdvancesSection';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayrollPeriodDetailPage({ params }: PageProps) {
  const auth = await requirePayrollViewer();
  if (!auth?.user) {
    redirect('/admin/login');
  }

  // Administración mira las liquidaciones y abre los PDF; no edita, no envía,
  // no cierra. Las rutas lo vuelven a chequear: esto sólo saca los botones de
  // la pantalla.
  const soloLectura = !auth.isAdmin;

  const { id } = await params;

  return (
    <PayrollLayout advancesOnly={soloLectura}>
      <div className="space-y-6">
        <PayrollPeriodDetailClient periodId={id} soloLectura={soloLectura} />
        <PeriodAdvancesSection periodId={id} soloLectura={soloLectura} />
      </div>
    </PayrollLayout>
  );
}
