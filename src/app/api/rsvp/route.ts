import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { verifyRsvp, readRsvpAnswers } from '@/lib/rsvp';
import { getMessageEmailOptions } from '@/lib/messageEmail';

// POST /api/rsvp - Respuesta desde el mail, sin sesión: "Voy / No voy" (r) o
// una opción de una pregunta (q + o). La autorización es el link firmado
// (m + u + t): sólo vale para ese mensaje y esa persona, y sólo toca su fila
// de message_recipients.
const Schema = z.object({
  m: z.string().min(1).max(64),
  u: z.string().min(1).max(64),
  t: z.string().min(10).max(64),
  r: z.enum(['yes', 'no']).optional(),
  q: z.number().int().min(0).max(9).optional(),
  o: z.number().int().min(0).max(9).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'El link no es válido.' }, { status: 400 });
  const { m, u, t, r, q, o } = parsed.data;
  if (!verifyRsvp(m, u, t)) return NextResponse.json({ error: 'El link no es válido.' }, { status: 403 });

  const supabase = getSupabaseServer();
  const { data: message } = await supabase
    .from('messages')
    .select('id, title, status, metadata')
    .eq('id', m)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: 'El mensaje ya no existe.' }, { status: 404 });

  const rsvp = getMessageEmailOptions(message.metadata).rsvp;
  if (!rsvp) return NextResponse.json({ error: 'Este mensaje no pide respuesta.' }, { status: 400 });

  if (rsvp.questions?.length) return answerOption(supabase, message.title, rsvp.questions, { m, u, q, o });

  if (!r) return NextResponse.json({ error: 'El link no es válido.' }, { status: 400 });
  const answer = { title: message.title, label: r === 'yes' ? rsvp.yes : rsvp.no, other: r === 'yes' ? rsvp.no : rsvp.yes };

  const { data: updated, error } = await supabase
    .from('message_recipients')
    .update({ rsvp_response: r, rsvp_at: new Date().toISOString() })
    .eq('message_id', m)
    .eq('user_id', u)
    .select('id');
  if (error) return NextResponse.json({ error: 'No pude guardar tu respuesta. Probá de nuevo en un rato.' }, { status: 500 });

  // Sin fila: es el mail de prueba (o un mensaje que todavía no se publicó).
  if (!updated?.length) return NextResponse.json({ ok: true, test: true, ...answer });

  await markRead(supabase, m, u);
  return NextResponse.json({ ok: true, ...answer });
}

/**
 * Pregunta con opciones. Sin q/o sólo devuelve lo que la persona ya eligió, para
 * que la página muestre todas las preguntas. Con q/o guarda esa opción sin
 * tocar las respuestas a las otras preguntas.
 */
async function answerOption(
  supabase: ReturnType<typeof getSupabaseServer>,
  title: string,
  questions: { question: string; options: string[] }[],
  { m, u, q, o }: { m: string; u: string; q?: number; o?: number },
) {
  const choosing = q !== undefined && o !== undefined;
  if (choosing && (!questions[q] || o >= questions[q].options.length)) {
    return NextResponse.json({ error: 'Esa opción ya no existe.' }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from('message_recipients')
    .select('id, rsvp_answers')
    .eq('message_id', m)
    .eq('user_id', u)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'No pude leer tu respuesta. Probá de nuevo en un rato.' }, { status: 500 });

  const answers = readRsvpAnswers(row?.rsvp_answers, questions);
  if (choosing) answers[String(q)] = o;
  const payload = { ok: true, title, questions, answers };

  // Sin fila: es el mail de prueba. La página recuerda la elección, pero no se guarda.
  if (!row) return NextResponse.json({ ...payload, test: true });
  if (!choosing) return NextResponse.json(payload);

  const { error } = await supabase
    .from('message_recipients')
    .update({ rsvp_answers: answers, rsvp_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) return NextResponse.json({ error: 'No pude guardar tu respuesta. Probá de nuevo en un rato.' }, { status: 500 });

  await markRead(supabase, m, u);
  return NextResponse.json(payload);
}

// Responder es haberlo leído: sin esto el detalle muestra "No leído" al lado de
// una respuesta. Sólo si todavía no estaba leído, para no pisar la fecha.
async function markRead(supabase: ReturnType<typeof getSupabaseServer>, m: string, u: string) {
  await supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('message_id', m)
    .eq('user_id', u)
    .is('read_at', null);
}
