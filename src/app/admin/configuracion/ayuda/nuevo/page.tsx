import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ConfigLayout } from '../../ConfigLayout';
import { EditorDeContenido } from '../EditorDeContenido';

export const dynamic = 'force-dynamic';

export default async function NuevoContenidoPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const supabase = getSupabaseServer();
  const { data } = await supabase.from('ayuda_contenidos').select('seccion').order('orden');
  const secciones = [...new Set((data ?? []).map((r) => r.seccion as string))];

  return (
    <ConfigLayout>
      <EditorDeContenido inicial={null} secciones={secciones} />
    </ConfigLayout>
  );
}
