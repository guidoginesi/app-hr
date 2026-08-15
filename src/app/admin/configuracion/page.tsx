import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@pow/ui/components/ui/card';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ConfigLayout } from './ConfigLayout';
import { RolesSection } from './RolesSection';

export const dynamic = 'force-dynamic';

export default async function AdminConfiguracionPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <ConfigLayout>
      <RolesSection />

      <Card>
        <CardHeader>
          <CardTitle>Manual de RRHH</CardTitle>
          <CardDescription>
            Define qué secciones del manual se le pueden citar a un colaborador. Lo que no está
            revisado no se cita: es lo que evita que una respuesta automática termine mostrando
            algo que no debería salir de HR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/admin/configuracion/manual" className={buttonVariants({ variant: 'primary' })}>
            Revisar el manual
          </Link>
        </CardContent>
      </Card>

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
