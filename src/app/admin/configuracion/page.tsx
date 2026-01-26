import { redirect } from 'next/navigation';

// Redirect to new location in People module
export default function OldConfigPage() {
  redirect('/admin/people/organizacion');
}
