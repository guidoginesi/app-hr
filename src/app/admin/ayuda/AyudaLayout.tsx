import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function AyudaLayout({
  children,
  title = 'Ayuda',
  description = 'Manuales de uso de la plataforma',
  /** El perfil Administración ve el nav recortado, igual que en el resto del panel. */
  advancesOnly = false,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  advancesOnly?: boolean;
}) {
  return (
    <AdminShell active="ayuda" advancesOnly={advancesOnly}>
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        {children}
      </div>
    </AdminShell>
  );
}
