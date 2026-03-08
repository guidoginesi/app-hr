import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/messages/templates — list all internal/automation templates
export async function GET() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('email_templates')
    .select('id, template_key, subject, body, description, variables, is_active, category, send_internal_message, internal_message_text, send_to_google_chat')
    .in('category', ['automation', 'time_off', 'payroll'])
    .order('category')
    .order('template_key');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PUT /api/admin/messages/templates — update a template
export async function PUT(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { template_key, subject, body: templateBody, is_active, send_internal_message, internal_message_text, send_to_google_chat } = body;

  if (!template_key) return NextResponse.json({ error: 'template_key requerido' }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('email_templates')
    .update({
      subject,
      body: templateBody,
      is_active,
      send_internal_message,
      internal_message_text,
      send_to_google_chat: send_to_google_chat ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('template_key', template_key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
