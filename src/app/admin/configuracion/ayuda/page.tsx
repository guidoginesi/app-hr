import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ConfigLayout } from '../ConfigLayout';
import { ListaDeContenidos } from './ListaDeContenidos';
import type { AyudaContenido } from '@/lib/ayudaContenidos';

export const dynamic = 'force-dynamic';

export default async function ContenidosDeAyudaPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const supabase = getSupabaseServer();
  const { data } = await supabase.from('ayuda_contenidos').select('*').order('orden').order('titulo');

  return (
    <ConfigLayout
      actions={
        <div className="flex gap-2">
          <Link href="/admin/configuracion" className={buttonVariants({ variant: 'outline' })}>
            Volver
          </Link>
          <Link href="/admin/configuracion/ayuda/nuevo" className={buttonVariants({ variant: 'primary' })}>
            Nuevo contenido
          </Link>
        </div>
      }
    >
      <ListaDeContenidos inicial={(data ?? []) as AyudaContenido[]} />
    </ConfigLayout>
  );
}
