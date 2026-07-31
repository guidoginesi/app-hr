import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(120),
  title: z.string().default(''),
  body: z.string().default(''),
});

// GET /api/admin/messages/manual-templates — lista de plantillas de mensajes manuales
export async function GET() {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('message_templates')
    .select('id, name, title, body, created_at')
    .order('created_at', { ascending: false });
  return NextResponse.json({ items: data ?? [] });
}

// POST — crea una plantilla
export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateTemplateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(', ') }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('message_templates')
    .insert({ name: parsed.data.name, title: parsed.data.title, body: parsed.data.body, created_by: user.id })
    .select('id, name, title, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
