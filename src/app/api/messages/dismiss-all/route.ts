import { NextResponse } from 'next/server';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * "Limpiar todo" de la campanita: archiva de una todas las notificaciones
 * visibles, como el botón de limpiar del centro de notificaciones de la Mac.
 *
 * Deja afuera las que piden confirmación y todavía no se confirmaron: esas se
 * archivan una por una, después de confirmarlas. Sin esa excepción, un clic
 * dejaría a HR esperando confirmaciones que nunca van a llegar.
 */
export async function POST() {
  try {
    const supabaseAuth = await getSupabaseAuthServer();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseServer();

    const { data: pendientes, error: fetchError } = await supabase
      .from('message_recipients')
      .select('id, confirmed_at, messages!inner(require_confirmation)')
      .eq('user_id', user.id)
      .is('dismissed_at', null);
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    const archivables = (pendientes ?? [])
      .filter((r) => !((r.messages as any)?.require_confirmation === true && !r.confirmed_at))
      .map((r) => r.id as string);

    if (archivables.length === 0) {
      return NextResponse.json({ success: true, dismissed: 0 });
    }

    const now = new Date().toISOString();

    // Dos updates independientes del orden: primero la fecha de lectura, sólo
    // sobre las que estaban sin leer, para no pisar la real de las ya leídas.
    const { error: readError } = await supabase
      .from('message_recipients')
      .update({ read_at: now })
      .in('id', archivables)
      .is('read_at', null);
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

    const { error: dismissError } = await supabase
      .from('message_recipients')
      .update({ dismissed_at: now })
      .in('id', archivables);
    if (dismissError) return NextResponse.json({ error: dismissError.message }, { status: 500 });

    return NextResponse.json({ success: true, dismissed: archivables.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
