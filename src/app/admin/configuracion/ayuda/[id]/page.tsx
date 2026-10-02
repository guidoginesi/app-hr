import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ConfigLayout } from '../../ConfigLayout';
import { EditorDeContenido } from '../EditorDeContenido';
import type { AyudaContenido } from '@/lib/ayudaContenidos';

export const dynamic = 'force-dynamic';

export default async function EditarContenidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const { id } = await params;
  const supabase = getSupabaseServer();
  const [{ data: contenido }, { data: filas }] = await Promise.all([
    supabase.from('ayuda_contenidos').select('*').eq('id', id).maybeSingle(),
    supabase.from('ayuda_contenidos').select('seccion').order('orden'),
  ]);
  if (!contenido) notFound();
  const secciones = [...new Set((filas ?? []).map((r) => r.seccion as string))];

  return (
    <ConfigLayout>
      <EditorDeContenido inicial={contenido as AyudaContenido} secciones={secciones} />
    </ConfigLayout>
  );
}
