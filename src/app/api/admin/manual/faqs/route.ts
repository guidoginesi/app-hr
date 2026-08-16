import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { proponerFaq } from '@/lib/manual/faq';

export const dynamic = 'force-dynamic';

/**
 * Los agujeros del manual, y las FAQ que salen de taparlos.
 *
 * Un "candidato" es una consulta donde el manual no alcanzó: o el agente dijo
 * que no encontraba la respuesta, o HR editó el borrador para agregar algo. En
 * los dos casos la respuesta que se mandó contiene conocimiento que no está
 * escrito, y ese es el que se pierde si nadie lo captura.
 */

const CrearSchema = z.object({
  accion: z.literal('crear'),
  inquiry_id: dbId(),
});

const GuardarSchema = z.object({
  accion: z.literal('guardar'),
  id: dbId(),
  pregunta: z.string().min(1).max(500).optional(),
  respuesta: z.string().min(1).max(4000).optional(),
  estado: z.enum(['BORRADOR', 'APROBADA', 'ARCHIVADA']).optional(),
  pendiente_de_manual: z.boolean().optional(),
});

const BodySchema = z.discriminatedUnion('accion', [CrearSchema, GuardarSchema]);

export async function GET() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();

  const { data: faqs } = await supabase
    .from('manual_faqs')
    .select('*')
    .order('creado_at', { ascending: false });

  // Candidatos: propuestas donde el manual no alcanzó y la consulta ya se
  // respondió. Se excluyen las consultas que ya generaron una FAQ.
  const yaConFaq = new Set((faqs ?? []).map((f) => f.origen_inquiry_id).filter(Boolean));

  const { data: propuestas } = await supabase
    .from('inquiry_answer_drafts')
    .select('inquiry_id, hay_respuesta, resultado, respuesta_enviada, nota_para_hr, creado_at')
    .or('hay_respuesta.eq.false,resultado.eq.EDITADA')
    .order('creado_at', { ascending: false })
    .limit(100);

  const candidatos: unknown[] = [];
  const vistas = new Set<string>();
  for (const p of propuestas ?? []) {
    const inquiryId = p.inquiry_id as string;
    if (yaConFaq.has(inquiryId) || vistas.has(inquiryId)) continue;
    vistas.add(inquiryId);

    const { data: consulta } = await supabase
      .from('inquiries_with_details')
      .select('id, subject, category, status, employee_name')
      .eq('id', inquiryId)
      .maybeSingle();
    if (!consulta) continue;

    // La respuesta real: la que HR editó, o el último mensaje que mandó.
    let respuesta = (p.respuesta_enviada as string | null) ?? null;
    if (!respuesta) {
      const { data: ultima } = await supabase
        .from('inquiry_messages')
        .select('body')
        .eq('inquiry_id', inquiryId)
        .eq('author_role', 'hr')
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      respuesta = (ultima?.body as string | null) ?? null;
    }
    // Sin respuesta de HR no hay nada que aprender todavía.
    if (!respuesta) continue;

    candidatos.push({
      inquiry_id: inquiryId,
      asunto: consulta.subject,
      categoria: consulta.category,
      estado_consulta: consulta.status,
      // Por qué es candidato: es lo que le explica a quien mira para qué está acá.
      motivo: p.hay_respuesta === false ? 'El manual no cubría la consulta' : 'HR editó el borrador',
      nota_para_hr: p.nota_para_hr,
      respuesta,
    });
  }

  return NextResponse.json({ faqs: faqs ?? [], candidatos });
}

export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const supabase = getSupabaseServer();
  const body = parsed.data;

  // ── Guardar / aprobar / archivar ───────────────────────────────────────
  if (body.accion === 'guardar') {
    const cambios: Record<string, unknown> = { actualizado_at: new Date().toISOString() };
    if (body.pregunta !== undefined) cambios.pregunta = body.pregunta;
    if (body.respuesta !== undefined) cambios.respuesta = body.respuesta;
    if (body.pendiente_de_manual !== undefined) cambios.pendiente_de_manual = body.pendiente_de_manual;
    if (body.estado !== undefined) {
      cambios.estado = body.estado;
      // Aprobar deja constancia de quién: a partir de ese momento el agente la
      // cita como si fuera el manual.
      cambios.aprobada_por = body.estado === 'APROBADA' ? user.id : null;
      cambios.aprobada_at = body.estado === 'APROBADA' ? new Date().toISOString() : null;
    }

    const { error } = await supabase.from('manual_faqs').update(cambios).eq('id', body.id);
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Crear desde una consulta ───────────────────────────────────────────
  const { data: consulta } = await supabase
    .from('inquiries_with_details')
    .select('id, subject, category')
    .eq('id', body.inquiry_id)
    .maybeSingle();
  if (!consulta) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  const { data: mensajes } = await supabase
    .from('inquiry_messages')
    .select('body, author_role')
    .eq('inquiry_id', body.inquiry_id)
    .eq('is_internal', false)
    .order('created_at');

  const pregunta = (mensajes ?? []).filter((m) => m.author_role === 'employee').map((m) => m.body).join('\n\n');
  const respuesta = (mensajes ?? []).filter((m) => m.author_role === 'hr').map((m) => m.body).join('\n\n');
  if (!pregunta || !respuesta) {
    return NextResponse.json({ error: 'La consulta todavía no tiene pregunta y respuesta.' }, { status: 400 });
  }

  const propuesta = await proponerFaq(`${consulta.subject}\n\n${pregunta}`, respuesta);
  if (propuesta.error) return NextResponse.json({ error: propuesta.error }, { status: 500 });
  if (!propuesta.sirve) {
    // No es un error: hay respuestas que son puramente circunstanciales y no
    // dan una FAQ. Decirlo es mejor que guardar ruido.
    return NextResponse.json({ ok: true, sirve: false, motivo: propuesta.motivo });
  }

  const { data: creada, error } = await supabase
    .from('manual_faqs')
    .insert({
      pregunta: propuesta.pregunta,
      respuesta: propuesta.respuesta,
      categoria: consulta.category,
      origen_inquiry_id: body.inquiry_id,
      creado_por: user.id,
      // Nace en BORRADOR a propósito: nadie la confirmó todavía.
      estado: 'BORRADOR',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'No se pudo guardar la FAQ' }, { status: 500 });

  return NextResponse.json({ ok: true, sirve: true, faq: creada });
}
