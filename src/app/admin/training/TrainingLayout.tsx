import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell active="training">
      <div className="space-y-6">
        <PageHeader title="Fondo de Capacitaciones" description="Solicitudes: aprobación (líder → HR) y seguimiento del reintegro" />
        {children}
      </div>
    </AdminShell>
  );
}
