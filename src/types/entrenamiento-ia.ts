export interface AiTrainingCycle {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiTrainingSession {
  id: string;
  cycle_id: string;
  title: string;
  session_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiTrainingScoreInput {
  attended: boolean;
  camera_on: boolean;
  participation_count: number;
  exam_score: number | null;
  activity_on_time: boolean;
  manual_adjustment?: number;
  notes?: string | null;
}

export interface AiTrainingScore extends AiTrainingScoreInput {
  id: string;
  session_id: string;
  employee_id: string;
  manual_adjustment: number;
  total_points: number;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiTrainingRankingRow {
  cycle_id: string;
  cycle_name: string;
  cycle_is_active: boolean;
  employee_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  job_title: string | null;
  department_id: string | null;
  department_name: string | null;
  total_points: number;
  sessions_scored: number;
}

export interface AiTrainingScoreDetail extends AiTrainingScore {
  session_title: string;
  session_date: string;
  cycle_id: string;
  cycle_name: string;
  first_name: string;
  last_name: string;
}

export interface ScoreBreakdownLine {
  label: string;
  points: number;
}

/** Calcula puntos de una sesión según reglas Pow Entrenamiento IA. */
export function calculateSessionPoints(input: AiTrainingScoreInput): number {
  let points = 0;

  if (input.attended) points += 10;
  if (input.camera_on) points += 5;

  const participationPoints = Math.min(Math.max(input.participation_count, 0), 3) * 5;
  points += participationPoints;

  if (input.exam_score != null && input.exam_score >= 70) points += 15;
  if (input.exam_score === 100) points += 5;

  if (input.activity_on_time) points += 10;

  points += input.manual_adjustment ?? 0;

  return points;
}

export function buildScoreBreakdown(input: AiTrainingScoreInput): ScoreBreakdownLine[] {
  const lines: ScoreBreakdownLine[] = [];

  if (input.attended) lines.push({ label: 'Asistencia', points: 10 });
  if (input.camera_on) lines.push({ label: 'Cámara prendida', points: 5 });

  const participations = Math.min(Math.max(input.participation_count, 0), 3);
  if (participations > 0) {
    lines.push({
      label: `Participación (${participations} intervención${participations !== 1 ? 'es' : ''})`,
      points: participations * 5,
    });
  }

  if (input.exam_score != null && input.exam_score >= 70) {
    lines.push({ label: `Examen aprobado (${input.exam_score}%)`, points: 15 });
  }
  if (input.exam_score === 100) {
    lines.push({ label: 'Nota perfecta en examen', points: 5 });
  }

  if (input.activity_on_time) lines.push({ label: 'Actividad práctica en tiempo', points: 10 });

  if (input.manual_adjustment) {
    lines.push({ label: 'Ajuste manual HR', points: input.manual_adjustment });
  }

  return lines;
}

export const SCORING_RULES = [
  { action: 'Asistir a la capacitación', points: '10 pts' },
  { action: 'Cámara prendida durante la sesión', points: '5 pts' },
  { action: 'Participar (micrófono / preguntas)', points: '5 pts c/u, máx. 15 pts' },
  { action: 'Aprobar el examen (≥ 70%)', points: '15 pts' },
  { action: 'Nota perfecta en el examen (100%)', points: '5 pts bonus' },
  { action: 'Entregar actividad práctica en tiempo', points: '10 pts' },
] as const;
