import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { parseMessageFilters, queryMessages } from '@/lib/messagesQuery';

const CreateMessageSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200),
  body: z.string().min(1, 'El cuerpo es requerido'),
  priority: z.enum(['info', 'warning', 'critical']).default('info'),
  require_confirmation: z.boolean().default(false),
  expires_at: z.string().datetime().optional().nullable(),
  // Programación por DÍA (ver db/migration-messages-programados.sql): el envío
  // sale en el lote de la mañana, así que no se pide hora.
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.').optional().nullable(),
  send_to_google_chat: z.boolean().default(false),
  send_email: z.boolean().default(false),
  template_context: z.record(z.string(), z.string()).optional(),
  audience: z
    .union([
      z.object({ all: z.literal(true) }),
      z.object({ roles: z.array(z.string()).min(1) }),
      z.object({ test: z.literal(true) }),
      z.object({ employment_type: z.enum(['monotributista', 'dependency']) }),
      z.object({ department_id: z.string().uuid() }),
      z.object({ manager_id: z.string().uuid() }),
      z.object({ user_ids: z.array(z.string().uuid()).min(1) }),
    ])
    .default({ all: true }),
});

// GET /api/admin/messages - Listado filtrado (server-side) con métricas
export async function GET(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const filters = parseMessageFilters(searchParams);
    const { items, total } = await queryMessages(supabase, filters);

    return NextResponse.json({ items, total });
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
        scheduled_for: parsed.data.scheduled_for ?? null,
        send_to_google_chat: parsed.data.send_to_google_chat,
        send_email: parsed.data.send_email,
        audience: parsed.data.audience,
        metadata:
          parsed.data.template_context && Object.keys(parsed.data.template_context).length
            ? { template_context: parsed.data.template_context }
            : null,
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
