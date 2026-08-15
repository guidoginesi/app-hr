import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { ManualClient } from './ManualClient';

export const dynamic = 'force-dynamic';

export default async function AdminManualPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AdminShell active="configuracion">
      <div className="space-y-6">
        <PageHeader
          title="Manual de RRHH"
          description="Qué secciones del manual se le pueden citar a un colaborador y cuáles se quedan adentro de HR."
          actions={
            <Link href="/admin/configuracion" className="text-sm text-secondary-foreground hover:underline">
              ← Volver a Configuración
            </Link>
          }
        />
        <ManualClient />
      </div>
    </AdminShell>
  );
}
