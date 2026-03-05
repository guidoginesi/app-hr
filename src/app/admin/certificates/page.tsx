import { redirect } from 'next/navigation';

export default function AdminCertificatesRedirect() {
  redirect('/admin/time-off/certificates');
}
