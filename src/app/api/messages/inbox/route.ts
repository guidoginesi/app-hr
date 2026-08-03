import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { hasTemplateTokens, renderTemplate, buildRecipientVars } from '@/lib/templateVars';

// GET /api/messages/inbox - Get authenticated user's message inbox
export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = await getSupabaseAuthServer();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const now = new Date().toISOString();

    const { data, error, count } = await supabase
      .from('message_recipients')
      .select(
        `
        id,
        message_id,
        delivered_at,
        read_at,
        confirmed_at,
        dismissed_at,
        messages (
          id,
          type,
          title,
          body,
          priority,
          require_confirmation,
          published_at,
          expires_at,
          metadata,
          status
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`, { referencedTable: 'messages' })
      .eq('messages.status', 'published')
      // Orden cronológico, lo más nuevo primero — el mismo que usa la página
      // "ver todas" (src/app/portal/messages/page.tsx).
      //
      // Antes el criterio PRINCIPAL era `read_at asc nullsFirst`, con la
      // intención de mostrar las no leídas arriba. El problema es que para las
      // ya leídas ese orden manda, y ordena por read_at ASCENDENTE: las leídas
      // hace más tiempo primero. Combinado con el limit de la campanita, la
      // ventana quedaba "no leídas + las leídas más viejas", así que alguien con
      // muchas notificaciones leídas veía en la campanita cosas de meses atrás y
      // ninguna reciente, mientras "ver todas" las mostraba bien.
      //
      // La prioridad de las no leídas no se pierde: NotificationBell ya las
      // flota arriba en el cliente, sobre lo que recibe.
      .order('delivered_at', { ascending: false })
      .order('published_at', { ascending: false, referencedTable: 'messages' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[inbox] query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out items where message join is null (filtered out by the .eq on related table)
    const items = (data ?? []).filter((item: any) => item.messages !== null);

    // Render-on-read de variables de plantilla para el destinatario actual
    let renderedItems = items;
    if (items.some((it: any) => hasTemplateTokens(it.messages?.title, it.messages?.body))) {
      const { data: emp } = await supabase
        .from('employees')
        .select('first_name, last_name, dni, cuil')
        .eq('user_id', user.id)
        .maybeSingle();
      renderedItems = items.map((it: any) => {
        const msg = it.messages;
        if (msg && hasTemplateTokens(msg.title, msg.body)) {
          const ctx = (msg.metadata?.template_context ?? {}) as Record<string, string>;
          const vars = buildRecipientVars(emp ?? null, ctx);
          return { ...it, messages: { ...msg, title: renderTemplate(msg.title, vars), body: renderTemplate(msg.body, vars, true) } };
        }
        return it;
      });
    }

    // Unread count (no read_at)
    const { count: unreadCount } = await supabase
      .from('message_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    // Pending confirmation count (require_confirmation=true AND confirmed_at IS NULL)
    // We join with messages to check require_confirmation
    const { data: pendingConfirmData } = await supabase
      .from('message_recipients')
      .select(
        `id, confirmed_at, messages!inner(require_confirmation, status, expires_at)`
      )
      .eq('user_id', user.id)
      .is('confirmed_at', null)
      .eq('messages.require_confirmation', true)
      .eq('messages.status', 'published');

    const pendingConfirmCount = (pendingConfirmData ?? []).filter((item: any) => {
      const exp = item.messages?.expires_at;
      return !exp || new Date(exp) > new Date();
    }).length;

    return NextResponse.json({
      items: renderedItems,
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
      pending_confirm_count: pendingConfirmCount,
      badge_count: (unreadCount ?? 0) + pendingConfirmCount,
    });
  } catch (error: any) {
    console.error('[inbox] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
