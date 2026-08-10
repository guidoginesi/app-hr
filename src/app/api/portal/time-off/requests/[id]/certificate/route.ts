import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { requiresLeaveCertificate } from '@/lib/leaveCertificates';

export const dynamic = 'force-dynamic';

const BUCKET = 'certificates';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Certificado médico de una licencia por enfermedad, del lado del colaborador.
 *
 * El certificado es dato de salud: sólo lo maneja la propia persona (acá) y HR
 * (endpoint de admin). El líder nunca accede — por eso no hay endpoint de líder.
 */

/** GET — URL firmada de 120s del propio certificado. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabaseServer();
    const { data: leave } = await supabase
      .from('leave_requests')
      .select('employee_id, certificate_path')
      .eq('id', id)
      .maybeSingle();

    if (!leave || leave.employee_id !== auth.employee.id) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }
    if (!leave.certificate_path) {
      return NextResponse.json({ error: 'Todavía no hay certificado cargado.' }, { status: 404 });
    }

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(leave.certificate_path as string, 120);
    if (error || !signed) {
      return NextResponse.json({ error: error?.message ?? 'No se pudo abrir el archivo.' }, { status: 500 });
    }
    return NextResponse.json({ url: signed.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — el colaborador sube (o reemplaza) el certificado de su licencia. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data: leave } = await supabase
      .from('leave_requests')
      .select('employee_id, status, certificate_path, leave_types(code)')
      .eq('id', id)
      .maybeSingle();

    if (!leave || leave.employee_id !== auth.employee.id) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }
    const lt = leave.leave_types as unknown as { code: string } | { code: string }[] | null;
    const code = Array.isArray(lt) ? lt[0]?.code : lt?.code;
    if (!requiresLeaveCertificate(code)) {
      return NextResponse.json(
        { error: 'Este tipo de licencia no se acredita con un certificado.' },
        { status: 400 },
      );
    }
    if (leave.status === 'cancelled' || leave.status === 'rejected' || leave.status === 'rejected_hr') {
      return NextResponse.json({ error: 'La licencia no está activa.' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'El archivo no puede superar 10 MB.' }, { status: 400 });
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: 'Tiene que ser PDF, JPG, PNG o WEBP.' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
    const path = `sick-leave/${id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const previousPath = leave.certificate_path as string | null;
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        certificate_path: path,
        certificate_uploaded_at: new Date().toISOString(),
        certificate_uploaded_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Al reemplazar, el anterior se borra: a diferencia de un comprobante de
    // pago, acá no hay valor en versionar el certificado viejo.
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(BUCKET).remove([previousPath]).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
