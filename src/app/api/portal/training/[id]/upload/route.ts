import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getAdminUserIds } from '@/lib/notificationService';
import crypto from 'crypto';

type RouteContext = { params: Promise<{ id: string }> };

const KINDS = {
  invoice_initial: { column: 'invoice_initial_path', requiresStatus: 'hr_approved', nextStatus: 'invoice_uploaded' },
  certificate: { column: 'certificate_path', requiresStatus: 'initial_paid', nextStatus: 'certificate_uploaded' },
  invoice_final: { column: 'invoice_final_path', requiresStatus: null, nextStatus: null },
} as const;

const MAX_SIZE = 10 * 1024 * 1024;

// POST /api/portal/training/[id]/upload  (formData: file, kind)
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const kind = formData.get('kind') as keyof typeof KINDS | null;

    if (!file) return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    if (!kind || !(kind in KINDS)) return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 });

    const cfg = KINDS[kind];
    const supabase = getSupabaseServer();

    const { data: r } = await supabase
      .from('training_requests')
      .select('id, employee_id, status, course_name')
      .eq('id', id)
      .single();
    if (!r || r.employee_id !== auth.employee.id) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }
    if (cfg.requiresStatus && r.status !== cfg.requiresStatus) {
      return NextResponse.json({ error: 'No podés cargar este archivo en el estado actual.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${auth.employee.id}/${id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from('training-files')
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const update: Record<string, unknown> = { [cfg.column]: path, updated_at: new Date().toISOString() };
    if (cfg.nextStatus) update.status = cfg.nextStatus;

    const { error: dbErr } = await supabase.from('training_requests').update(update).eq('id', id);
    if (dbErr) {
      await supabase.storage.from('training-files').remove([path]);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    if (cfg.nextStatus) {
      await supabase.from('training_request_events').insert({
        request_id: id, event_type: `upload_${kind}`, from_status: r.status, to_status: cfg.nextStatus, actor_user_id: auth.user.id,
      });
      // Avisar a HR/Adm que hay algo para procesar (pago)
      const label = kind === 'invoice_initial' ? 'factura' : 'certificado';
      getAdminUserIds().then((ids) => createSystemNotification({
        userIds: ids,
        title: `Capacitación: ${label} cargado`,
        body: `${auth.employee?.first_name ?? ''} cargó el ${label} de "${r.course_name}". Listo para procesar el pago.`,
        deepLink: '/admin/training',
        dedupeKey: `training-${kind}-${id}`,
      })).catch(() => {});
    }

    return NextResponse.json({ success: true, status: cfg.nextStatus ?? r.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
