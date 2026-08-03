import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { publishMessage } from '@/lib/messagePublish';

// POST /api/admin/messages/[id]/publish — publica un borrador y crea los destinatarios.
//
// La lógica vive en src/lib/messagePublish.ts porque la comparte con el cron que
// publica los mensajes programados. Acá sólo queda la autorización.
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
    const result = await publishMessage(id, user.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, recipients_created: result.recipientsCreated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[publish] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
