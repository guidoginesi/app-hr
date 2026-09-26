export type OffboardingQuestionType =
  | 'text'
  | 'textarea'
  | 'rating_1_5'
  | 'scale_4'
  | 'yes_no'
  | 'single_select'
  | 'multi_select';

export interface OffboardingQuestionOption {
  value: string;
  label: string;
}

export interface OffboardingQuestion {
  id: string;
  type: OffboardingQuestionType;
  label: string;
  description?: string;
  required: boolean;
  options?: OffboardingQuestionOption[];
}

/**
 * Las cuatro opciones de las escalas, en orden de mejor a peor.
 *
 * Cada pregunta trae las suyas porque concuerdan distinto: "Relación entre
 * compañeros" es *Excelente*, "Sueldos y Beneficios" es *Excelentes* y
 * "condiciones de trabajo" es *Excelentes* en femenino. En la planilla están
 * así, y si acá se unifican dejan de coincidir con el histórico.
 *
 * El `value` sí es común a todas: es lo que se guarda y lo que permite
 * promediar y comparar entre preguntas.
 */
function escala(
  [exc, bueno, reg, malo]: [string, string, string, string],
): OffboardingQuestionOption[] {
  return [
    { value: 'excelente', label: exc },
    { value: 'bueno', label: bueno },
    { value: 'regular', label: reg },
    { value: 'malo', label: malo },
  ];
}

/**
 * Las preguntas de la entrevista de salida.
 *
 * Son las del Google Form "Entrevista de Salida" que People viene usando desde
 * 2022, con 25 respuestas. Se copiaron tal cual —mismas preguntas, mismas
 * escalas de cuatro niveles— para que lo que se conteste acá se pueda leer
 * junto con lo que ya está en la planilla. Si se cambian las escalas o se
 * reformula una pregunta, esa continuidad se corta.
 *
 * Quedaron afuera dos del Form, porque la app ya las sabe y preguntarlas sería
 * hacer trabajar a alguien que se está yendo: **Antigüedad** (sale de
 * `hire_date` y `termination_date`) y **Nombre** (la respuesta se guarda con el
 * `employee_id`).
 *
 * Los `id` son las claves con las que se guardan las respuestas en
 * `offboarding_responses.responses`: cambiar uno deja huérfano lo ya
 * contestado. El texto se puede editar; el `id`, no.
 */
export const OFFBOARDING_QUESTIONS: OffboardingQuestion[] = [
  {
    id: 'separation_reason',
    type: 'textarea',
    label: '¿Cuál es el motivo de tu desvinculación de Pow?',
    required: true,
  },
  {
    id: 'would_recommend_why',
    type: 'textarea',
    label: '¿Recomendarías trabajar en Pow? ¿Por qué?',
    required: true,
  },
  {
    id: 'boss_would_change',
    type: 'textarea',
    label: 'Si tuvieras el puesto de tu líder, ¿qué harías diferente?',
    required: true,
  },
  {
    id: 'improvements',
    type: 'textarea',
    label: '¿Qué mejoras le recomendarías a Pow?',
    required: true,
  },
  {
    id: 'peer_relationship',
    type: 'scale_4',
    label: 'Relación entre compañeros',
    required: true,
    options: escala(['Excelente', 'Buena', 'Regular', 'Mala']),
  },
  {
    id: 'manager_relationship',
    type: 'scale_4',
    label: 'Relación entre líderes y equipo',
    required: true,
    options: escala(['Excelente', 'Buena', 'Regular', 'Mala']),
  },
  {
    id: 'onboarding_training',
    type: 'scale_4',
    label: 'Plan de inducción y capacitación',
    required: true,
    options: escala(['Excelente', 'Bueno', 'Regular', 'Malo']),
  },
  {
    id: 'work_conditions',
    type: 'scale_4',
    label: '¿Cómo son las condiciones de trabajo?',
    required: true,
    options: escala(['Excelentes', 'Buenas', 'Regulares', 'Malas']),
  },
  {
    id: 'salary_benefits',
    type: 'scale_4',
    label: 'Sueldos y beneficios',
    required: true,
    options: escala(['Excelentes', 'Buenos', 'Regulares', 'Malos']),
  },
  {
    id: 'promotion_opportunities',
    type: 'scale_4',
    label: 'Facilidades para promociones',
    required: true,
    options: escala(['Excelentes', 'Buenas', 'Regulares', 'Malas']),
  },
  {
    id: 'fair_treatment',
    type: 'scale_4',
    label: 'Trato justo y clima de trabajo',
    required: true,
    options: escala(['Excelente', 'Bueno', 'Regular', 'Malo']),
  },
];

// Helper to validate responses against questions
export function validateOffboardingResponses(
  responses: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const question of OFFBOARDING_QUESTIONS) {
    if (question.required) {
      const value = responses[question.id];
      if (value === undefined || value === null || value === '') {
        errors.push(`La pregunta "${question.label}" es obligatoria`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
