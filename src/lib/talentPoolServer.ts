// Banco de Talentos: lo que toca la base. Sólo server.
//
// Va aparte de talentPool.ts porque ese archivo lo importan componentes de
// cliente, y el cliente de Supabase que usamos acá lleva la service role key.

import { getSupabaseServer } from '@/lib/supabaseServer';
import { RESUMES_BUCKET, type TalentPoolArea } from '@/lib/talentPool';

/**
 * Link temporal al CV. Se firma en vez de usar la URL pública para que cerrar el
 * bucket (los CVs hoy se abren con el link, sin login) no rompa el panel.
 */
export async function resumeSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

export async function getActiveAreas(): Promise<TalentPoolArea[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('talent_pool_areas')
    .select('id, name, active, sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as TalentPoolArea[];
}
