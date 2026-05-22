import type { AiTrainingScoreInput } from '@/types/entrenamiento-ia';
import { calculateSessionPoints } from '@/types/entrenamiento-ia';

export function buildScorePayload(input: AiTrainingScoreInput, recordedBy?: string | null) {
  const participation_count = Math.min(Math.max(input.participation_count ?? 0, 0), 10);
  const exam_score =
    input.exam_score == null || input.exam_score === ('' as unknown as number)
      ? null
      : Math.min(Math.max(Number(input.exam_score), 0), 100);

  const normalized: AiTrainingScoreInput = {
    attended: !!input.attended,
    participation_count,
    exam_score,
    activity_on_time: !!input.activity_on_time,
    manual_adjustment: Number(input.manual_adjustment ?? 0) || 0,
    notes: input.notes?.trim() || null,
  };

  return {
    ...normalized,
    total_points: calculateSessionPoints(normalized),
    recorded_by: recordedBy ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function employeeDisplayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export function employeeInitials(firstName: string, lastName: string) {
  return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase();
}
