import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function PayrollLayout({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="payroll">
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
