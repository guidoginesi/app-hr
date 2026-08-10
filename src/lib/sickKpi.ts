// KPI de ausentismo por enfermedad — agregación pura, sin DB.
//
// Se separa de la ruta a propósito: la fórmula de la tasa y qué cuenta como
// evento son las decisiones que Guido tiene que poder revisar, y acá quedan en
// un solo lugar testeable.
//
// Definiciones (v1, documentadas para poder ajustarlas):
//  · Un EVENTO es una licencia por enfermedad válida (no cancelada) cuya fecha
//    de INICIO cae en el período. Se atribuye por inicio, igual que el resto del
//    módulo; una licencia a caballo de dos meses cuenta en el mes en que arrancó.
//  · DÍAS = suma de days_requested (ya vienen en días hábiles).
//  · TASA = días de enfermedad / (días hábiles del período × dotación activa).
//    Sin calendario de feriados todavía, un feriado cuenta como hábil.
//  · No hay histórico previo: la serie arranca cuando se implementó el tipo.

const INVALID_STATUSES = new Set(['cancelled', 'rejected', 'rejected_leader', 'rejected_hr']);

export type SickLeaveRow = {
  employee_id: string;
  days_requested: number;
  start_date: string; // YYYY-MM-DD
  status: string;
};

export type KpiEmployee = {
  id: string;
  name: string;
  area: string; // 'Sin área' si no tiene
  modalidad: 'monotributista' | 'dependency' | null;
  hire_date: string | null;
};

export type SickKpiResult = {
  headcount: number;
  totalDias: number;
  totalEventos: number;
  duracionMedia: number; // días por evento
  personasConEvento: number;
  pctPersonasConEvento: number;
  tasaAusentismo: number; // %
  businessDaysInPeriod: number;
  porMes: { month: number; dias: number; eventos: number }[];
  porArea: { area: string; personas: number; eventos: number; dias: number }[];
  ranking: {
    employee_id: string;
    name: string;
    area: string;
    modalidad: 'monotributista' | 'dependency' | null;
    antiguedadMeses: number | null;
    eventos: number;
    dias: number;
  }[];
};

function monthsSince(hireDate: string | null, today: string): number | null {
  if (!hireDate) return null;
  const [hy, hm, hd] = hireDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!hy || !ty) return null;
  let months = (ty - hy) * 12 + (tm - hm);
  if (td < hd) months -= 1;
  return Math.max(0, months);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * `rows` y `employees` ya vienen filtrados por el período y los cortes (área,
 * modalidad) que aplicó la ruta. La lib no vuelve a filtrar: sólo agrega.
 */
export function computeSickKpi(input: {
  rows: SickLeaveRow[];
  employees: KpiEmployee[];
  businessDaysInPeriod: number;
  today: string;
}): SickKpiResult {
  const empById = new Map(input.employees.map((e) => [e.id, e]));
  // Sólo cuentan las filas de personas dentro del corte y con estado válido.
  const valid = input.rows.filter((r) => empById.has(r.employee_id) && !INVALID_STATUSES.has(r.status));

  const headcount = input.employees.length;
  const totalEventos = valid.length;
  const totalDias = valid.reduce((acc, r) => acc + Number(r.days_requested || 0), 0);
  const duracionMedia = totalEventos > 0 ? round1(totalDias / totalEventos) : 0;

  const personasSet = new Set(valid.map((r) => r.employee_id));
  const personasConEvento = personasSet.size;
  const pctPersonasConEvento = headcount > 0 ? round1((personasConEvento / headcount) * 100) : 0;

  const disponibles = input.businessDaysInPeriod * headcount;
  const tasaAusentismo = disponibles > 0 ? round1((totalDias / disponibles) * 100) : 0;

  // Estacionalidad: 12 meses siempre presentes, para que el gráfico no tenga huecos.
  const porMes = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, dias: 0, eventos: 0 }));
  for (const r of valid) {
    const m = Number(r.start_date.slice(5, 7));
    if (m >= 1 && m <= 12) {
      porMes[m - 1].dias += Number(r.days_requested || 0);
      porMes[m - 1].eventos += 1;
    }
  }

  const areaAcc = new Map<string, { personas: Set<string>; eventos: number; dias: number }>();
  const rankAcc = new Map<string, { eventos: number; dias: number }>();
  for (const r of valid) {
    const emp = empById.get(r.employee_id)!;
    const a = areaAcc.get(emp.area) ?? { personas: new Set<string>(), eventos: 0, dias: 0 };
    a.personas.add(emp.id);
    a.eventos += 1;
    a.dias += Number(r.days_requested || 0);
    areaAcc.set(emp.area, a);

    const rk = rankAcc.get(emp.id) ?? { eventos: 0, dias: 0 };
    rk.eventos += 1;
    rk.dias += Number(r.days_requested || 0);
    rankAcc.set(emp.id, rk);
  }

  const porArea = Array.from(areaAcc.entries())
    .map(([area, v]) => ({ area, personas: v.personas.size, eventos: v.eventos, dias: v.dias }))
    .sort((x, y) => y.dias - x.dias);

  const ranking = Array.from(rankAcc.entries())
    .map(([employee_id, v]) => {
      const emp = empById.get(employee_id)!;
      return {
        employee_id,
        name: emp.name,
        area: emp.area,
        modalidad: emp.modalidad,
        antiguedadMeses: monthsSince(emp.hire_date, input.today),
        eventos: v.eventos,
        dias: v.dias,
      };
    })
    // Más días primero; a igualdad, más eventos. Es el "quiénes se enferman más".
    .sort((x, y) => y.dias - x.dias || y.eventos - x.eventos);

  return {
    headcount,
    totalDias,
    totalEventos,
    duracionMedia,
    personasConEvento,
    pctPersonasConEvento,
    tasaAusentismo,
    businessDaysInPeriod: input.businessDaysInPeriod,
    porMes,
    porArea,
    ranking,
  };
}
