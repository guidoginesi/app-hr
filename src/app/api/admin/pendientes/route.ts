import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { ADMIN_MODULES } from '@/lib/adminModules';
import { getPendingByModule, markModuleSeen } from '@/lib/adminPending';

export const dynamic = 'force-dynamic';

/**
 * Novedades por módulo para el bullet del sidebar.
 *
 * GET  devuelve los conteos.
 * POST marca un módulo como visto y devuelve los conteos ya actualizados: el
 *      sidebar hace una sola llamada al entrar a un módulo, en vez de una para
 *      marcar y otra para releer.
 */
export async function GET() {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ counts: await getPendingByModule(user.id) });
}

const BodySchema = z.object({ module: z.enum(ADMIN_MODULES) });

export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });

  await markModuleSeen(user.id, parsed.data.module);
  return NextResponse.json({ counts: await getPendingByModule(user.id) });
}
