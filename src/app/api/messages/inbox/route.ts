import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

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
      .order('read_at', { ascending: true, nullsFirst: true })
      .order('delivered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[inbox] query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out items where message join is null (filtered out by the .eq on related table)
    const items = (data ?? []).filter((item: any) => item.messages !== null);

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
      items,
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
