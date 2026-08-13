import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { construirRrdd, type RrddApi } from '@/lib/payslipBreakdown';

export const dynamic = 'force-dynamic';

/**
 * Liquidaciones de sueldo para la App A&F (finance.pow-apps.com).
 *
 * Sólo lectura. El contrato lo fija A&F: si la forma de la respuesta no
 * coincide, rechaza la importación entera. Está escrito en app-adm:
 * docs/contrato-rrhh-liquidaciones.md (monotributo) y
 * docs/contrato-rrhh-recibos-rrdd.md (relación de dependencia).
 *
 * Autenticación por header `x-af-key` contra AF_INTEGRATION_KEY. A&F nunca ve
 * credenciales de esta base: el service key se usa acá adentro y del otro lado
 * sólo existe el secreto que abre la ruta.
 *
 * Las validaciones que A&F corre en cada fila:
 *   monotributo  Σ conceptos − adelanto_sueldo = total_a_facturar
 *   rel. dep.    remunerativo + no remunerativo = bruto
 *                bruto − descuentos            = neto
 *                bruto + contribuciones        = costo total empleador
 * con tolerancia de $0,01. Por eso los importes van como números y sin
 * redondear: el dato trae ruido de punto flotante y redondear acá rompería la
 * cuenta del otro lado.
 */

/** Subirlo si cambia la forma de la respuesta. A&F falla claro en vez de leer campos que ya no están. */
const CONTRACT_VERSION = 2;

/** PostgREST corta en 1000 filas. La carga histórica pide todo, así que se pagina. */
const PAGE_SIZE = 1000;

/** `.in()` con miles de ids arma una URL impracticable. */
const CHUNK_IDS = 500;

const COLUMNAS =
  'id, period_id, period_key, employee_id, sent_at, contract_type_snapshot,' +
  ' first_name, last_name, employee_email,' +
  ' sueldo, monotributo, reintegro_internet, reintegro_extraordinario,' +
  ' plus_vacacional, bonificacion_anual, aguinaldo, adelanto_sueldo, total_a_facturar';

type Row = Record<string, unknown>;
type Supabase = ReturnType<typeof getSupabaseServer>;

