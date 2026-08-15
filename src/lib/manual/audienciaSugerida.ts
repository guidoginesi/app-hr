/**
 * Propuesta de qué secciones del Manual RRHH se le pueden citar a un
 * colaborador y cuáles se quedan adentro de HR.
 *
 * Es una PROPUESTA: la decisión la confirma People en el panel. Lo que hay acá
 * es el criterio con el que la armé, para que se pueda discutir sección por
 * sección en vez de tener que confiar.
 *
 * El criterio, en una línea: se cita lo que le da derechos o instrucciones al
 * colaborador; se guarda lo que describe cómo HR decide sobre él.
 *
 * Por eso "Voluntaria (renuncia)" es del colaborador (necesita saber cómo
 * renunciar) y "Involuntaria (despido)" no lo es (es el procedimiento interno
 * de una decisión que lo tiene de objeto). Por eso el Protocolo de Violencia
 * Laboral es del colaborador aunque incomode: un protocolo que la gente no
 * puede leer no protege a nadie.
 *
 * Las reglas se evalúan de la más específica a la más general. Lo que no matchea
 * queda SIN_DEFINIR y no se cita: falla cerrado.
 */

export type Audiencia = 'EMPLEADO' | 'SOLO_HR';

interface Regla {
  /** Prefijo de la ruta de títulos. Matchea si la sección está adentro. */
  prefijo: string[];
  audiencia: Audiencia;
  porque: string;
}

/**
 * Ordenadas de específica a general: la primera que matchea gana, así que las
 * excepciones van arriba de la regla del grupo que rompen.
 */
