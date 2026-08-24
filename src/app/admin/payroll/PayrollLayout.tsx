import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function PayrollLayout({
  actions,
  children,
  /** Perfil Administración: la nav va recortada, igual que en Adelantos. */
  advancesOnly = false,
}: {
  actions?: ReactNode;
  children: ReactNode;
  advancesOnly?: boolean;
}) {
  return (
    <AdminShell active="payroll" advancesOnly={advancesOnly}>
      <div className="space-y-6">
        <PageHeader
          title="Liquidaciones"
          description="Liquidaciones, recibos de sueldo y monotributo"
          actions={actions}
        />
        {children}
      </div>
    </AdminShell>
  );
}
