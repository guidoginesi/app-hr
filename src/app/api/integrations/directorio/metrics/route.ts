import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { leerTodo, PAGINA } from '@/lib/leerTodo';
import { isBusinessDay } from '@/lib/businessDays';
import { SICK_LEAVE_CODE } from '@/lib/leaveCertificates';
import { construirRrdd } from '@/lib/payslipBreakdown';
import {
  CONFIABLE_DESDE,
  MINIMO,
  agregarCostosPorArea,
  calcularMetricasPersonas,
  medianaDias,
  mesesEntre,
  personasPorCorte,
  type FilaEmpleado,
  type FilaEnfermedad,
  type FilaLiquidacion,
  type FilaPersona,
} from '@/lib/metricasDirectorio';

export const dynamic = 'force-dynamic';

/**
 * Métricas de personas para el Directorio (directorio.pow.la).
 *
 * GET /api/integrations/directorio/metrics?desde=YYYY-MM&hasta=YYYY-MM
 *
 * Sólo lectura y sólo números agregados: por mes (dotación, altas, bajas,
 * antigüedad media de las bajas, ausentismo), por área y seniority (dotación,
 * antigüedad, bajas), costo y sueldo en mano por área desde las liquidaciones
 * (cortes de menos de 3 personas van a «Otras áreas» o no salen), vacaciones
 * adeudadas, búsquedas cubiertas y desempeño. Ningún nombre, id ni monto
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
  const [emp, enf, deps, liq, tipos, jobs, contratados, evals, periodos] = await Promise.all([
    leerTodo<FilaEmpleado & { id: string; department_id: string | null; seniority_level: string | null }>((d) =>
      supabase
        .from('employees')
        .select('id, hire_date, termination_date, termination_reason, employment_type, department_id, seniority_level')
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
    leerTodo<{ id: string; name: string }>((d) => supabase.from('departments').select('id, name').order('id').range(d, d + PAGINA - 1)),
    leerTodo<Record<string, unknown>>((d) =>
      supabase
        .from('payroll_settlements_with_details')
        .select(
          'id, period_key, employee_id, contract_type_snapshot, total_a_facturar, adelanto_sueldo, monotributo, reintegro_internet, reintegro_extraordinario',
        )
        .not('sent_at', 'is', null)
        .gte('period_key', desde)
        .order('id')
        .range(d, d + PAGINA - 1),
    ),
    leerTodo<{ id: string; code: string }>((d) => supabase.from('leave_types').select('id, code').order('id').range(d, d + PAGINA - 1)),
    leerTodo<{ id: string; created_at: string }>((d) => supabase.from('jobs').select('id, created_at').order('id').range(d, d + PAGINA - 1)),
    leerTodo<{ id: string; job_id: string }>((d) =>
      supabase.from('applications').select('id, job_id').eq('final_outcome', 'HIRED').order('id').range(d, d + PAGINA - 1),
    ),
    leerTodo<{ period_id: string; total_score: number | null }>((d) =>
      supabase
        .from('evaluations')
        .select('period_id, total_score')
        .eq('type', 'leader')
        .eq('status', 'submitted')
        .order('id')
        .range(d, d + PAGINA - 1),
    ),
    leerTodo<{ id: string; name: string; year: number }>((d) =>
      supabase.from('evaluation_periods').select('id, name, year').order('id').range(d, d + PAGINA - 1),
    ),
  ]);
  const error = [emp, enf, deps, liq, tipos, jobs, contratados, evals, periodos].find((r) => r.error)?.error;
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

  // Área y seniority de cada persona (los valores de hoy: app-hr no guarda la historia).
  const nombreArea = new Map(deps.filas.map((d) => [d.id, d.name]));
  const areaDe = new Map(emp.filas.map((e) => [e.id, (e.department_id && nombreArea.get(e.department_id)) || 'Sin área']));
  const personas: (FilaPersona & { id: string })[] = emp.filas.map((e) => ({
    ...e,
    area: areaDe.get(e.id)!,
    seniority: e.seniority_level,
  }));
  const [hy, hm, hd] = hoy.split('-');
  const cortes = personasPorCorte(personas, hoy, `${Number(hy) - 1}-${hm}-${hd}`);

  // Costo y sueldo en mano por área, desde las liquidaciones enviadas.
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  const idsRrdd = liq.filas.filter((r) => r.contract_type_snapshot !== 'MONOTRIBUTO').map((r) => r.id as string);
  const recibos = new Map<string, unknown>();
  for (let i = 0; i < idsRrdd.length; i += 500) {
    const { data, error: e } = await supabase
      .from('payroll_payslips')
      .select('settlement_id, parsed')
      .in('settlement_id', idsRrdd.slice(i, i + 500));
    if (e) {
      console.error('[directorio] error leyendo recibos:', e.message);
      continue;
    }
    for (const f of data ?? []) recibos.set(f.settlement_id as string, f.parsed);
  }
  const filasLiq: FilaLiquidacion[] = [];
  let recibosSinLeer = 0;
  for (const r of liq.filas) {
    const area = areaDe.get(r.employee_id as string) ?? 'Sin área';
    const mes = String(r.period_key).slice(0, 7);
    if (r.contract_type_snapshot === 'MONOTRIBUTO') {
      const facturado = n(r.total_a_facturar) + n(r.adelanto_sueldo);
      filasLiq.push({
        mes,
        area,
        modalidad: 'monotributo',
        costo: facturado,
        enMano: facturado - n(r.monotributo) - n(r.reintegro_internet) - n(r.reintegro_extraordinario),
      });
    } else {
      const rrdd = construirRrdd(recibos.get(r.id as string), String(r.period_key));
      if (!rrdd) {
        recibosSinLeer++;
        continue;
      }
      filasLiq.push({
        mes,
        area,
        modalidad: 'dependencia',
        costo: rrdd.recibos.reduce((a, x) => a + (x.costo_total_empleador ?? 0), 0),
        enMano: rrdd.recibos.reduce((a, x) => a + (x.sueldo_neto ?? 0), 0),
      });
    }
  }
  const costos = agregarCostosPorArea(filasLiq);

  // Vacaciones adeudadas hoy (días): lo que corresponde + lo arrastrado − lo usado − lo pedido.
  const vacacion = tipos.filas.find((t) => t.code === 'vacation');
  let vacaciones: { anio: number; personas: number; dias: number } | null = null;
  if (vacacion) {
    const anio = Number(hy);
    const activos = new Set(
      personas.filter((p) => p.hire_date && (!p.termination_date || p.termination_date > hoy)).map((p) => p.id),
    );
    const { data } = await supabase
      .from('leave_balances')
      .select('employee_id, entitled_days, used_days, pending_days, carried_over')
      .eq('leave_type_id', vacacion.id)
      .eq('year', anio);
    const saldos = (data ?? []).filter((b) => activos.has(b.employee_id as string));
    vacaciones = {
      anio,
      personas: saldos.length,
      dias:
        Math.round(
          saldos.reduce((a, b) => a + n(b.entitled_days) + n(b.carried_over) - n(b.used_days) - n(b.pending_days), 0) * 10,
        ) / 10,
    };
  }

  // Búsquedas cubiertas: días entre que se publicó la búsqueda y el último
  // movimiento del candidato contratado.
  const creadaDe = new Map(jobs.filas.map((j) => [j.id, j.created_at]));
  const cubiertas: { trimestre: string; dias: number }[] = [];
  if (contratados.filas.length) {
    const { data } = await supabase
      .from('stage_history')
      .select('application_id, changed_at')
      .in(
        'application_id',
        contratados.filas.map((a) => a.id).slice(0, 500),
      );
    const ultimo = new Map<string, string>();
    for (const h of data ?? []) {
      const k = h.application_id as string;
      if (!ultimo.has(k) || (h.changed_at as string) > ultimo.get(k)!) ultimo.set(k, h.changed_at as string);
    }
    for (const a of contratados.filas) {
      const fin = ultimo.get(a.id);
      const inicio = creadaDe.get(a.job_id);
      if (!fin || !inicio) continue;
      const dias = (new Date(fin).getTime() - new Date(inicio).getTime()) / 86_400_000;
      const d = new Date(fin);
      if (dias >= 0) cubiertas.push({ trimestre: `${d.getUTCFullYear()}-T${Math.floor(d.getUTCMonth() / 3) + 1}`, dias });
    }
  }
  const porTrimestre = new Map<string, number[]>();
  for (const c of cubiertas) porTrimestre.set(c.trimestre, [...(porTrimestre.get(c.trimestre) ?? []), c.dias]);
  const busquedas = Array.from(porTrimestre)
    .map(([trimestre, dias]) => ({ trimestre, cubiertas: dias.length, medianaDias: Math.round(medianaDias(dias)!) }))
    .sort((a, b) => a.trimestre.localeCompare(b.trimestre));

  // Desempeño: promedio de las evaluaciones de líder enviadas, por período
  // (solo períodos con al menos MINIMO evaluaciones).
  const porPeriodo = new Map<string, number[]>();
  for (const e of evals.filas) {
    if (e.total_score !== null) porPeriodo.set(e.period_id, [...(porPeriodo.get(e.period_id) ?? []), Number(e.total_score)]);
  }
  const desempeno = periodos.filas
    .filter((p) => (porPeriodo.get(p.id)?.length ?? 0) >= MINIMO)
    .map((p) => {
      const v = porPeriodo.get(p.id)!;
      return {
        periodo: p.name,
        anio: p.year,
        evaluaciones: v.length,
        promedio: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100,
      };
    })
    .sort((a, b) => a.anio - b.anio || a.periodo.localeCompare(b.periodo));

  return NextResponse.json(
    {
      version: VERSION,
      generado: new Date().toISOString(),
      hoy,
      confiableDesde: CONFIABLE_DESDE,
      meses,
      porArea: cortes.porArea,
      porSeniority: cortes.porSeniority,
      costos: { minimoPersonas: MINIMO, cortes: costos.cortes, totales: costos.totales, recibosSinLeer },
      vacaciones,
      busquedas,
      desempeno,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
