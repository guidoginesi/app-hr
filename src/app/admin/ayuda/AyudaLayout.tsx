import { ReactNode } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ManualToc } from '@/components/manual/ManualToc';

export function AyudaLayout({
  children,
  title = 'Ayuda',
  description = 'Manuales de uso de la plataforma',
  /** El perfil Administración ve el nav recortado, igual que en el resto del panel. */
  advancesOnly = false,
  /** El índice no muestra el botón de volver ni el índice lateral: ya es la raíz. */
  showBack = true,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  advancesOnly?: boolean;
  showBack?: boolean;
}) {
  return (
    <AdminShell active="ayuda" advancesOnly={advancesOnly}>
      <div className="space-y-6">
        <PageHeader
          title={title}
          description={description}
          actions={
            showBack ? (
              <Link href="/admin/ayuda" className={buttonVariants({ variant: 'outline' })}>
                Volver
              </Link>
            ) : undefined
          }
        />
        {showBack ? (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0">{children}</div>
            <ManualToc />
          </div>
        ) : (
          children
        )}
      </div>
    </AdminShell>
  );
}
