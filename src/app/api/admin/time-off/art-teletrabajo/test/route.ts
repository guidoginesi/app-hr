import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendArtTeletrabajoNotification } from '@/lib/artTeletrabajo/sendNotification';
import { getArgentinaDateString, addDaysToDateString } from '@/lib/artTeletrabajo/timezone';
import { findDeparturesStartingOn, findReturnsEndingOn } from '@/lib/artTeletrabajo/roster';

const bodySchema = z.object({
  type: z.enum(['pre_departure', 'post_return']),
  rosterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().optional(),
});

/** Envío manual de prueba del PDF ART (solo admin). */
export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const today = getArgentinaDateString();
  const type = parsed.data.type;
  const rosterDate =
    parsed.data.rosterDate ??
    (type === 'pre_departure' ? addDaysToDateString(today, 1) : today);

  const triggers =
    type === 'pre_departure'
      ? await findDeparturesStartingOn(supabase, rosterDate)
      : await findReturnsEndingOn(
          supabase,
          addDaysToDateString(rosterDate, -1),
        );

  try {
    const result = await sendArtTeletrabajoNotification({
      supabase,
      notificationType: type,
      triggerDate: today,
      rosterDate,
      triggers,
      force: parsed.data.force ?? true,
    });

    return NextResponse.json({
      ok: true,
      type,
      rosterDate,
      triggers,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
