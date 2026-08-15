import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { audienciaSugerida } from '@/lib/manual/audienciaSugerida';

export const dynamic = 'force-dynamic';

/**
 * Revisión de audiencia del Manual RRHH.
 *
 * Cada sección arranca en SIN_DEFINIR y no se le puede citar a nadie hasta que
 * alguien la habilite acá. Es la única cosa que separa "el agente cita el
 * manual" de "el agente le manda a un colaborador la estructura de sueldos".
 */

const AUDIENCIAS = ['EMPLEADO', 'SOLO_HR', 'SIN_DEFINIR'] as const;

const BodySchema = z.object({
  slugs: z.array(z.string().min(1)).min(1).max(500),
  audiencia: z.enum(AUDIENCIAS),
});

export async function GET() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('manual_sections')
    .select('slug, ruta, titulo, nivel, orden, anchor, audiencia, audiencia_sugerida, audiencia_definida_at, actualizado_at, vigente, texto')
    .order('orden');
  if (error) {
    console.error('[manual] error leyendo secciones:', error.message);
    return NextResponse.json({ error: 'No se pudieron leer las secciones' }, { status: 500 });
  }

  const { data: ultimaImportacion } = await supabase
    .from('manual_imports')
    .select('origen, recibidas, nuevas, modificadas, sin_cambios, jubiladas, creado_at')
    .order('creado_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const secciones = (data ?? []).map((s) => {
    const ruta = (s.ruta ?? []) as string[];
    const sugerida = audienciaSugerida(ruta);
    return {
      slug: s.slug,
      ruta,
      titulo: s.titulo,
      nivel: s.nivel,
      anchor: s.anchor,
      audiencia: s.audiencia,
      audiencia_sugerida: s.audiencia_sugerida,
      // El porqué de la propuesta viaja para que la decisión se pueda discutir
      // en la pantalla, no haya que abrir el código para entenderla.
      porque: sugerida?.porque ?? null,
      vigente: s.vigente,
      // El tamaño ubica: una sección de 20 mil caracteres pesa distinto que una
      // de 200 a la hora de decidir si se puede citar.
      caracteres: (s.texto as string).length,
      // Si el texto cambió después de que alguien la revisó, la revisión quedó
      // vieja aunque la audiencia siga marcada.
      revision_vencida: Boolean(
        s.audiencia_definida_at && s.actualizado_at > s.audiencia_definida_at,
      ),
    };
  });

  return NextResponse.json({ secciones, ultima_importacion: ultimaImportacion ?? null });
}

export async function PATCH(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { slugs, audiencia } = parsed.data;

  const { error } = await supabase
    .from('manual_sections')
    .update({
      audiencia,
      // Volver a SIN_DEFINIR es des-revisar: no deja rastro de revisión, porque
      // no la hubo.
      audiencia_definida_por: audiencia === 'SIN_DEFINIR' ? null : user.id,
      audiencia_definida_at: audiencia === 'SIN_DEFINIR' ? null : new Date().toISOString(),
    })
    .in('slug', slugs);

  if (error) {
    console.error('[manual] error guardando audiencia:', error.message);
    return NextResponse.json({ error: 'No se pudo guardar el cambio' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, actualizadas: slugs.length });
}
