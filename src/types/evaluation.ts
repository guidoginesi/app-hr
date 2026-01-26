// Performance Evaluation Module Types

export type EvaluationType = 'self' | 'leader';
export type EvaluationStatus = 'draft' | 'in_progress' | 'submitted';
export type PeriodStatus = 'draft' | 'open' | 'closed';
export type RecategorizationResult = 'approved' | 'not_approved';

// =============================================
// EVALUATION PERIODS
// =============================================
export interface EvaluationPeriod {
  id: string;
  name: string;
  year: number;
  // Período evaluado
  start_date: string;
  end_date: string;
  // Ventana para completar la evaluación
  evaluation_start_date: string | null;
  evaluation_end_date: string | null;
  is_active: boolean;
  status: PeriodStatus;
  self_evaluation_enabled: boolean;
  leader_evaluation_enabled: boolean;
  show_results_to_employee: boolean;
  // Módulos opcionales
  objectives_enabled: boolean;
  recategorization_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationPeriodFormData {
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  evaluation_start_date?: string;
  evaluation_end_date?: string;
  is_active?: boolean;
  status?: PeriodStatus;
  self_evaluation_enabled?: boolean;
  leader_evaluation_enabled?: boolean;
  show_results_to_employee?: boolean;
  objectives_enabled?: boolean;
  recategorization_enabled?: boolean;
}

// =============================================
// EVALUATION DIMENSIONS
// =============================================
export interface EvaluationDimension {
  id: string;
  period_id: string;
  name: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  items?: EvaluationItem[];
}

export interface EvaluationDimensionFormData {
  period_id: string;
  name: string;
  description?: string;
  order_index?: number;
  is_active?: boolean;
}

// =============================================
// EVALUATION ITEMS
// =============================================
export interface EvaluationItem {
  id: string;
  dimension_id: string;
  statement: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  dimension?: EvaluationDimension;
}

export interface EvaluationItemFormData {
  dimension_id: string;
  statement: string;
  order_index?: number;
  is_active?: boolean;
}

// =============================================
// EVALUATIONS
// =============================================
export interface Evaluation {
  id: string;
  period_id: string;
  employee_id: string;
  evaluator_id: string;
  type: EvaluationType;
  status: EvaluationStatus;
  current_step: number;
  total_score: number | null;
  dimension_scores: Record<string, number> | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  // Joined
  period?: EvaluationPeriod;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    department?: { id: string; name: string } | null;
  };
  evaluator?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface EvaluationWithDetails extends Evaluation {
  responses: EvaluationResponse[];
  open_questions: EvaluationOpenQuestion[];
  objectives?: EvaluationObjective[];
  recategorization?: EvaluationRecategorization;
}

// =============================================
// EVALUATION RESPONSES
// =============================================
export interface EvaluationResponse {
  id: string;
  evaluation_id: string;
  item_id: string;
  score: number | null;
  explanation: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  item?: EvaluationItem;
}

export interface EvaluationResponseFormData {
  item_id: string;
  score: number;
  explanation?: string;
}

// =============================================
// EVALUATION OPEN QUESTIONS
// =============================================
export interface EvaluationOpenQuestion {
  id: string;
  evaluation_id: string;
  question_key: string;
  response: string | null;
  created_at: string;
  updated_at: string;
}

export type OpenQuestionKey = string;

export interface EvaluationOpenQuestionFormData {
  question_key: OpenQuestionKey;
  response: string;
}

// =============================================
// OPEN QUESTION CONFIG (Configurable from Admin)
// =============================================
export interface OpenQuestionConfig {
  id: string;
  question_key: string;
  label_self: string;
  label_leader: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OpenQuestionConfigFormData {
  question_key: string;
  label_self: string;
  label_leader: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

// =============================================
// EVALUATION OBJECTIVES
// =============================================
export interface EvaluationObjective {
  id: string;
  evaluation_id: string;
  quarter: 1 | 2 | 3 | 4;
  objectives_description: string | null;
  completion_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationObjectiveFormData {
  quarter: 1 | 2 | 3 | 4;
  objectives_description: string;
  completion_percentage: number;
}

// =============================================
// EVALUATION RECATEGORIZATION
// =============================================
export interface EvaluationRecategorization {
  id: string;
  evaluation_id: string;
  level_recategorization: RecategorizationResult | null;
  position_recategorization: RecategorizationResult | null;
  self_score: number | null;
  leader_score: number | null;
  gap: number | null;
  objectives_average: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationRecategorizationFormData {
  level_recategorization?: RecategorizationResult;
  position_recategorization?: RecategorizationResult;
  notes?: string;
}

// =============================================
// WIZARD STEP TYPES
// =============================================
export type SelfEvaluationStep = 
  | 'instructions'
  | 'dimension_1'
  | 'dimension_2'
  | 'dimension_3'
  | 'dimension_4'
  | 'dimension_5'
  | 'dimension_6'
  | 'open_questions'
  | 'review';

export type LeaderEvaluationStep = 
  | 'instructions'
  | 'dimension_1'
  | 'dimension_2'
  | 'dimension_3'
  | 'dimension_4'
  | 'dimension_5'
  | 'dimension_6'
  | 'open_questions'
  | 'objectives'
  | 'recategorization';

// =============================================
// SCALE DEFINITIONS
// =============================================
export const SCALE_DEFINITIONS = [
  { min: 1, max: 2, label: 'Muy por debajo', color: 'red' },
  { min: 3, max: 4, label: 'Por debajo', color: 'orange' },
  { min: 5, max: 6, label: 'Esperado', color: 'yellow' },
  { min: 7, max: 8, label: 'Superior', color: 'green' },
  { min: 9, max: 10, label: 'Excepcional', color: 'emerald' },
] as const;

export function getScaleLabel(score: number): string {
  const def = SCALE_DEFINITIONS.find(d => score >= d.min && score <= d.max);
  return def?.label || '';
}

// =============================================
// OPEN QUESTIONS CONFIG
// =============================================
export const SELF_OPEN_QUESTIONS = [
  { key: 'strengths', label: '¿Cuáles consideras que son tus principales fortalezas?' },
  { key: 'growth_areas', label: '¿En qué aspectos consideras que deberías crecer o mejorar?' },
  { key: 'leader_support', label: '¿Qué necesitás de tu líder para cumplir tus objetivos?' },
] as const;

export const LEADER_OPEN_QUESTIONS = [
  { key: 'strengths', label: '¿Cuáles consideras que son las principales fortalezas del colaborador?' },
  { key: 'growth_areas', label: '¿En qué debería enfocarse para crecer o mejorar?' },
  { key: 'leader_support', label: '¿Qué necesita de vos como líder para cumplir sus objetivos?' },
] as const;

// =============================================
// CALCULATION HELPERS
// =============================================
export function calculateDimensionScore(responses: EvaluationResponse[], dimensionItems: EvaluationItem[]): number | null {
  const itemIds = dimensionItems.map(i => i.id);
  const dimensionResponses = responses.filter(r => itemIds.includes(r.item_id) && r.score !== null);
  
  if (dimensionResponses.length === 0) return null;
  
  const sum = dimensionResponses.reduce((acc, r) => acc + (r.score || 0), 0);
  return Math.round((sum / dimensionResponses.length) * 100) / 100;
}

export function calculateTotalScore(dimensionScores: Record<string, number>): number {
  const scores = Object.values(dimensionScores).filter(s => s !== null);
  if (scores.length === 0) return 0;
  
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

export function calculateObjectivesAverage(objectives: EvaluationObjective[]): number | null {
  const validObjectives = objectives.filter(o => o.completion_percentage !== null);
  if (validObjectives.length === 0) return null;
  
  const sum = validObjectives.reduce((acc, o) => acc + (o.completion_percentage || 0), 0);
  return Math.round((sum / validObjectives.length) * 100) / 100;
}

export function calculateGap(selfScore: number | null, leaderScore: number | null): number | null {
  if (selfScore === null || leaderScore === null) return null;
  return Math.round((leaderScore - selfScore) * 100) / 100;
}
