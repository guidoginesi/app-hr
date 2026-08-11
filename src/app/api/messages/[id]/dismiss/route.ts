import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * Archiva una notificación para quien la recibió: sale de la campanita y queda
 * guardada en "ver todas", filtro Archivadas. No se borra nada.
 *
 * `dismissed_at` ya existía en la tabla sin que nadie lo escribiera ni lo
 * filtrara. Esto lo pone a funcionar.
 *
 * Con `?undo=1` se desarchiva, para deshacer un clic equivocado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseAuth = await getSupabaseAuthServer();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: messageId } = await params;
    const undo = req.nextUrl.searchParams.get('undo') === '1';
    const supabase = getSupabaseServer();

    const { data: recipient, error: fetchError } = await supabase
      .from('message_recipients')
      .select('id, read_at, confirmed_at, messages!inner(require_confirmation)')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!recipient) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    // Un aviso que pide confirmación no se puede archivar sin confirmarlo: si
    // no, la persona lo saca de la vista y a HR le queda pendiente para
    // siempre, sin que nadie se entere.
    const pideConfirmacion = (recipient.messages as any)?.require_confirmation === true;
    if (!undo && pideConfirmacion && !recipient.confirmed_at) {
      return NextResponse.json(
        { error: 'Esta notificación pide confirmación. Confirmala antes de archivarla.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('message_recipients')
      .update(
        undo
          ? { dismissed_at: null }
          : // Archivar implica haberla visto: si estaba sin leer, se marca leída
            // de paso, para que no quede contando en el badge.
            { dismissed_at: now, read_at: recipient.read_at ?? now },
      )
      .eq('id', recipient.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true, dismissed: !undo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
