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
