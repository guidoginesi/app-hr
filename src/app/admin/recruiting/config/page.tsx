import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RecruitingShell } from '../RecruitingShell';
import { EmailTemplatesClient } from './EmailTemplatesClient';

export const dynamic = 'force-dynamic';

export default async function RecruitingConfigPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RecruitingShell active="configuracion">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración de Reclutamiento</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Administra las plantillas de email para el proceso de selección
          </p>
        </div>
        
        <EmailTemplatesClient />
      </div>
    </RecruitingShell>
  );
}
