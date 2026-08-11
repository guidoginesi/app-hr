import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, StageStatus } from '@/types/funnel';
import {
  MANUAL_TALENT_POOL_STATUSES,
  RESUMES_BUCKET,
  TALENT_POOL_SOURCE,
} from '@/lib/talentPool';

export const dynamic = 'force-dynamic';

/** Acciones de HR sobre el Banco de Talentos: mover de estado y asignar a una búsqueda. */

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status'),
    id: dbId(),
    // "Asignado" no está: se consigue asignando, no eligiéndolo de una lista.
    status: z.enum(MANUAL_TALENT_POOL_STATUSES as [string, ...string[]]),
  }),
  z.object({ action: z.literal('assign'), id: dbId(), jobId: dbId() }),
]);

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const supabase = getSupabaseServer();

    if (body.action === 'status') {
      const { error } = await supabase
        .from('talent_pool_entries')
        .update({
          status: body.status,
          status_changed_at: new Date().toISOString(),
          status_changed_by: user.id,
          // Volver a mover de estado es haber mirado el reenvío: se apaga el aviso.
          resubmitted_at: null,
        })
        .eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Asignar a una búsqueda ─────────────────────────────────────────
    const { data: entry } = await supabase
      .from('talent_pool_entries')
      .select('id, candidate_id, resume_path, status')
      .eq('id', body.id)
      .maybeSingle();
    if (!entry) return NextResponse.json({ error: 'No encontramos ese registro.' }, { status: 404 });

    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, is_published')
      .eq('id', body.jobId)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: 'No encontramos esa búsqueda.' }, { status: 404 });
    if (!job.is_published) {
      return NextResponse.json(
        { error: 'Esa búsqueda no está publicada. Solo se puede asignar a búsquedas abiertas.' },
        { status: 400 },
      );
    }

    const { data: yaPostulado } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', entry.candidate_id)
      .eq('job_id', body.jobId)
      .maybeSingle();
    if (yaPostulado) {
      return NextResponse.json(
        { error: 'Esta persona ya está en esa búsqueda.' },
        { status: 400 },
      );
    }

    // `applications.resume_url` guarda una URL absoluta en las 1700 postulaciones
    // que ya existen. Se mantiene el mismo formato para no dejar una fila que el
    // resto del módulo no sepa abrir; cerrar el bucket migra la columna entera.
    const { data: publicUrl } = supabase.storage
      .from(RESUMES_BUCKET)
      .getPublicUrl(entry.resume_path as string);

    const { data: application, error: appErr } = await supabase
      .from('applications')
      .insert({
        candidate_id: entry.candidate_id,
        job_id: body.jobId,
        resume_url: publicUrl.publicUrl,
        current_stage: Stage.HR_REVIEW,
        current_stage_status: StageStatus.PENDING,
        status: 'Recibido',
        source: TALENT_POOL_SOURCE,
      })
      .select('id')
      .single();
    if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });

    // Mismo arranque que una postulación del portal: CV recibido → revisión HR.
    // Sin esto el candidato aparecería en el pipeline sin historial.
    const cvReceived = new Date();
    const hrReview = new Date(cvReceived.getTime() + 1000);
    await supabase.from('stage_history').insert([
      {
        application_id: application.id,
        from_stage: null,
        to_stage: Stage.CV_RECEIVED,
        status: StageStatus.COMPLETED,
        changed_by_user_id: user.id,
        notes: 'Perfil traído desde el Banco de Talentos',
        changed_at: cvReceived.toISOString(),
      },
      {
        application_id: application.id,
        from_stage: Stage.CV_RECEIVED,
        to_stage: Stage.HR_REVIEW,
        status: StageStatus.PENDING,
        changed_by_user_id: user.id,
        notes: 'Avance automático a revisión HR',
        changed_at: hrReview.toISOString(),
      },
    ]);

    // El registro NO sale del banco: queda marcado con a qué búsqueda fue.
    const { error: entryErr } = await supabase
      .from('talent_pool_entries')
      .update({
        status: 'ASSIGNED',
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.id,
        assigned_application_id: application.id,
        assigned_job_id: body.jobId,
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
        resubmitted_at: null,
      })
      .eq('id', entry.id);
    if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });

    // No se le manda el mail de "recibimos tu postulación": la persona no se
    // postuló a esta búsqueda, la trajimos nosotros. Ese mail la confundiría.
    return NextResponse.json({ ok: true, jobTitle: job.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
