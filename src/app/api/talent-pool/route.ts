import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderPlainTemplate } from '@/lib/email/layout';
import {
  ALLOWED_RESUME_EXTENSIONS,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RESUME_BYTES,
  RESUMES_BUCKET,
  SENIORITY_OPTIONS,
  SUBMISSIONS_PER_IP_PER_HOUR,
  TALENT_POOL_PREFIX,
  isAllowedResume,
  resumeExtension,
} from '@/lib/talentPool';
import { getActiveAreas } from '@/lib/talentPoolServer';

export const dynamic = 'force-dynamic';

/**
 * Alta en el Banco de Talentos desde el portal público.
 *
 * Endpoint SIN login: el middleware sólo cubre /admin y /portal. Todo lo que
 * llega acá es de un desconocido, así que se valida entero del lado del server
 * y no se confía en nada que haya validado el formulario.
 */

const BodySchema = z.object({
  name: z.string().trim().min(2, 'Contanos tu nombre completo.').max(MAX_NAME_LENGTH),
  email: z.string().trim().toLowerCase().email('Revisá el mail, no parece válido.'),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => {
      if (!v) return true;
      try {
        const url = new URL(v.startsWith('http') ? v : `https://${v}`);
        return !!url.hostname.includes('.');
      } catch {
        return false;
      }
    }, 'El link no parece una dirección válida.')
    // Se guarda normalizado: mucha gente pega "linkedin.com/in/…" sin el https.
    .transform((v) => (v && !v.startsWith('http') ? `https://${v}` : v)),
  seniority: z.enum(SENIORITY_OPTIONS, { message: 'Elegí tu nivel de experiencia.' }),
  message: z.string().trim().max(MAX_MESSAGE_LENGTH).optional().transform((v) => (v ? v : null)),
  areas: z.array(z.string().trim()).min(1, 'Elegí al menos un área de interés.'),
});

