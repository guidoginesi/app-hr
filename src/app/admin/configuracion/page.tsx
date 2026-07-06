import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@pow/ui/components/ui/card';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ConfigLayout } from './ConfigLayout';

export const dynamic = 'force-dynamic';

export default async function AdminConfiguracionPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <ConfigLayout>
      <Card>
        <CardHeader>
          <CardTitle>Estructura organizacional</CardTitle>
          <CardDescription>
            Administra las sociedades y departamentos de la organización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/admin/people/organizacion" className={buttonVariants({ variant: 'primary' })}>
            Gestionar organización
          </Link>
        </CardContent>
      </Card>
    </ConfigLayout>
  );
}
