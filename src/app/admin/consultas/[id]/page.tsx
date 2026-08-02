import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AdminShell } from '@/app/admin/AdminShell';
import { ConsultaAdminDetailClient } from './ConsultaAdminDetailClient';

export const dynamic = 'force-dynamic';

export default async function AdminConsultaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');
  const { id } = await params;

  return (
    <AdminShell>
      <ConsultaAdminDetailClient inquiryId={id} />
    </AdminShell>
  );
}