/** Hash de la IP: alcanza para contar envíos sin guardar un dato personal más. */
function hashIp(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || 'pow';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Campo trampa: es invisible para una persona, así que si viene con algo lo
    // completó un bot. Se responde OK para no enseñarle que lo detectamos.
    if (String(formData.get('website') || '').trim()) {
      return NextResponse.json({ ok: true });
    }

    const parsed = BodySchema.safeParse({
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      linkedinUrl: formData.get('linkedinUrl') ? String(formData.get('linkedinUrl')) : undefined,
      seniority: String(formData.get('seniority') || ''),
      message: formData.get('message') ? String(formData.get('message')) : undefined,
      areas: formData.getAll('areas').map(String),
    });
    if (!parsed.success) {
      return bad(parsed.error.issues[0]?.message ?? 'Revisá los datos del formulario.');
    }
    const { name, email, linkedinUrl, seniority, message, areas } = parsed.data;

    const file = formData.get('resume');
    if (!(file instanceof File) || file.size === 0) {
      return bad('Adjuntá tu CV para que podamos tenerte en cuenta.');
    }
    if (file.size > MAX_RESUME_BYTES) {
      return bad('El archivo supera el límite de 10MB.');
    }
    if (!isAllowedResume(file)) {
      return bad(
        `Formato no soportado. Subí tu CV en ${ALLOWED_RESUME_EXTENSIONS.join(', ').toUpperCase()}.`,
      );
    }

    const supabase = getSupabaseServer();

    // Las áreas se validan contra las activas: el <select> del formulario no es
    // garantía de nada cuando el endpoint es público.
    const activeAreas = await getActiveAreas();
    const validNames = new Set(activeAreas.map((a) => a.name));
    const cleanAreas = [...new Set(areas)].filter((a) => validNames.has(a));
    if (cleanAreas.length === 0) {
      return bad('Elegí al menos un área de interés.');
    }

    const ipHash = hashIp(req);
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentFromIp } = await supabase
      .from('talent_pool_submission_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', sinceHour);
    if ((recentFromIp ?? 0) >= SUBMISSIONS_PER_IP_PER_HOUR) {
      return bad('Recibimos varios envíos desde acá hace un rato. Probá de nuevo más tarde.', 429);
    }

    // ── Persona ────────────────────────────────────────────────────────
    // Mismo mail = misma persona, tenga o no postulaciones a búsquedas. El
    // upsert por email es lo que evita fichas duplicadas entre los dos canales.
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const candidatePatch: Record<string, unknown> = { email, name };
    // El LinkedIn sólo se pisa si el candidato mandó uno: si ya lo teníamos de
    // una postulación previa y ahora lo dejó vacío, no lo borramos.
    if (linkedinUrl) candidatePatch.linkedin_url = linkedinUrl;

    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .upsert(candidatePatch, { onConflict: 'email' })
      .select('id')
      .single();
    if (candErr) throw new Error(candErr.message);

    // ── CV ─────────────────────────────────────────────────────────────
    const ext = resumeExtension(file.name) || 'pdf';
    const objectPath = `${TALENT_POOL_PREFIX}/${candidate.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(RESUMES_BUCKET)
      .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    // ── Entrada del banco ──────────────────────────────────────────────
    const { data: entry } = await supabase
      .from('talent_pool_entries')
      .select('id, status, submissions_count, resume_path')
      .eq('candidate_id', candidate.id)
      .maybeSingle();

    const now = new Date().toISOString();

    if (!entry) {
      const { error } = await supabase.from('talent_pool_entries').insert({
        candidate_id: candidate.id,
        areas: cleanAreas,
        seniority,
        message,
        resume_path: objectPath,
        status: 'NEW',
      });
      if (error) throw new Error(error.message);
    } else {
      // Vuelve a dejar sus datos. Se actualiza todo (el CV nuevo pisa al viejo),
      // pero el estado sólo vuelve a NUEVO si HR todavía no había decidido: a un
      // descartado devolverlo a la bandeja lo trae de vuelta en cada envío, y a
      // un asignado lo sacaría del proceso en el que ya está.
      const decidido = entry.status === 'DISCARDED' || entry.status === 'ASSIGNED';
      const { error } = await supabase
        .from('talent_pool_entries')
        .update({
          areas: cleanAreas,
          seniority,
          message,
          resume_path: objectPath,
          status: decidido ? entry.status : 'NEW',
          resubmitted_at: decidido ? now : null,
          submissions_count: (entry.submissions_count ?? 1) + 1,
          last_submitted_at: now,
        })
        .eq('id', entry.id);
      if (error) throw new Error(error.message);

      // El CV viejo ya no lo referencia nadie. Sin esto el bucket acumula
      // archivos huérfanos con datos personales adentro.
      if (entry.resume_path && entry.resume_path !== objectPath) {
        await supabase.storage.from(RESUMES_BUCKET).remove([entry.resume_path]).catch(() => {});
      }
    }

    await supabase.from('talent_pool_submission_log').insert({ ip_hash: ipHash });

    // ── Confirmación ───────────────────────────────────────────────────
    // No bloquea la respuesta: si Resend falla, el candidato ya quedó guardado y
    // devolverle un error lo haría mandar todo de nuevo.
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject, body, is_active')
      .eq('template_key', 'talent_pool_confirmation')
      .maybeSingle();

    if (tpl?.is_active) {
      const firstName = name.split(' ')[0] || name;
      const body = String(tpl.body).replaceAll('{{candidateName}}', firstName);
      const subject = String(tpl.subject).replaceAll('{{candidateName}}', firstName);
      await sendSimpleEmail({
        to: email,
        subject,
        html: renderPlainTemplate({ templateKey: 'talent_pool_confirmation', subject, body }),
      }).catch((err) => console.error('talent_pool_confirmation email:', err));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/talent-pool', error);
    return NextResponse.json(
      { error: 'No pudimos guardar tus datos. Probá de nuevo en un rato.' },
      { status: 500 },
    );
  }
}