/** `numeric` puede llegar como string. El contrato pide números. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Lo único que `leerTodo` necesita del query builder de Supabase. */
type Consulta = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** Trae todas las páginas de una consulta ya filtrada. */
async function leerTodo(
  armar: (desde: number) => Consulta,
): Promise<{ filas: Row[]; error: string | null }> {
  const filas: Row[] = [];
  for (let desde = 0; ; desde += PAGE_SIZE) {
    const { data, error } = await armar(desde);
    if (error) return { filas, error: error.message };
    filas.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { filas, error: null };
}

/**
 * El desglose de los recibos de relación de dependencia, ya leído del PDF y
 * guardado por `payslipBreakdown`. Acá no se abre ningún archivo: hacerlo por
 * request serían decenas de PDFs por llamada.
 */
async function leerDesgloses(supabase: Supabase, ids: string[]): Promise<Map<string, unknown>> {
  const porSettlement = new Map<string, unknown>();
  for (let i = 0; i < ids.length; i += CHUNK_IDS) {
    const { data, error } = await supabase
      .from('payroll_payslips')
      .select('settlement_id, parsed')
      .in('settlement_id', ids.slice(i, i + CHUNK_IDS));
    if (error) {
      console.error('[af] error leyendo el desglose de recibos:', error.message);
      continue;
    }
    for (const fila of data ?? []) porSettlement.set(fila.settlement_id, fila.parsed);
  }
  return porSettlement;
}

export async function GET(req: NextRequest) {
  // Falla cerrado: sin secreto configurado, la ruta expone las liquidaciones de
  // toda la empresa a internet.
  const expected = process.env.AF_INTEGRATION_KEY?.trim();
  if (!expected) {
    console.error('[af] AF_INTEGRATION_KEY no está configurada: se rechaza la llamada.');
    return NextResponse.json({ error: 'Integración no configurada' }, { status: 503 });
  }
  if (req.headers.get('x-af-key') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sinceRaw = req.nextUrl.searchParams.get('since');
  let since: string | null = null;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: 'El parámetro since tiene que ser una fecha ISO 8601.' },
        { status: 400 },
      );
    }
    since = d.toISOString();
  }

  const supabase = getSupabaseServer();

  // Las enviadas, que son las que llevan importes. "Confirmado" en RRHH es que
  // se le mandó el detalle a la persona; el estado del período no sirve, están
  // casi todos en DRAFT.
  const enviadas = await leerTodo((desde) => {
    let q = supabase
      .from('payroll_settlements_with_details')
      .select(COLUMNAS)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);
    if (since) q = q.gt('sent_at', since);
    return q;
  });
  if (enviadas.error) {
    console.error('[af] error leyendo liquidaciones:', enviadas.error);
    return NextResponse.json({ error: 'No se pudieron leer las liquidaciones' }, { status: 500 });
  }

  // Las NO enviadas viajan sin un solo importe: sólo la identidad. Sin esto A&F
  // no puede distinguir "esta persona no existe en RRHH" de "existe pero su
  // liquidación todavía no se envió", y manda a buscar el problema al lugar
  // equivocado. No las filtra `since`: no tienen `sent_at` contra qué comparar,
  // y serían invisibles justo cuando importan.
  const sinEnviar = await leerTodo((desde) =>
    supabase
      .from('payroll_settlements_with_details')
      .select(COLUMNAS)
      .is('sent_at', null)
      .order('period_key', { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1),
  );
  if (sinEnviar.error) {
    console.error('[af] error leyendo liquidaciones sin enviar:', sinEnviar.error);
    return NextResponse.json({ error: 'No se pudieron leer las liquidaciones' }, { status: 500 });
  }

  const filas = [...enviadas.filas, ...sinEnviar.filas];

  const idsRrdd = filas
    .filter((r) => r.contract_type_snapshot === 'RELACION_DEPENDENCIA' && r.sent_at)
    .map((r) => r.id as string);
  const desgloses = idsRrdd.length ? await leerDesgloses(supabase, idsRrdd) : new Map();

  const settlements = filas.map((r) => {
    const enviada = Boolean(r.sent_at);
    const esMonotributo = r.contract_type_snapshot === 'MONOTRIBUTO';
    // Monotributo lleva los 7 conceptos; relación de dependencia los lleva en
    // null por contrato y su desglose viaja aparte, en `rrdd`. Una liquidación
    // sin enviar no lleva ningún importe, sea del tipo que sea.
    const concepto = (v: unknown) => (enviada && esMonotributo ? num(v) : null);

    let rrdd: RrddApi | null = null;
    if (enviada && !esMonotributo) {
      rrdd = construirRrdd(desgloses.get(r.id as string), r.period_key as string);
    }

    return {
      settlement_id: r.id,
      period_id: r.period_id,
      period_key: r.period_key,
      employee_id: r.employee_id,
      sent_at: r.sent_at ?? null,
      contract_type: r.contract_type_snapshot,

      // Sólo para que la pantalla de vinculación sugiera. El matching entre
      // apps es por employee_id, que es estable; los nombres difieren.
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      email: r.employee_email ?? null,

      sueldo: concepto(r.sueldo),
      monotributo: concepto(r.monotributo),
      reintegro_internet: concepto(r.reintegro_internet),
      reintegro_extraordinario: concepto(r.reintegro_extraordinario),
      plus_vacacional: concepto(r.plus_vacacional),
      bonificacion_anual: concepto(r.bonificacion_anual),
      aguinaldo: concepto(r.aguinaldo),

      adelanto_sueldo: concepto(r.adelanto_sueldo),
      total_a_facturar: concepto(r.total_a_facturar),

      // Sólo relación de dependencia enviada y con el recibo leído. null cuando
      // el PDF no se pudo leer: mejor que A&F lo reporte a que importe un número
      // inventado.
      rrdd,
    };
  });

  return NextResponse.json(
    {
      contract_version: CONTRACT_VERSION,
      generated_at: new Date().toISOString(),
      settlements,
    },
    // Es un dato que cambia al enviar una liquidación: que no lo cachee nadie
    // en el camino.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
