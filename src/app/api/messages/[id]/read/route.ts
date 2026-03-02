import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

// POST /api/messages/[id]/read - Mark message as read for current user
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

    const { data: recipient, error: fetchError } = await supabase
      .from('message_recipients')
      .select('id, read_at')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!recipient) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (recipient.read_at) {
      return NextResponse.json({ success: true, already_read: true });
    }

    const { error: updateError } = await supabase
      .from('message_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('id', recipient.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
