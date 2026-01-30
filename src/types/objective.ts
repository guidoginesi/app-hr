// Objectives Module Types

export type ObjectivePeriodType = 'annual' | 's1' | 's2' | 'q1' | 'q2' | 'q3' | 'q4';
export type ObjectiveStatus = 'not_started' | 'in_progress' | 'completed';
export type ObjectivesPeriodType = 'definition' | 'evaluation';

// Periodicity determines how objective is broken down into sub-objectives
export type ObjectivePeriodicity = 'annual' | 'semestral' | 'trimestral';

export interface Objective {
  id: string;
  employee_id: string;
  created_by: string;
  year: number;
  period_type: ObjectivePeriodType;
  title: string;
  description: string | null;
  progress_percentage: number;
  status: ObjectiveStatus;
  is_professional_development: boolean;
  objective_number: number | null;
  // Periodicity & weight (new)
  periodicity: ObjectivePeriodicity;
  weight_pct: number;
  parent_objective_id: string | null;
  sub_objective_number: number | null;
  // Achievement fields
  achievement_percentage: number | null;
  achievement_notes: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
  };
  evaluator?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  // Sub-objectives (for main objectives)
  sub_objectives?: Objective[];
  // Calculated progress (for objectives with sub-objectives)
  calculated_progress?: number;
}

// Objectives Period (for admin configuration)
export interface ObjectivesPeriod {
  id: string;
  year: number;
  period_type: ObjectivesPeriodType;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ObjectivesPeriodFormData {
  year: number;
  period_type: ObjectivesPeriodType;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export interface ObjectiveFormData {
  employee_id: string;
  year: number;
  period_type: ObjectivePeriodType;
  title: string;
  description?: string;
  progress_percentage?: number;
  status?: ObjectiveStatus;
  is_professional_development?: boolean;
  objective_number?: number;
  // Periodicity & weight (new)
  periodicity?: ObjectivePeriodicity;
  weight_pct?: number;
  parent_objective_id?: string;
  sub_objective_number?: number;
}

// Sub-objective form data (for creating/editing sub-objectives)
export interface SubObjectiveFormData {
  parent_objective_id: string;
  sub_objective_number: number;
  title: string;
  description?: string;
  progress_percentage?: number;
  status?: ObjectiveStatus;
}

export const PERIOD_TYPE_LABELS: Record<ObjectivePeriodType, string> = {
  annual: 'Anual',
  s1: '1° Semestre',
  s2: '2° Semestre',
  q1: '1° Trimestre',
  q2: '2° Trimestre',
  q3: '3° Trimestre',
  q4: '4° Trimestre',
};

// Periodicity labels (how objective is evaluated)
export const PERIODICITY_LABELS: Record<ObjectivePeriodicity, string> = {
  annual: 'Anual (sin sub-objetivos)',
  semestral: 'Semestral (2 sub-objetivos)',
  trimestral: 'Trimestral (4 sub-objetivos)',
};

// Required sub-objectives count by periodicity
export const SUB_OBJECTIVES_COUNT: Record<ObjectivePeriodicity, number> = {
  annual: 0,
  semestral: 2,
  trimestral: 4,
};

// Sub-objective labels by periodicity
export const SUB_OBJECTIVE_LABELS: Record<ObjectivePeriodicity, string[]> = {
  annual: [],
  semestral: ['1° Semestre', '2° Semestre'],
  trimestral: ['Q1', 'Q2', 'Q3', 'Q4'],
};

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  not_started: 'No iniciado',
  in_progress: 'En progreso',
  completed: 'Completado',
};

export const STATUS_COLORS: Record<ObjectiveStatus, { bg: string; text: string }> = {
  not_started: { bg: 'bg-zinc-100', text: 'text-zinc-600' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
};

export const OBJECTIVES_PERIOD_TYPE_LABELS: Record<ObjectivesPeriodType, string> = {
  definition: 'Definición de objetivos',
  evaluation: 'Evaluación de cumplimiento',
};

export const OBJECTIVES_PERIOD_TYPE_DESCRIPTIONS: Record<ObjectivesPeriodType, string> = {
  definition: 'Período para que los líderes creen y editen los objetivos de su equipo',
  evaluation: 'Período para registrar el cumplimiento real de los objetivos',
};

// Employee objectives score result (from calculate_employee_objectives_score function)
export interface EmployeeObjectivesScore {
  objective_1_title: string | null;
  objective_1_weight: number;
  objective_1_progress: number;
  objective_1_periodicity: ObjectivePeriodicity | null;
  objective_2_title: string | null;
  objective_2_weight: number;
  objective_2_progress: number;
  objective_2_periodicity: ObjectivePeriodicity | null;
  final_score: number;
}

// Validation result
export interface ObjectiveValidationResult {
  is_valid: boolean;
  total_weight?: number;
  objective_count?: number;
  required_count?: number;
  actual_count?: number;
  error_message: string | null;
}
