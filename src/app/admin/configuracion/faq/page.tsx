import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { FaqClient } from './FaqClient';

export const dynamic = 'force-dynamic';

export default async function AdminFaqPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AdminShell active="configuracion">
      <div className="space-y-6">
        <PageHeader
          title="Agujeros del manual"
          description="Lo que People contesta y el manual no dice. Se captura como pregunta frecuente para que la próxima vez la respuesta ya esté."
          actions={
            <Link href="/admin/configuracion" className="text-sm text-secondary-foreground hover:underline">
              ← Volver a Configuración
            </Link>
          }
        />
        <FaqClient />
      </div>
    </AdminShell>
  );
}
