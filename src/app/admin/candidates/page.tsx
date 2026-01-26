import { redirect } from 'next/navigation';

// Redirect to new location
export default function OldCandidatesPage() {
  redirect('/admin/recruiting/candidates');
}
