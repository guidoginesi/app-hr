import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

const COLUMN: Record<string, string> = {
  invoice_initial: 'invoice_initial_path',
  invoice_final: 'invoice_final_path',
  certificate: 'certificate_path',
};

// GET /api/training/[id]/file?kind=invoice_initial|invoice_final|certificate
// Devuelve una signed URL. Acceso: admin o el dueño de la solicitud.
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const kind = new URL(req.url).searchParams.get('kind') ?? '';
    const column = COLUMN[kind];
    if (!column) return NextResponse.json({ error: 'kind inválido' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: r } = await supabase
      .from('training_requests')
      .select(`employee_id, ${column}`)
      .eq('id', id)
      .single();
    if (!r) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

    // Permiso: admin, o el dueño (empleado de la solicitud)
    const isOwner = auth.employee?.id === (r as any).employee_id;
    if (!auth.isAdmin && !isOwner) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

    const path = (r as any)[column] as string | null;
    if (!path) return NextResponse.json({ error: 'Sin archivo' }, { status: 404 });

    const { data: signed, error } = await supabase.storage
      .from('training-files')
      .createSignedUrl(path, 120);
    if (error || !signed) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 });

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
