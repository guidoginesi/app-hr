import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateMessageSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200),
  body: z.string().min(1, 'El cuerpo es requerido'),
  priority: z.enum(['info', 'warning', 'critical']).default('info'),
  require_confirmation: z.boolean().default(false),
  expires_at: z.string().datetime().optional().nullable(),
  audience: z
    .union([
      z.object({ all: z.literal(true) }),
      z.object({ roles: z.array(z.string()).min(1) }),
    ])
    .default({ all: true }),
});

// GET /api/admin/messages - List all broadcast messages with metrics
export async function GET(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    let query = supabase
      .from('messages')
      .select(
        `
        id, type, title, priority, require_confirmation,
        status, created_at, published_at, expires_at,
        audience, created_by
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: messages, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with recipient metrics
    const messageIds = (messages ?? []).map((m: any) => m.id);

    let metricsMap: Record<
      string,
      { recipients_total: number; read_count: number; confirmed_count: number }
    > = {};

    if (messageIds.length > 0) {
      const { data: metrics } = await supabase
        .from('message_recipients')
        .select('message_id, read_at, confirmed_at')
        .in('message_id', messageIds);

      for (const m of messageIds) {
        const rows = (metrics ?? []).filter((r: any) => r.message_id === m);
        metricsMap[m] = {
          recipients_total: rows.length,
          read_count: rows.filter((r: any) => r.read_at !== null).length,
          confirmed_count: rows.filter((r: any) => r.confirmed_at !== null).length,
        };
      }
    }

    const enriched = (messages ?? []).map((m: any) => ({
      ...m,
      ...(metricsMap[m.id] ?? { recipients_total: 0, read_count: 0, confirmed_count: 0 }),
    }));

    return NextResponse.json({ items: enriched, total: count ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/messages - Create a draft message
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        type: 'broadcast',
        title: parsed.data.title,
        body: parsed.data.body,
        priority: parsed.data.priority,
        require_confirmation: parsed.data.require_confirmation,
        expires_at: parsed.data.expires_at ?? null,
        audience: parsed.data.audience,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
