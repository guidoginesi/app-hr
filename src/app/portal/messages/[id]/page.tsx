import { redirect, notFound } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { PortalShell } from '@/app/portal/PortalShell';
import { MessageDetailClient } from './MessageDetailClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MessageDetailPage({ params }: Props) {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { id } = await params;
  const supabaseAuth = await getSupabaseAuthServer();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) redirect('/portal/login');

  const supabase = getSupabaseServer();

  // Get message and recipient record
  const { data: recipient, error } = await supabase
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
    .eq('message_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !recipient || !recipient.messages) {
    notFound();
  }

  const message = recipient.messages as any;

  // Mark as read (server-side, fire-and-forget)
  if (!recipient.read_at) {
    supabase
      .from('message_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('id', recipient.id)
      .then(() => {});
  }

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="messages">
      <MessageDetailClient
        recipientId={recipient.id}
        messageId={message.id}
        message={message}
        initialReadAt={recipient.read_at}
        initialConfirmedAt={recipient.confirmed_at}
      />
    </PortalShell>
  );
}
