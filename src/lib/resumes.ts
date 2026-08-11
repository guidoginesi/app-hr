// CVs: de lo que hay guardado en `applications.resume_url` a un link que se
// pueda abrir.
//
// El bucket `resumes` era público: cualquiera con el link abría el CV de
// cualquiera de las 1700 personas que se postularon, sin login. Al cerrarlo,
// esas URLs absolutas dejan de resolver.
//
// En vez de migrar la columna —1710 filas, y cualquier error deja postulaciones
// sin CV— se normaliza al leer: la columna puede tener una URL pública vieja o
// un path nuevo, y de las dos sale el path. Los escritores ya guardan el path;
// las filas viejas se siguen entendiendo sin tocarlas.

import { getSupabaseServer } from '@/lib/supabaseServer';

export const RESUMES_BUCKET = 'resumes';

/** Las altas manuales sin CV guardan este texto en vez de un archivo. */
const SIN_ARCHIVO = 'manual-entry';

/**
 * El path dentro del bucket, venga guardado como URL pública o como path.
 * Devuelve null cuando no hay archivo.
 */
export function resumeObjectPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const valor = stored.trim();
  if (!valor || valor === SIN_ARCHIVO) return null;

  // URL pública vieja: .../storage/v1/object/public/resumes/<path>
  const marca = `/object/public/${RESUMES_BUCKET}/`;
  const i = valor.indexOf(marca);
  if (i !== -1) return decodeURIComponent(valor.slice(i + marca.length));

  // Si quedó alguna firmada, el path está igual pero con query encima.
  const marcaFirmada = `/object/sign/${RESUMES_BUCKET}/`;
  const j = valor.indexOf(marcaFirmada);
  if (j !== -1) return decodeURIComponent(valor.slice(j + marcaFirmada.length).split('?')[0]);

  // Ya es un path.
  if (!valor.startsWith('http')) return valor;

  // Una URL de otro lado: no sabemos abrirla.
  return null;
}

/** Link temporal al CV. Una hora alcanza para abrirlo o bajarlo. */
export async function signedResumeUrl(
  stored: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = resumeObjectPath(stored);
  if (!path) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error(`signedResumeUrl(${path}): ${error.message}`);
    return null;
  }
  return data?.signedUrl ?? null;
}
