import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveActor, logEvent, actorDisplayName } from '@/lib/reimbursementAccess';
import { ALLOWED_MIMES, MAX_FILE_BYTES } from '@/lib/reimbursements';

export const dynamic = 'force-dynamic';

const BUCKET = 'reimbursement-files';

/**
 * GET /api/reintegros/[id]/file?kind=comprobante|comprobante_pago[&fileId=...]
 *
 * Devuelve una URL firmada de 120 segundos. El bucket es privado: el acceso lo
 * decide resolveActor y no la URL, así que un link filtrado caduca solo.
 *
 * Un reintegro puede tener varios comprobantes. Sin `fileId` se devuelve el
 * primero —el que espejan las columnas receipt_*—, que es lo que esperan los
 * lugares donde el link es uno solo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const kind = new URL(req.url).searchParams.get('kind') ?? 'comprobante';
    if (kind !== 'comprobante' && kind !== 'comprobante_pago') {
      return NextResponse.json({ error: 'Tipo de archivo inválido.' }, { status: 400 });
    }

    const actor = await resolveActor({
      reimbursementId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      isAdministracion: auth.isAdministracion,
      viewerEmployeeId: auth.employee?.id ?? null,
    });
    if (actor.role === 'none') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const supabase = getSupabaseServer();
    const { data: r } = await supabase
      .from('expense_reimbursements')
      .select('receipt_path, payment_receipt_path')
      .eq('id', id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: 'Reintegro no encontrado' }, { status: 404 });

    let path = kind === 'comprobante' ? r.receipt_path : r.payment_receipt_path;

    // Un adjunto puntual: se verifica que pertenezca a ESTE reintegro antes de
    // firmarlo. Si no, un id de otro reintegro alcanzaría para leer su archivo.
    const fileId = new URL(req.url).searchParams.get('fileId');
    if (kind === 'comprobante' && fileId) {
      const { data: archivo } = await supabase
        .from('expense_reimbursement_files')
        .select('storage_path')
        .eq('id', fileId)
        .eq('reimbursement_id', id)
        .maybeSingle();
      if (!archivo) {
        return NextResponse.json({ error: 'Ese archivo no existe en este reintegro.' }, { status: 404 });
      }
      path = archivo.storage_path as string;
    }

    if (!path || path === 'pendiente') {
      return NextResponse.json({ error: 'Ese archivo todavía no está cargado.' }, { status: 404 });
    }

    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path as string, 120);
    if (error || !signed) {
      return NextResponse.json({ error: error?.message ?? 'No se pudo abrir el archivo.' }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/reintegros/[id]/file — sube el comprobante de PAGO.
 *
 * Sólo Administración o People, y sólo cuando el reintegro está para pagar: es la
 * evidencia de que la plata salió, y subirla antes de agendar el pago no
 * significaría nada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!auth.isAdmin && !auth.isAdministracion) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();
    const { data: r } = await supabase
      .from('expense_reimbursements')
      .select('status, payment_receipt_path')
      .eq('id', id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: 'Reintegro no encontrado' }, { status: 404 });
    if (r.status !== 'to_pay') {
      return NextResponse.json(
        { error: 'El comprobante de pago se carga cuando el reintegro está a pagar.' },
        { status: 400 },
      );
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
    const path = `${id}/comprobante_pago-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { error: updateError } = await supabase
      .from('expense_reimbursements')
      .update({ payment_receipt_path: path, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Si se reemplaza, el archivo viejo se conserva a propósito: es documentación
    // de pago y borrarlo perdería trazabilidad.
    await logEvent({
      reimbursementId: id,
      eventType: 'payment_receipt_uploaded',
      actorUserId: auth.user.id,
      actorName: await actorDisplayName(auth.user.id, auth.user.email),
      note: file.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
