import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// Estado de mail por tipo de evento de Resend.
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};
// Orden para no pisar un estado más avanzado con uno anterior.
const RANK: Record<string, number> = { sent: 1, delayed: 2, delivered: 3, complained: 4, bounced: 5 };

// Verificación de firma Svix (lo que usa Resend) sin dependencia externa.
function verifySignature(secret: string, id: string, timestamp: string, body: string, header: string): boolean {
  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(key, 'base64');
  } catch {
    return false;
  }
  const expected = crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`).digest('base64');
  const expectedBuf = Buffer.from(expected);
  // El header es una lista separada por espacios de "v1,<firma>".
  return header.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

// POST /api/webhooks/resend — eventos de entrega/rebote de mails.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Falla cerrado: sin secret configurado no aceptamos eventos.
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 400 });
  }

  const body = await req.text();
  const id = req.headers.get('svix-id') ?? '';
  const timestamp = req.headers.get('svix-timestamp') ?? '';
  const signature = req.headers.get('svix-signature') ?? '';
  if (!id || !timestamp || !signature || !verifySignature(secret, id, timestamp, body, signature)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  // Anti-replay: rechazar timestamps con más de 5 min de antigüedad.
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: 'Timestamp fuera de tolerancia' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const type = event?.type as string | undefined;
  const providerId = event?.data?.email_id as string | undefined;
  const status = type ? STATUS_BY_EVENT[type] : undefined;
  if (!type || !providerId || !status) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = getSupabaseServer();
  const recipientEmail = Array.isArray(event?.data?.to) ? event.data.to[0] : event?.data?.to;

  // Idempotencia: unique(provider_id, event_type). Si ya existía, no reprocesar.
  const { error: evErr } = await supabase.from('message_email_events').insert({
    provider_id: providerId,
    event_type: type,
    recipient_email: recipientEmail ?? null,
    payload: event,
  });
  if (evErr) {
    // Solo la violación de unique (evento ya procesado) es idempotencia real; otro error → reintentar (5xx).
    if ((evErr as any).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[resend webhook] error registrando evento:', evErr);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Actualizar el estado del/los recipient(s) con ese provider id (sin retroceder de estado).
  const { data: rows } = await supabase
    .from('message_recipients')
    .select('id, email_status')
    .eq('email_provider_id', providerId);
  const nowIso = new Date().toISOString();
  const updates = await Promise.all(
    (rows ?? [])
      .map((r: any) => {
        if ((RANK[status] ?? 0) < (RANK[r.email_status] ?? 0)) return null;
        return supabase
          .from('message_recipients')
          .update({ email_status: status, email_status_at: nowIso })
          .eq('id', r.id);
      })
      .filter(Boolean) as any[],
  );
  if (updates.some((u: any) => u?.error)) {
    console.error('[resend webhook] error actualizando recipients');
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
