import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function SalaryAdvancesLayout({
  children,
  advancesOnly = false,
}: {
  children: ReactNode;
  advancesOnly?: boolean;
}) {
  return (
    <AdminShell active="salary-advances" advancesOnly={advancesOnly}>
      <div className="space-y-6">
        <PageHeader title="Adelantos de sueldo" description="Solicitudes de adelanto: revisión, aprobación y transferencia" />
        {children}
      </div>
    </AdminShell>
  );
}
