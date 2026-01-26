import { redirect } from 'next/navigation';

// Redirect to new location
export default function OldJobsPage() {
  redirect('/admin/recruiting/jobs');
}
