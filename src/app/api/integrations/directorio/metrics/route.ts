import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { leerTodo, PAGINA } from '@/lib/leerTodo';
import { isBusinessDay } from '@/lib/businessDays';
import { SICK_LEAVE_CODE } from '@/lib/leaveCertificates';
import {
  CONFIABLE_DESDE,
  calcularMetricasPersonas,
  mesesEntre,
  type FilaEmpleado,
  type FilaEnfermedad,
} from '@/lib/metricasDirectorio';

export const dynamic = 'force-dynamic';

/**
 * Métricas de personas para el Directorio (directorio.pow.la).
 *
 * GET /api/integrations/directorio/metrics?desde=YYYY-MM&hasta=YYYY-MM
 *
 * Sólo lectura y sólo números agregados por mes (dotación, altas, bajas,
 * antigüedad media de las bajas, ausentismo): ningún nombre, id ni monto
 * individual sale de esta ruta. Las cuentas están en lib/metricasDirectorio.ts.
 *
 * Autenticación por header `x-directorio-key` contra DIRECTORIO_INTEGRATION_KEY,
 * un secreto propio del Directorio (no el de A&F), así se rota o revoca por
 * separado. Si la variable falta, la ruta queda cerrada (503).
 */
const VERSION = 1;
const MES = /^\d{4}-\d{2}$/;

function autorizado(req: NextRequest, esperado: string): boolean {
  const recibido = Buffer.from(req.headers.get('x-directorio-key') ?? '');
  const clave = Buffer.from(esperado);
  return recibido.length === clave.length && timingSafeEqual(recibido, clave);
}

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Días hábiles en [desde, hasta] inclusive. Sin feriados, igual que el KPI de ausentismo. */
function diasHabiles(desde: string, hasta: string): number {
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  let n = 0;
  while (d <= fin) {
    if (isBusinessDay(d)) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

export async function GET(req: NextRequest) {
  const esperado = process.env.DIRECTORIO_INTEGRATION_KEY?.trim();
  if (!esperado) {
    console.error('[directorio] DIRECTORIO_INTEGRATION_KEY no está configurada: se rechaza la llamada.');
    return NextResponse.json({ error: 'Integración no configurada' }, { status: 503 });
  }
  if (!autorizado(req, esperado)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hoy = hoyEnArgentina();
  const sp = new URL(req.url).searchParams;
  const desde = sp.get('desde') ?? CONFIABLE_DESDE.dotacion;
  const hasta = sp.get('hasta') ?? hoy.slice(0, 7);
  if (!MES.test(desde) || !MES.test(hasta) || desde > hasta) {
    return NextResponse.json({ error: 'desde/hasta tienen que ser YYYY-MM y desde ≤ hasta' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const [emp, enf] = await Promise.all([
    leerTodo<FilaEmpleado>((d) =>
      supabase
        .from('employees')
        .select('hire_date, termination_date, termination_reason, employment_type')
        .order('id')
        .range(d, d + PAGINA - 1),
    ),
    leerTodo<FilaEnfermedad>((d) =>
      supabase
        .from('leave_requests_with_details')
        .select('employee_id, days_requested, start_date, status')
        .eq('leave_type_code', SICK_LEAVE_CODE)
        .gte('start_date', `${desde}-01`)
        .order('id')
        .range(d, d + PAGINA - 1),
    ),
  ]);
  const error = emp.error ?? enf.error;
  if (error) {
    console.error('[directorio] error leyendo la base:', error);
    return NextResponse.json({ error: 'No se pudieron leer los datos' }, { status: 500 });
  }

  const meses = calcularMetricasPersonas({
    empleados: emp.filas,
    enfermedad: enf.filas,
    meses: mesesEntre(desde, hasta),
    hoy,
    diasHabiles,
  });

  return NextResponse.json(
    { version: VERSION, generado: new Date().toISOString(), hoy, confiableDesde: CONFIABLE_DESDE, meses },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
