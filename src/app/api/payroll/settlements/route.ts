import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Liquidaciones de sueldo para la App A&F (finance.pow-apps.com).
 *
 * Sólo lectura. El contrato lo fija A&F: si la forma de la respuesta no
 * coincide, rechaza la importación entera. Está escrito en app-adm,
 * docs/contrato-rrhh-liquidaciones.md.
 *
 * Autenticación por header `x-af-key` contra AF_INTEGRATION_KEY. A&F nunca ve
 * credenciales de esta base: el service key se usa acá adentro y del otro lado
 * sólo existe el secreto que abre la ruta.
 *
 * La validación que A&F corre en cada fila es
 *   Σ conceptos − adelanto_sueldo = total_a_facturar
 * con tolerancia de $0,01. Por eso los conceptos van como números y sin
 * redondear: el dato trae ruido de punto flotante y redondear acá rompería la
 * cuenta del otro lado.
 */

/** Subirlo si cambia la forma de la respuesta. A&F falla claro en vez de leer campos que ya no están. */
const CONTRACT_VERSION = 1;

/** PostgREST corta en 1000 filas. La carga histórica pide todo, así que se pagina. */
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;

/** `numeric` puede llegar como string. El contrato pide números. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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
  const filas: Row[] = [];

  for (let desde = 0; ; desde += PAGE_SIZE) {
    let q = supabase
      .from('payroll_settlements_with_details')
      .select(
        'id, period_id, period_key, employee_id, sent_at, contract_type_snapshot,' +
          ' first_name, last_name, employee_email,' +
          ' sueldo, monotributo, reintegro_internet, reintegro_extraordinario,' +
          ' plus_vacacional, bonificacion_anual, aguinaldo, adelanto_sueldo, total_a_facturar',
      )
      // Sólo las enviadas. "Confirmado" en RRHH es que se le mandó el detalle a
      // la persona; el estado del período no sirve, están casi todos en DRAFT.
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);

    if (since) q = q.gt('sent_at', since);

    const { data, error } = await q;
    if (error) {
      console.error('[af] error leyendo liquidaciones:', error.message);
      return NextResponse.json({ error: 'No se pudieron leer las liquidaciones' }, { status: 500 });
    }

    filas.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const settlements = filas.map((r) => {
    // Relación de dependencia va con los conceptos en null: su sueldo no está
    // en el desglose estructurado, vive dentro del PDF del recibo. A&F las
    // cuenta como fuera de alcance en vez de mostrar un empleado faltante.
    const esMonotributo = r.contract_type_snapshot === 'MONOTRIBUTO';
    const concepto = (v: unknown) => (esMonotributo ? num(v) : null);

    return {
      settlement_id: r.id,
      period_id: r.period_id,
      period_key: r.period_key,
      employee_id: r.employee_id,
      sent_at: r.sent_at,
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
