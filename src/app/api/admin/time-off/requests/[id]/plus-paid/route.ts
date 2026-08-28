import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Marca (o desmarca) el plus de una licencia como liquidado EN UN MES.
 *
 * Antes era un booleano de la solicitud. Desde que las novedades se recortan al
 * mes que se liquida, una licencia del 24/8 al 6/9 son dos renglones que se
 * liquidan por separado, y un solo booleano no puede decir "agosto sí,
 * septiembre no".
 */
const BodySchema = z.object({
  plus_paid: z.boolean(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    const { plus_paid: plusPaid, year, month } = parsed.data;
    const supabase = getSupabaseServer();

    // Marcado = existe el renglón. Desmarcado = no existe. No hay estado
    // intermedio que mantener sincronizado.
    const { error } = plusPaid
      ? await supabase
          .from('leave_request_plus_paid_months')
          .upsert(
            { leave_request_id: id, year, month, marked_by: user.id },
            { onConflict: 'leave_request_id,year,month' },
          )
      : await supabase
          .from('leave_request_plus_paid_months')
          .delete()
          .eq('leave_request_id', id)
          .eq('year', year)
          .eq('month', month);

    if (error) {
      console.error('Error updating plus_paid:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plus_paid: plusPaid, year, month });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('Error in PATCH /api/admin/time-off/requests/[id]/plus-paid:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
