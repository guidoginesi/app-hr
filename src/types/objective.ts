// Objectives Module Types

export type ObjectivePeriodType = 'annual' | 'q1' | 'q2' | 'q3' | 'q4';
export type ObjectiveStatus = 'not_started' | 'in_progress' | 'completed';
export type ObjectivesPeriodType = 'definition' | 'evaluation';

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
}

export const PERIOD_TYPE_LABELS: Record<ObjectivePeriodType, string> = {
  annual: 'Anual',
  q1: '1° Trimestre',
  q2: '2° Trimestre',
  q3: '3° Trimestre',
  q4: '4° Trimestre',
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
