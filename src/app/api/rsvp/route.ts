import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { verifyRsvp } from '@/lib/rsvp';
import { getMessageEmailOptions } from '@/lib/messageEmail';

// POST /api/rsvp - Respuesta "Voy / No voy" desde el mail, sin sesión.
// La autorización es el link firmado (m + u + t): sólo vale para ese mensaje y
// esa persona, y sólo toca su fila de message_recipients.
const Schema = z.object({
  m: z.string().min(1).max(64),
  u: z.string().min(1).max(64),
  r: z.enum(['yes', 'no']),
  t: z.string().min(10).max(64),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'El link no es válido.' }, { status: 400 });
  const { m, u, r, t } = parsed.data;
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
  return NextResponse.json({ ok: true, ...answer });
}
