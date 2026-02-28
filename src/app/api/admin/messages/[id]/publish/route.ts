import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveAudienceUserIds } from '@/lib/notificationService';

const BATCH_SIZE = 500;

// POST /api/admin/messages/[id]/publish - Publish a draft message and create recipients
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden publicar mensajes en estado borrador' },
        { status: 400 }
      );
    }

    if (message.type !== 'broadcast') {
      return NextResponse.json(
        { error: 'Solo se pueden publicar mensajes de tipo broadcast desde este endpoint' },
        { status: 400 }
      );
    }

    // Resolve target users from audience
    const audience = message.audience ?? { all: true };
    const userIds = await resolveAudienceUserIds(audience);

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron usuarios para la audiencia seleccionada' },
        { status: 400 }
      );
    }

    // Mark as published
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert recipients in batches
    let insertedCount = 0;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const recipients = batch.map((userId) => ({
        message_id: id,
        user_id: userId,
      }));

      const { error: recipientsError } = await supabase
        .from('message_recipients')
        .insert(recipients)
        .select();

      if (recipientsError) {
        console.error('[publish] Error inserting recipients batch:', recipientsError);
      } else {
        insertedCount += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      recipients_created: insertedCount,
    });
  } catch (error: any) {
    console.error('[publish] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
