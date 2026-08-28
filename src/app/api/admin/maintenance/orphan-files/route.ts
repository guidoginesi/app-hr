import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Archivos en Storage que ya no tiene quién los referencie.
 *
 * Storage no tiene FK ni cascada: cuando se borra la fila que apuntaba a un
 * archivo, el archivo queda. Los borrados de la app ya limpian lo suyo, pero
 * los que se hacen por SQL o desde el dashboard —lo normal al depurar datos de
 * prueba— no pueden: Supabase bloquea el DELETE directo sobre storage.objects y
 * exige la Storage API. Este endpoint es esa vía.
 *
 * Por defecto NO borra: hay que pedir dryRun=false explícitamente.
 */

type BucketSpec = {
  bucket: string;
  /** Devuelve el set de rutas que SÍ están referenciadas. */
  referenced: () => Promise<Set<string>>;
  /** Profundidad de carpetas a recorrer (1 = bucket/carpeta/archivo). */
  depth: number;
};

/** Lista recursiva de archivos. Storage no tiene "listar todo": hay que bajar carpeta por carpeta. */
async function listFiles(
  supabase: ReturnType<typeof getSupabaseServer>,
  bucket: string,
  prefix: string,
  depth: number,
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const out: string[] = [];
  for (const item of data) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // Sin metadata = carpeta. Es cómo Storage distingue prefijos de objetos.
    const esCarpeta = !item.metadata;
    if (esCarpeta) {
      if (depth > 0) out.push(...(await listFiles(supabase, bucket, full, depth - 1)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function nonNull(values: (string | null | undefined)[]): string[] {
  return values.filter((v): v is string => Boolean(v));
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Falla cerrado: sin decirlo explícitamente, sólo informa.
    const dryRun = body?.dryRun !== false;

    const supabase = getSupabaseServer();

    const specs: BucketSpec[] = [
      {
        bucket: 'inquiry-files',
        depth: 1,
        referenced: async () => {
          const { data, error } = await supabase.from('inquiry_attachments').select('file_path');
          if (error) throw new Error(`inquiry_attachments: ${error.message}`);
          return new Set(nonNull((data ?? []).map((r) => r.file_path as string)));
        },
      },
      {
        // Este bucket mezcla dos orígenes: los certificados del legajo
        // (employee_certificates) y los de licencia bajo sick-leave/. Se juntan
        // las dos fuentes a propósito: mirar sólo una borraría los de la otra.
        bucket: 'certificates',
        depth: 2,
        referenced: async () => {
          const [certs, leaves] = await Promise.all([
            supabase.from('employee_certificates').select('file_path'),
            supabase.from('leave_requests').select('certificate_path').not('certificate_path', 'is', null),
          ]);
          if (certs.error) throw new Error(`employee_certificates: ${certs.error.message}`);
          if (leaves.error) throw new Error(`leave_requests: ${leaves.error.message}`);
          return new Set([
            ...nonNull((certs.data ?? []).map((r) => r.file_path as string)),
            ...nonNull((leaves.data ?? []).map((r) => r.certificate_path as string)),
          ]);
        },
      },
      {
        bucket: 'reimbursement-files',
        depth: 1,
        referenced: async () => {
          const { data, error } = await supabase
            .from('expense_reimbursements')
            .select('receipt_path, payment_receipt_path');
          if (error) throw new Error(`expense_reimbursements: ${error.message}`);
          // Los comprobantes extra viven en su propia tabla: sin mirarla, esta
          // limpieza los tomaría por huérfanos y borraría adjuntos válidos.
          const { data: extra, error: extraError } = await supabase
            .from('expense_reimbursement_files')
            .select('storage_path');
          if (extraError) throw new Error(`expense_reimbursement_files: ${extraError.message}`);
          return new Set([
            ...nonNull((extra ?? []).map((f) => f.storage_path as string)),
            ...nonNull((data ?? []).map((r) => r.receipt_path as string)),
            // 'pendiente' es el placeholder que se escribe antes de subir el archivo.
            ...nonNull((data ?? []).map((r) => r.payment_receipt_path as string)),
          ]);
        },
      },
    ];

    const resultado: Record<string, { archivos: number; huerfanos: string[]; borrados: number; error?: string }> = {};

    for (const spec of specs) {
      try {
        const [archivos, referenciados] = await Promise.all([
          listFiles(supabase, spec.bucket, '', spec.depth),
          spec.referenced(),
        ]);
        const huerfanos = archivos.filter((f) => !referenciados.has(f) && f !== '.emptyFolderPlaceholder');

        let borrados = 0;
        if (!dryRun && huerfanos.length > 0) {
          const { error } = await supabase.storage.from(spec.bucket).remove(huerfanos);
          if (error) throw new Error(`remove: ${error.message}`);
          borrados = huerfanos.length;
        }

        resultado[spec.bucket] = { archivos: archivos.length, huerfanos, borrados };
      } catch (e) {
        resultado[spec.bucket] = {
          archivos: 0,
          huerfanos: [],
          borrados: 0,
          error: e instanceof Error ? e.message : 'error inesperado',
        };
      }
    }

    const totalHuerfanos = Object.values(resultado).reduce((a, r) => a + r.huerfanos.length, 0);
    return NextResponse.json({ dryRun, totalHuerfanos, buckets: resultado });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
