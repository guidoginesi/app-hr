// Métricas de personas para el Directorio (directorio.pow.la) — agregación
// pura, sin DB. La ruta /api/integrations/directorio/metrics trae las filas y
// esto solo cuenta. Nunca sale de acá un nombre, un id ni un monto individual.
//
// Definiciones (v1):
//  · DOTACIÓN de un mes = personas con hire_date ≤ fin de mes y sin baja antes
//    de esa fecha (termination_date vacía o posterior). Para el mes en curso,
//    el corte es hoy. Quien no tiene hire_date no entra en la dotación (son
//    legajos importados de entrevistas de salida, sin fecha de ingreso).
//  · ALTAS = hire_date dentro del mes. BAJAS = termination_date dentro del mes
//    y hasta hoy (las bajas programadas a futuro todavía no cuentan).
//  · Voluntaria = termination_reason 'resignation'; involuntaria = 'dismissal'.
//  · AUSENTISMO = días de licencia por enfermedad que arrancan en el mes /
//    (días hábiles del mes × dotación). Mismo criterio que sickKpi.ts.
//  · La dotación y las altas/bajas son confiables desde enero 2026 (carga
//    inicial del módulo de personas); antes faltan bajas. El ausentismo existe
//    desde agosto 2026. Van en `confiableDesde` para que el Directorio lo diga.

export type FilaEmpleado = {
  hire_date: string | null; // YYYY-MM-DD
  termination_date: string | null;
  termination_reason: 'resignation' | 'dismissal' | null;
  employment_type: 'monotributista' | 'dependency' | null;
};

export type FilaEnfermedad = {
  employee_id: string;
  days_requested: number;
  start_date: string;
  status: string;
};

export type MesPersonas = {
  mes: string; // YYYY-MM
  dotacion: number;
  dotacionMonotributo: number;
  dotacionDependencia: number;
  altas: number;
  bajas: number;
  bajasVoluntarias: number;
  bajasInvoluntarias: number;
  antiguedadMediaBajasMeses: number | null;
  diasEnfermedad: number;
  eventosEnfermedad: number;
  diasHabiles: number;
  tasaAusentismo: number | null; // %
};

export const CONFIABLE_DESDE = { dotacion: '2026-01', ausentismo: '2026-08' } as const;

const INVALIDOS = new Set(['cancelled', 'rejected', 'rejected_leader', 'rejected_hr']);

function finDeMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.split('-').map(Number);
  const [hy, hm] = hasta.split('-').map(Number);
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function mesesDeAntiguedad(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(0, meses);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function calcularMetricasPersonas(input: {
  empleados: FilaEmpleado[];
  enfermedad: FilaEnfermedad[];
  meses: string[];
  hoy: string; // YYYY-MM-DD
  diasHabiles: (desde: string, hasta: string) => number;
}): MesPersonas[] {
  const { empleados, hoy } = input;
  const enfermedadValida = input.enfermedad.filter((r) => !INVALIDOS.has(r.status));

  return input.meses
    .filter((mes) => `${mes}-01` <= hoy)
    .map((mes) => {
      const inicio = `${mes}-01`;
      const fin = finDeMes(mes) < hoy ? finDeMes(mes) : hoy;

      const activos = empleados.filter(
        (e) => e.hire_date !== null && e.hire_date <= fin && (e.termination_date === null || e.termination_date > fin),
      );
      const altas = empleados.filter((e) => e.hire_date !== null && e.hire_date >= inicio && e.hire_date <= fin);
      const bajas = empleados.filter(
        (e) => e.termination_date !== null && e.termination_date >= inicio && e.termination_date <= fin,
      );
      const conAntiguedad = bajas.filter((e) => e.hire_date !== null);

      const licencias = enfermedadValida.filter((r) => r.start_date >= inicio && r.start_date <= fin);
      const diasEnfermedad = licencias.reduce((a, r) => a + (Number(r.days_requested) || 0), 0);
      const diasHabiles = input.diasHabiles(inicio, fin);
      const midiendoAusentismo = mes >= CONFIABLE_DESDE.ausentismo;

      return {
        mes,
        dotacion: activos.length,
        dotacionMonotributo: activos.filter((e) => e.employment_type === 'monotributista').length,
        dotacionDependencia: activos.filter((e) => e.employment_type === 'dependency').length,
        altas: altas.length,
        bajas: bajas.length,
        bajasVoluntarias: bajas.filter((e) => e.termination_reason === 'resignation').length,
        bajasInvoluntarias: bajas.filter((e) => e.termination_reason === 'dismissal').length,
        antiguedadMediaBajasMeses: conAntiguedad.length
          ? r1(conAntiguedad.reduce((a, e) => a + mesesDeAntiguedad(e.hire_date!, e.termination_date!), 0) / conAntiguedad.length)
          : null,
        diasEnfermedad: r1(diasEnfermedad),
        eventosEnfermedad: licencias.length,
        diasHabiles,
        tasaAusentismo:
          midiendoAusentismo && diasHabiles && activos.length
            ? r1((diasEnfermedad / (diasHabiles * activos.length)) * 100)
            : null,
      };
    });
}

// ---------- Por equipo (área), desde las liquidaciones (marzo 2026) ----------
//
// Costo y sueldo en mano, en pesos, por mes y por área, separado por
// modalidad porque no se comparan: en relación de dependencia el costo es el
// «costo total empleador» del recibo y en mano el neto; en monotributo el
// costo es lo facturado (más el adelanto, que también lo paga la empresa) y en
// mano eso mismo menos los reintegros y el monotributo (que no son sueldo).
//
// Para no exponer sueldos individuales, un corte con menos de MINIMO personas
// no sale con su nombre: se suma en «Otras áreas». Si aun así queda chico, se
// suprime (va solo al total).

export const MINIMO = 3;

export type FilaLiquidacion = {
  mes: string; // YYYY-MM (período devengado)
  area: string;
  modalidad: 'monotributo' | 'dependencia';
  costo: number; // ARS
  enMano: number; // ARS
};

export type CorteCosto = { mes: string; area: string; modalidad: 'monotributo' | 'dependencia' | 'todas'; personas: number; costo: number; enMano: number };

export function agregarCostosPorArea(filas: FilaLiquidacion[]): { cortes: CorteCosto[]; totales: CorteCosto[] } {
  const clave = (f: { mes: string; area: string; modalidad: string }) => `${f.mes}|${f.area}|${f.modalidad}`;
  const acum = new Map<string, CorteCosto>();
  for (const f of filas) {
    const c = acum.get(clave(f)) ?? { mes: f.mes, area: f.area, modalidad: f.modalidad, personas: 0, costo: 0, enMano: 0 };
    c.personas += 1;
    c.costo += f.costo;
    c.enMano += f.enMano;
    acum.set(clave(f), c);
  }
  // Totales por mes: por modalidad (solo si tienen MINIMO personas) y de toda
  // la empresa (modalidad 'todas'). Con una sola persona en una modalidad, su
  // total sería su sueldo.
  const tot = new Map<string, CorteCosto>();
  const sumar = (k: string, base: Omit<CorteCosto, 'personas' | 'costo' | 'enMano'>, c: CorteCosto) => {
    const t = tot.get(k) ?? { ...base, personas: 0, costo: 0, enMano: 0 };
    t.personas += c.personas;
    t.costo += c.costo;
    t.enMano += c.enMano;
    tot.set(k, t);
  };
  for (const c of acum.values()) {
    sumar(`${c.mes}|${c.modalidad}`, { mes: c.mes, area: 'Total', modalidad: c.modalidad }, c);
    sumar(`${c.mes}|todas`, { mes: c.mes, area: 'Total', modalidad: 'todas' }, c);
  }
  // Cortes chicos van a «Otras áreas»; si «Otras áreas» también es chica, no sale.
  const grandes: CorteCosto[] = [];
  const otras = new Map<string, CorteCosto>();
  for (const c of acum.values()) {
    if (c.personas >= MINIMO) grandes.push(c);
    else {
      const k = `${c.mes}|${c.modalidad}`;
      const o = otras.get(k) ?? { mes: c.mes, area: 'Otras áreas', modalidad: c.modalidad, personas: 0, costo: 0, enMano: 0 };
      o.personas += c.personas;
      o.costo += c.costo;
      o.enMano += c.enMano;
      otras.set(k, o);
    }
  }
  const r = (c: CorteCosto) => ({ ...c, costo: Math.round(c.costo), enMano: Math.round(c.enMano) });
  return {
    cortes: [...grandes, ...[...otras.values()].filter((o) => o.personas >= MINIMO)].map(r),
    totales: [...tot.values()].filter((t) => t.personas >= MINIMO).map(r),
  };
}

// ---------- Dotación, rotación y antigüedad por área y por seniority (hoy) ----------

export type FilaPersona = FilaEmpleado & { area: string; seniority: string | null };

const NIVELES: Record<string, string> = { '1': 'Junior', '2': 'Semi senior', '3': 'Senior', '4': 'Líder', '5': 'C-Level' };
export const nivelDe = (seniority: string | null) => (seniority ? NIVELES[seniority.trim().charAt(0)] ?? 'Sin dato' : 'Sin dato');

export function personasPorCorte(personas: FilaPersona[], hoy: string, desde12: string) {
  const activos = personas.filter((p) => p.hire_date && p.hire_date <= hoy && (!p.termination_date || p.termination_date > hoy));
  const antiguedad = (p: FilaPersona) => mesesDeAntiguedad(p.hire_date!, hoy);
  const corte = (clave: (p: FilaPersona) => string) => {
    const m = new Map<string, { nombre: string; dotacion: number; antiguedadMediaMeses: number; bajas12: number }>();
    for (const p of activos) {
      const k = clave(p);
      const c = m.get(k) ?? { nombre: k, dotacion: 0, antiguedadMediaMeses: 0, bajas12: 0 };
      c.dotacion += 1;
      c.antiguedadMediaMeses += antiguedad(p);
      m.set(k, c);
    }
    for (const p of personas) {
      if (p.termination_date && p.termination_date >= desde12 && p.termination_date <= hoy) {
        const k = clave(p);
        const c = m.get(k) ?? { nombre: k, dotacion: 0, antiguedadMediaMeses: 0, bajas12: 0 };
        c.bajas12 += 1;
        m.set(k, c);
      }
    }
    return [...m.values()]
      .map((c) => ({ ...c, antiguedadMediaMeses: c.dotacion ? r1(c.antiguedadMediaMeses / c.dotacion) : 0 }))
      .sort((a, b) => b.dotacion - a.dotacion);
  };
  return { porArea: corte((p) => p.area), porSeniority: corte((p) => nivelDe(p.seniority)) };
}

// ---------- Otros: vacaciones adeudadas, búsquedas y desempeño ----------

export function medianaDias(valores: number[]): number | null {
  if (!valores.length) return null;
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
