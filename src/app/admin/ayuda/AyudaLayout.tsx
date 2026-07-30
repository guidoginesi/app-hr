import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function AyudaLayout({
  children,
  title = 'Ayuda',
  description = 'Manuales de uso de la plataforma',
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <AdminShell active="ayuda">
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        {children}
      </div>
    </AdminShell>
  );
}
