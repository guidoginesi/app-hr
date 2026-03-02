import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

// POST /api/messages/[id]/confirm - Acknowledge a message that requires confirmation
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = await getSupabaseAuthServer();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messageId } = await params;
    const supabase = getSupabaseServer();

    // Verify the message requires confirmation
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, require_confirmation')
      .eq('id', messageId)
      .maybeSingle();

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!message.require_confirmation) {
      return NextResponse.json(
        { error: 'This message does not require confirmation' },
        { status: 400 }
      );
    }

    const { data: recipient, error: fetchError } = await supabase
      .from('message_recipients')
      .select('id, confirmed_at, read_at')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !recipient) {
      return NextResponse.json({ error: 'Recipient record not found' }, { status: 404 });
    }

    if (recipient.confirmed_at) {
      return NextResponse.json({ success: true, already_confirmed: true });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('message_recipients')
      .update({
        confirmed_at: now,
        // Also mark as read if not already
        read_at: recipient.read_at ?? now,
      })
      .eq('id', recipient.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