export const REGLAS: Regla[] = [
  // ── Excepciones dentro de grupos internos ────────────────────────────────
  {
    prefijo: ['Bajas de Personal', 'Voluntaria (renuncia)'],
    audiencia: 'EMPLEADO',
    porque: 'Cómo renunciar es información que el colaborador necesita y puede pedir.',
  },
  {
    prefijo: ['Onboarding', 'Período de Prueba'],
    audiencia: 'EMPLEADO',
    porque: 'El período de prueba es un derecho legal (art. 92 bis LCT), no un procedimiento interno.',
  },

  // ── Lo que no sale de HR ─────────────────────────────────────────────────
  {
    prefijo: ['Bajas de Personal'],
    audiencia: 'SOLO_HR',
    porque: 'El procedimiento de despido es la parte más larga del manual y la que peor caería citada en una respuesta.',
  },
  {
    prefijo: ['Sanciones Disciplinarias'],
    audiencia: 'SOLO_HR',
    porque: 'Describe cómo se sanciona, no qué puede hacer el colaborador.',
  },
  {
    prefijo: ['Estándares de compensación'],
    audiencia: 'SOLO_HR',
    porque: 'Bandas salariales y estructura de niveles.',
  },
  {
    prefijo: ['Desarrollo y Promociones'],
    audiencia: 'SOLO_HR',
    porque: 'Incluye la estructura de salarios.',
  },
  {
    prefijo: ['Incrementos de Sueldo'],
    audiencia: 'SOLO_HR',
    porque: 'Cómo se deciden los aumentos. Discutible: si Pow lo comunica abierto, pásenlo a EMPLEADO.',
  },
  {
    prefijo: ['Bono anual por performance'],
    audiencia: 'SOLO_HR',
    porque: 'Pesos por seniority y cálculo del pago. Discutible: es plata del colaborador, pero expone la estructura.',
  },
  {
    prefijo: ['Presupuesto de RRHH (Budget)'],
    audiencia: 'SOLO_HR',
    porque: 'Presupuesto interno.',
  },
  {
    prefijo: ['Planeamiento y Control de Gestión de RRHH'],
    audiencia: 'SOLO_HR',
    porque: 'Gestión interna del área.',
  },
  {
    prefijo: ['Reclutamiento y Selección'],
    audiencia: 'SOLO_HR',
    porque: 'Proceso de selección: incluye cómo se evalúa a los candidatos.',
  },
  { prefijo: ['Requisición de Personal'], audiencia: 'SOLO_HR', porque: 'Proceso interno de pedido de vacantes.' },
  { prefijo: ['Búsqueda de Candidatos'], audiencia: 'SOLO_HR', porque: 'Proceso interno de reclutamiento.' },
  { prefijo: ['Gestión de candidatos'], audiencia: 'SOLO_HR', porque: 'Entrevistas, pruebas y referencias: criterios de evaluación.' },
  {
    prefijo: ['Incorporación de Personal'],
    audiencia: 'SOLO_HR',
    porque: 'Checklist interno de alta (preocupacional, psicotécnico, legajo). Lo que el ingresante necesita está en Onboarding.',
  },
  {
    prefijo: ['Onboarding'],
    audiencia: 'SOLO_HR',
    porque: 'Checklist de HR para dar la inducción, salvo el período de prueba.',
  },
  {
    prefijo: ['Gestion de documentos'],
    audiencia: 'SOLO_HR',
    porque: 'Procedimiento interno de firma de documentos confidenciales.',
  },

  // ── Lo que sí se cita ────────────────────────────────────────────────────
  { prefijo: ['Licencias'], audiencia: 'EMPLEADO', porque: 'Derechos y cómo se piden.' },
  { prefijo: ['Feriados y Días No Laborales'], audiencia: 'EMPLEADO', porque: 'Calendario que aplica a todos.' },
  { prefijo: ['SAC'], audiencia: 'EMPLEADO', porque: 'Cómo se calcula y cuándo se cobra el aguinaldo.' },
  { prefijo: ['ART'], audiencia: 'EMPLEADO', porque: 'Qué hacer ante un accidente: tiene que poder leerlo cualquiera.' },
  { prefijo: ['Anticipo sueldos'], audiencia: 'EMPLEADO', porque: 'Beneficio que se solicita.' },
  { prefijo: ['Política de Adelanto de Sueldos'], audiencia: 'EMPLEADO', porque: 'Condiciones del adelanto.' },
  {
    prefijo: ['Protocolo de Prevención y Abordaje de la Violenci…'],
    audiencia: 'EMPLEADO',
    porque: 'Un protocolo de violencia laboral que la gente no puede leer no protege a nadie. Incluye el formulario de denuncia.',
  },
  { prefijo: ['Emisión de Certificados y Constancias (Personal A…'], audiencia: 'EMPLEADO', porque: 'Cómo pedir un certificado.' },
  { prefijo: ['Actualización de Datos Personales'], audiencia: 'EMPLEADO', porque: 'Trámite del colaborador.' },
  { prefijo: ['Aviso de Trabajo Remoto Fuera del Domicilio Habit…'], audiencia: 'EMPLEADO', porque: 'Obligación que tiene que cumplir el colaborador.' },
  { prefijo: ['Politica home office'], audiencia: 'EMPLEADO', porque: 'Modalidad híbrida y convivencia.' },
  { prefijo: ['Capacitación y desarrollo'], audiencia: 'EMPLEADO', porque: 'Oferta de formación.' },
  { prefijo: ['Capacitación de Personal'], audiencia: 'EMPLEADO', porque: 'Plan de carrera y formación.' },
  { prefijo: ['Evaluación de Desempeño'], audiencia: 'EMPLEADO', porque: 'Su propia evaluación.' },
  { prefijo: ['❗Evaluación de Desempeño'], audiencia: 'EMPLEADO', porque: 'Su propia evaluación.' },
  { prefijo: ['Liquidación de Sueldos'], audiencia: 'EMPLEADO', porque: 'Cómo y cuándo se cobra.' },
  { prefijo: ['Compensaciones y Beneficios'], audiencia: 'EMPLEADO', porque: 'Índice de beneficios.' },
  { prefijo: ['Beneficios'], audiencia: 'EMPLEADO', porque: 'Beneficios vigentes.' },
  { prefijo: ['Días Pow'], audiencia: 'EMPLEADO', porque: 'Beneficio.' },
  { prefijo: ['Día de cumpleaños'], audiencia: 'EMPLEADO', porque: 'Beneficio.' },
  { prefijo: ['Work From Anywhere - Semanas Home'], audiencia: 'EMPLEADO', porque: 'Beneficio.' },
  { prefijo: ['Fondo de Capacitación'], audiencia: 'EMPLEADO', porque: 'Beneficio.' },
  { prefijo: ['Licencia extendida maternidad/paternidad'], audiencia: 'EMPLEADO', porque: 'Derecho y reintegro de gastos de cuidado.' },
  { prefijo: ['Reintegro de internet'], audiencia: 'EMPLEADO', porque: 'Beneficio.' },
  { prefijo: ['Oficina Pet Friendly'], audiencia: 'EMPLEADO', porque: 'Convivencia en la oficina.' },
  { prefijo: ['Política de Entrega, Uso, Reparación y Recambio d…'], audiencia: 'EMPLEADO', porque: 'Uso y cuidado del equipo que se le entrega.' },
  { prefijo: ['Cobertura Médica'], audiencia: 'EMPLEADO', porque: 'Su prepaga.' },
];

/** Devuelve la audiencia propuesta, o null si ninguna regla la cubre. */
export function audienciaSugerida(ruta: string[]): { audiencia: Audiencia; porque: string } | null {
  for (const regla of REGLAS) {
    const calza = regla.prefijo.every((parte, i) => ruta[i] === parte);
    if (calza) return { audiencia: regla.audiencia, porque: regla.porque };
  }
  return null;
}
