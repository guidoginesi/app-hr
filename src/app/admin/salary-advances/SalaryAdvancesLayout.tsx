import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function SalaryAdvancesLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell active="salary-advances">
      <div className="space-y-6">
        <PageHeader title="Adelantos de sueldo" description="Solicitudes de adelanto: revisión, aprobación y transferencia" />
        {children}
      </div>
    </AdminShell>
  );
}
