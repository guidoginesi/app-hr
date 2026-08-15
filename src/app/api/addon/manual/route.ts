import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { importarManual } from '@/lib/manual/ingest';

export const dynamic = 'force-dynamic';

/**
 * Ingesta del Manual RRHH desde el Google Doc.
 *
 * La empuja un Apps Script pegado al documento (ver `google-addon/manual.gs`),
 * autenticado con el mismo `ADDON_SECRET` que el add-on de salas. Se hace así y
 * no leyendo el Doc desde la app para no montar una service account de Google ni
 * tener que publicar el documento: el manual tiene el procedimiento de despido y
 * las bandas salariales adentro.
 *
 * El Apps Script lee la estructura real de encabezados del documento, así que
 * acá llegan secciones ya separadas y no hay que adivinarlas con regex.
 */

const SeccionSchema = z.object({
  ruta: z.array(z.string().min(1)).min(1).max(6),
  titulo: z.string().min(1),
  nivel: z.number().int().min(1).max(6),
  orden: z.number().int().min(0),
  texto: z.string(),
  anchor: z.string().nullable().optional(),
});

const BodySchema = z.object({
  // Un manual vacío casi siempre es un Apps Script roto, no un manual que se
  // vació. Si pasara de verdad, jubilaría las 165 secciones de una.
  secciones: z.array(SeccionSchema).min(1).max(2000),
  origen: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const esperada = process.env.ADDON_SECRET?.trim();
  if (!esperada) {
    console.error('[manual] ADDON_SECRET no está configurada: se rechaza la ingesta.');
    return NextResponse.json({ error: 'Integración no configurada' }, { status: 503 });
  }
  if (req.headers.get('x-addon-key') !== esperada) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  try {
    const resultado = await importarManual(parsed.data.secciones, parsed.data.origen ?? 'apps-script');
    return NextResponse.json({
      ok: true,
      recibidas: resultado.recibidas,
      nuevas: resultado.nuevas.length,
      modificadas: resultado.modificadas.length,
      sin_cambios: resultado.sinCambios,
      jubiladas: resultado.jubiladas.length,
      sin_revisar: resultado.sinRevisar,
    });
  } catch (error) {
    console.error('[manual] error importando:', error);
    return NextResponse.json({ error: 'No se pudo importar el manual' }, { status: 500 });
  }
}
