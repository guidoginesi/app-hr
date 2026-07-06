import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function ConfigLayout({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="configuracion">
      <div className="space-y-6">
        <PageHeader
          title="Configuración"
          description="Ajustes del sistema"
          actions={actions}
        />
        {children}
      </div>
    </AdminShell>
  );
}
