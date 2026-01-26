// Corporate Objectives Module Types

export type CorporateObjectiveType = 'billing' | 'nps';
export type Quarter = 'q1' | 'q2' | 'q3' | 'q4';

export interface CorporateObjective {
  id: string;
  year: number;
  objective_type: CorporateObjectiveType;
  quarter: Quarter | null; // null for billing (annual), q1-q4 for NPS
  title: string;
  description: string | null;
  target_value: number | null;
  gate_percentage: number;
  cap_percentage: number;
  floor_value: number | null;
  ceiling_value: number | null;
  actual_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface CorporateObjectiveFormData {
  year: number;
  objective_type: CorporateObjectiveType;
  quarter?: Quarter | null;
  title: string;
  description?: string;
  target_value?: number;
  gate_percentage?: number;
  cap_percentage?: number;
  floor_value?: number;
  ceiling_value?: number;
  actual_value?: number;
}

export const QUARTER_LABELS: Record<Quarter, string> = {
  q1: 'Q1 (Ene-Mar)',
  q2: 'Q2 (Abr-Jun)',
  q3: 'Q3 (Jul-Sep)',
  q4: 'Q4 (Oct-Dic)',
};

// Seniority levels and weight calculations
// Pow uses detailed levels: 1.1-1.4 (Jr), 2.1-2.4 (Ssr), 3.1-3.4 (Sr), 4.1-4.4 (Líder), 5.1-5.4 (C-Level)
export type SeniorityCategory = 1 | 2 | 3 | 4 | 5;

// All possible seniority levels
export const SENIORITY_LEVELS = [
  '1.1', '1.2', '1.3', '1.4',
  '2.1', '2.2', '2.3', '2.4',
  '3.1', '3.2', '3.3', '3.4',
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3', '5.4',
] as const;

export type SeniorityLevel = typeof SENIORITY_LEVELS[number];

export const SENIORITY_CATEGORY_LABELS: Record<SeniorityCategory, string> = {
  1: 'Jr.',
  2: 'Ssr.',
  3: 'Sr.',
  4: 'Líder',
  5: 'C-Level',
};

export const SENIORITY_CATEGORY_COLORS: Record<SeniorityCategory, { bg: string; text: string }> = {
  1: { bg: 'bg-green-100', text: 'text-green-700' },
  2: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  3: { bg: 'bg-purple-100', text: 'text-purple-700' },
  4: { bg: 'bg-blue-100', text: 'text-blue-700' },
  5: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

// Get the main category (1-5) from a detailed level like "3.2"
export function getSeniorityCategory(level: string | null): SeniorityCategory | null {
  if (!level) return null;
  const category = parseInt(level.split('.')[0]);
  if (category >= 1 && category <= 5) return category as SeniorityCategory;
  return null;
}

// Get full label like "Lev. 3.2 - Sr."
export function getSeniorityLabel(level: string | null): string {
  if (!level) return 'Sin definir';
  const category = getSeniorityCategory(level);
  if (!category) return level;
  return `Lev. ${level} - ${SENIORITY_CATEGORY_LABELS[category]}`;
}

// Get short label like "3.2 Sr."
export function getSeniorityShortLabel(level: string | null): string {
  if (!level) return '-';
  const category = getSeniorityCategory(level);
  if (!category) return level;
  return `${level} ${SENIORITY_CATEGORY_LABELS[category]}`;
}

export interface SeniorityWeights {
  company: number;
  area: number;
}

// Weight mapping: Jr=30%, Ssr=40%, Sr=60%, Líder/C-Level=70%
export const SENIORITY_WEIGHTS: Record<SeniorityCategory, SeniorityWeights> = {
  1: { company: 30, area: 70 },  // Jr
  2: { company: 40, area: 60 },  // Ssr
  3: { company: 60, area: 40 },  // Sr
  4: { company: 70, area: 30 },  // Líder
  5: { company: 70, area: 30 },  // C-Level (same as Líder)
};

// Detailed weight distribution per objective
export interface ObjectiveWeightDistribution {
  billing: number;
  nps: number;
  area1: number;
  area2: number;
}

export const OBJECTIVE_WEIGHT_DISTRIBUTION: Record<SeniorityCategory, ObjectiveWeightDistribution> = {
  1: { billing: 15, nps: 15, area1: 35, area2: 35 },  // Jr
  2: { billing: 20, nps: 20, area1: 30, area2: 30 },  // Ssr
  3: { billing: 30, nps: 30, area1: 20, area2: 20 },  // Sr
  4: { billing: 35, nps: 35, area1: 15, area2: 15 },  // Líder
  5: { billing: 35, nps: 35, area1: 15, area2: 15 },  // C-Level
};

// Get weights from detailed level
export function getWeightsForLevel(level: string | null): ObjectiveWeightDistribution {
  const category = getSeniorityCategory(level);
  return OBJECTIVE_WEIGHT_DISTRIBUTION[category || 1];
}

export const OBJECTIVE_TYPE_LABELS: Record<CorporateObjectiveType, string> = {
  billing: 'Facturación',
  nps: 'NPS',
};

// Dashboard types
export interface EmployeeObjectivesStatus {
  id: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  seniority_level: string | null; // Format: "1.1" to "5.4"
  has_billing: boolean;
  nps_count: number; // 0-4 quarters
  area_objectives_count: number; // 0, 1, or 2
  total_progress: number | null; // Weighted average
  has_all_objectives: boolean;
}

export interface ObjectivesDashboardStats {
  total_employees: number;
  with_complete_objectives: number;
  with_partial_objectives: number;
  without_objectives: number;
  has_billing: boolean;
  nps_count: number;
}

// Helper functions
export function calculateCompletionPercentage(
  actual: number | null,
  target: number | null,
  cap: number = 150
): number | null {
  if (actual === null || target === null || target === 0) return null;
  const percentage = (actual / target) * 100;
  return Math.min(percentage, cap);
}

export function isGateMet(
  actual: number | null,
  target: number | null,
  gatePercentage: number = 90
): boolean {
  if (actual === null || target === null || target === 0) return false;
  return (actual / target) * 100 >= gatePercentage;
}

export function calculateNpsScore(
  actual: number | null,
  floor: number | null,
  target: number | null,
  ceiling: number | null
): number | null {
  if (actual === null || floor === null || target === null || ceiling === null) return null;
  
  if (actual <= floor) return 0;
  if (actual >= ceiling) return 100;
  
  if (actual < target) {
    // Below target: 0-100% scaled between floor and target
    return ((actual - floor) / (target - floor)) * 100;
  } else {
    // At or above target: 100%
    return 100;
  }
}
