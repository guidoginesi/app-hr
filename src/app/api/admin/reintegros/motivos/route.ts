import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbId } from '@/lib/zodId';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Motivos de gasto configurables. Se pidió que no fueran una lista fija en el
 * código, para que People pueda agregar o retirar uno sin un deploy.
 *
 * Un motivo NUNCA se borra: se desactiva. Borrarlo dejaría los reintegros
 * históricos sin su motivo, y el reporte por motivo mentiría hacia atrás. Por eso
 * además cada reintegro guarda el nombre del motivo al momento de pedirse.
 */
async function list() {
  const supabase = getSupabaseServer();
  const [reasons, usage] = await Promise.all([
    supabase.from('expense_reasons').select('id, name, active, sort_order').order('sort_order'),
    supabase.from('expense_reimbursements').select('reason_id'),
  ]);
  if (reasons.error) throw new Error(reasons.error.message);
  if (usage.error) throw new Error(usage.error.message);

  const usados = new Map<string, number>();
  for (const r of usage.data ?? []) {
    if (r.reason_id) usados.set(r.reason_id as string, (usados.get(r.reason_id as string) ?? 0) + 1);
  }

  return {
    reasons: (reasons.data ?? []).map((r) => ({ ...r, used: usados.get(r.id as string) ?? 0 })),
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
    name: z.string().trim().min(2, 'El motivo necesita un nombre.').max(60),
  }),
  z.object({ action: z.literal('toggle'), id: dbId(), active: z.boolean() }),
  z.object({ action: z.literal('rename'), id: dbId(), name: z.string().trim().min(2).max(60) }),
]);

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const body = parsed.data;
    const supabase = getSupabaseServer();

    if (body.action === 'create') {
      const { error } = await supabase.from('expense_reasons').insert({
        name: body.name,
        created_by: user.id,
        // Los nuevos van al final, antes de "Otros", que queda en 900.
        sort_order: 500,
      });
      if (error) {
        // El índice único es case-insensitive: "Viáticos" y "viaticos" chocan.
        const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
        return NextResponse.json(
          { error: dup ? 'Ya existe un motivo con ese nombre.' : error.message },
          { status: dup ? 400 : 500 },
        );
      }
    }

    if (body.action === 'toggle') {
      const { error } = await supabase.from('expense_reasons').update({ active: body.active }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'rename') {
      // Renombrar NO cambia el nombre guardado en los reintegros ya cargados:
      // cada uno tiene su snapshot, así que el histórico no se reescribe.
      const { error } = await supabase.from('expense_reasons').update({ name: body.name }).eq('id', body.id);
      if (error) {
        const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
        return NextResponse.json(
          { error: dup ? 'Ya existe un motivo con ese nombre.' : error.message },
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
