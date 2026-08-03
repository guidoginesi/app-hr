import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/messages/[id] - Get message detail with full recipient list
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // 'unread' | 'read' | 'confirmed'

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    let recipientsQuery = supabase
      .from('message_recipients')
      .select(
        `
        id, user_id, delivered_at, read_at, confirmed_at, dismissed_at
      `
      )
      .eq('message_id', id)
      .order('delivered_at', { ascending: false });

    if (filter === 'unread') {
      recipientsQuery = recipientsQuery.is('read_at', null);
    } else if (filter === 'read') {
      recipientsQuery = recipientsQuery.not('read_at', 'is', null);
    } else if (filter === 'confirmed') {
      recipientsQuery = recipientsQuery.not('confirmed_at', 'is', null);
    }

    const { data: recipients, error: recipientsError } = await recipientsQuery;

    if (recipientsError) {
      return NextResponse.json({ error: recipientsError.message }, { status: 500 });
    }

    // Enrich recipients with employee info
    const userIds = (recipients ?? []).map((r: any) => r.user_id);
    let employeeMap: Record<string, { first_name: string; last_name: string; job_title: string; work_email: string }> = {};

    if (userIds.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('user_id, first_name, last_name, job_title, work_email, personal_email')
        .in('user_id', userIds);

      for (const emp of employees ?? []) {
        employeeMap[emp.user_id] = {
          first_name: emp.first_name,
          last_name: emp.last_name,
          job_title: emp.job_title,
          work_email: emp.work_email || emp.personal_email,
        };
      }
    }

    const enrichedRecipients = (recipients ?? []).map((r: any) => ({
      ...r,
      employee: employeeMap[r.user_id] ?? null,
    }));

    const metrics = {
      recipients_total: enrichedRecipients.length,
      read_count: enrichedRecipients.filter((r: any) => r.read_at !== null).length,
      confirmed_count: enrichedRecipients.filter((r: any) => r.confirmed_at !== null).length,
    };

    return NextResponse.json({ message, recipients: enrichedRecipients, metrics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/messages/[id] - Archive a message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseServer();

    // Dos operaciones distintas sobre el mismo PATCH: archivar, o cambiar/cancelar
    // la fecha programada. Se distinguen por qué campo viene en el body.
    const update: Record<string, unknown> = {};

    if ('status' in body) {
      if (body.status !== 'archived') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      update.status = 'archived';
      // Archivar un borrador programado también cancela la programación: si no,
      // el cron lo publicaría igual y reviviría un mensaje archivado.
      update.scheduled_for = null;
    }

    if ('scheduled_for' in body) {
      const value = body.scheduled_for;
      if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
      }
      // Sólo tiene sentido programar un borrador: lo ya publicado no se reenvía.
      const { data: actual, error: readError } = await supabase
        .from('messages')
        .select('status')
        .eq('id', id)
        .single();
      if (readError || !actual) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      if (actual.status !== 'draft') {
        return NextResponse.json({ error: 'Solo se puede programar un borrador.' }, { status: 400 });
      }
      update.scheduled_for = value;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('messages')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
