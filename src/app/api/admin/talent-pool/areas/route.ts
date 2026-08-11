import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Áreas de interés del Banco de Talentos.
 *
 * Un área NUNCA se borra: se desactiva. Los registros guardan el nombre del
 * área, así que borrarla dejaría el filtro del panel sin una opción que sigue
 * existiendo en los datos.
 */
async function list() {
  const supabase = getSupabaseServer();
  const [areas, entries] = await Promise.all([
    supabase.from('talent_pool_areas').select('id, name, active, sort_order').order('sort_order'),
    supabase.from('talent_pool_entries').select('areas'),
  ]);
  if (areas.error) throw new Error(areas.error.message);
  if (entries.error) throw new Error(entries.error.message);

  const usados = new Map<string, number>();
  for (const e of entries.data ?? []) {
    for (const a of (e.areas as string[]) ?? []) usados.set(a, (usados.get(a) ?? 0) + 1);
  }

  return {
    areas: (areas.data ?? []).map((a) => ({ ...a, used: usados.get(a.name as string) ?? 0 })),
  };
}

export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await list());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2, 'El área necesita un nombre.').max(40),
  }),
  z.object({ action: z.literal('toggle'), id: dbId(), active: z.boolean() }),
  z.object({ action: z.literal('rename'), id: dbId(), name: z.string().trim().min(2).max(40) }),
]);

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const supabase = getSupabaseServer();

    if (body.action === 'create') {
      // Las nuevas van antes de "Otro", que se queda en 900.
      const { error } = await supabase
        .from('talent_pool_areas')
        .insert({ name: body.name, created_by: user.id, sort_order: 500 });
      if (error) {
        const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
        return NextResponse.json(
          { error: dup ? 'Ya existe un área con ese nombre.' : error.message },
          { status: dup ? 400 : 500 },
        );
      }
    }

    if (body.action === 'toggle') {
      const { error } = await supabase
        .from('talent_pool_areas')
        .update({ active: body.active })
        .eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'rename') {
      // Renombrar no reescribe las entradas ya cargadas: siguen con el nombre
      // que el área tenía cuando la persona la eligió.
      const { error } = await supabase
        .from('talent_pool_areas')
        .update({ name: body.name })
        .eq('id', body.id);
      if (error) {
        const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
        return NextResponse.json(
          { error: dup ? 'Ya existe un área con ese nombre.' : error.message },
          { status: dup ? 400 : 500 },
        );
      }
    }

    return NextResponse.json(await list());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
