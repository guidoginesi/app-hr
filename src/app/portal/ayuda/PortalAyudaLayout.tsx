import { ReactNode } from 'react';
import Link from 'next/link';
import { PortalShell } from '../PortalShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ManualToc } from '@/components/manual/ManualToc';
import type { Employee } from '@/types/employee';

/**
 * Layout de los manuales del portal. Espeja el AyudaLayout del admin: un
 * índice con tarjetas y una página por módulo, en vez de una sola página larga.
 *
 * Antes todo vivía en /portal/ayuda y había que scrollear entre 45 pasos para
 * encontrar el módulo que buscabas. Lo reportó Tini haciendo QA: desde el admin
 * está bien y desde el portal no.
 */
export function PortalAyudaLayout({
  children,
  employee,
  isLeader,
  title = 'Ayuda',
  description = 'Cómo usar las funcionalidades del portal.',
  /** El índice no muestra el botón de volver: ya es la raíz. */
  showBack = true,
}: {
  children: ReactNode;
  employee: Employee;
  isLeader: boolean;
  title?: string;
  description?: string;
  showBack?: boolean;
}) {
  return (
    <PortalShell employee={employee} isLeader={isLeader} active="ayuda">
      <div className="space-y-6">
        <PageHeader
          title={title}
          description={description}
          actions={
            showBack ? (
              <Link href="/portal/ayuda" className={buttonVariants({ variant: 'outline' })}>
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
    </PortalShell>
  );
}
