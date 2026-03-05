import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { TimeOffShell } from '../TimeOffShell';
import { CertificatesAdminClient } from '@/app/admin/certificates/CertificatesAdminClient';

export const dynamic = 'force-dynamic';

export default async function TimeOffCertificatesPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin');

  const supabase = getSupabaseServer();

  const { data: certificates } = await supabase
    .from('employee_certificates')
    .select(`
      *,
      employee:employees!employee_id(
        id, first_name, last_name, job_title,
        department:departments(id, name)
      )
    `)
    .order('uploaded_at', { ascending: false });

  return (
    <TimeOffShell active="certificates">
      <CertificatesAdminClient initialCertificates={certificates || []} />
    </TimeOffShell>
  );
}
