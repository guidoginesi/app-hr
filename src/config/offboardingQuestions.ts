export type OffboardingQuestionType = 
  | 'text' 
  | 'textarea' 
  | 'rating_1_5' 
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

export const OFFBOARDING_QUESTIONS: OffboardingQuestion[] = [
  {
    id: 'main_reason',
    type: 'single_select',
    label: '¿Cuál es el motivo principal de tu salida?',
    required: true,
    options: [
      { value: 'new_opportunity', label: 'Nueva oportunidad laboral' },
      { value: 'career_growth', label: 'Crecimiento profesional' },
      { value: 'compensation', label: 'Compensación/Beneficios' },
      { value: 'work_life_balance', label: 'Balance vida-trabajo' },
      { value: 'relocation', label: 'Mudanza/Cambio de ubicación' },
      { value: 'personal_reasons', label: 'Motivos personales' },
      { value: 'management', label: 'Relación con liderazgo' },
      { value: 'culture', label: 'Cultura organizacional' },
      { value: 'other', label: 'Otro' },
    ],
  },
  {
    id: 'other_reason',
    type: 'textarea',
    label: 'Si seleccionaste "Otro", por favor especifica:',
    required: false,
  },
  {
    id: 'overall_satisfaction',
    type: 'rating_1_5',
    label: '¿Qué tan satisfecho/a estuviste con tu experiencia general en la empresa?',
    description: '1 = Muy insatisfecho, 5 = Muy satisfecho',
    required: true,
  },
  {
    id: 'manager_satisfaction',
    type: 'rating_1_5',
    label: '¿Qué tan satisfecho/a estuviste con tu líder directo?',
    description: '1 = Muy insatisfecho, 5 = Muy satisfecho',
    required: true,
  },
  {
    id: 'growth_opportunities',
    type: 'rating_1_5',
    label: '¿Cómo calificarías las oportunidades de crecimiento profesional?',
    description: '1 = Muy pobres, 5 = Excelentes',
    required: true,
  },
  {
    id: 'work_environment',
    type: 'rating_1_5',
    label: '¿Cómo calificarías el ambiente de trabajo?',
    description: '1 = Muy malo, 5 = Excelente',
    required: true,
  },
  {
    id: 'would_recommend',
    type: 'yes_no',
    label: '¿Recomendarías a un amigo o conocido trabajar en esta empresa?',
    required: true,
  },
  {
    id: 'would_return',
    type: 'yes_no',
    label: '¿Considerarías volver a trabajar en la empresa en el futuro?',
    required: true,
  },
  {
    id: 'best_aspects',
    type: 'multi_select',
    label: '¿Cuáles fueron los mejores aspectos de trabajar aquí?',
    required: false,
    options: [
      { value: 'team', label: 'El equipo de trabajo' },
      { value: 'projects', label: 'Los proyectos' },
      { value: 'flexibility', label: 'La flexibilidad' },
      { value: 'benefits', label: 'Los beneficios' },
      { value: 'culture', label: 'La cultura' },
      { value: 'learning', label: 'Las oportunidades de aprendizaje' },
      { value: 'leadership', label: 'El liderazgo' },
      { value: 'compensation', label: 'La compensación' },
    ],
  },
  {
    id: 'areas_to_improve',
    type: 'multi_select',
    label: '¿Qué áreas crees que la empresa debería mejorar?',
    required: false,
    options: [
      { value: 'communication', label: 'Comunicación interna' },
      { value: 'career_development', label: 'Desarrollo de carrera' },
      { value: 'compensation', label: 'Compensación y beneficios' },
      { value: 'work_life_balance', label: 'Balance vida-trabajo' },
      { value: 'management', label: 'Gestión y liderazgo' },
      { value: 'tools', label: 'Herramientas de trabajo' },
      { value: 'processes', label: 'Procesos internos' },
      { value: 'culture', label: 'Cultura organizacional' },
    ],
  },
  {
    id: 'improvements_detail',
    type: 'textarea',
    label: '¿Tienes sugerencias específicas de mejora para la empresa?',
    required: false,
  },
  {
    id: 'additional_comments',
    type: 'textarea',
    label: '¿Hay algo más que quieras compartir?',
    required: false,
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
