import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { PortalShell } from '@/app/portal/PortalShell';
import { MessagesInboxClient } from './MessagesInboxClient';

export const dynamic = 'force-dynamic';

export default async function MessagesInboxPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const supabaseAuth = await getSupabaseAuthServer();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) redirect('/portal/login');

  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  const { data: items } = await supabase
    .from('message_recipients')
    .select(
      `
      id, message_id, delivered_at, read_at, confirmed_at, dismissed_at,
      messages (
        id, type, title, body, priority, require_confirmation,
        published_at, expires_at, metadata, status
      )
    `
    )
    .eq('user_id', user.id)
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('delivered_at', { ascending: false })
    .limit(100);

  const filtered = ((items ?? []) as any[]).filter((item: any) => {
    const msg = item.messages;
    if (!msg || msg.status !== 'published') return false;
    if (msg.expires_at && new Date(msg.expires_at) <= new Date(now)) return false;
    return true;
  });

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="messages">
      <MessagesInboxClient items={filtered as any} />
    </PortalShell>
  );
}
