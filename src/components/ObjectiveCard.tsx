'use client';

import type { Objective, ObjectiveStatus, ObjectivePeriodicity } from '@/types/objective';
import { 
  STATUS_LABELS, 
  STATUS_COLORS, 
  PERIODICITY_LABELS, 
  SUB_OBJECTIVES_COUNT, 
  SUB_OBJECTIVE_LABELS 
} from '@/types/objective';

export interface ObjectiveCardProps {
  objective: Objective;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateProgress?: (obj: Objective, progress: number, status: ObjectiveStatus) => void;
  onEvaluate?: () => void;
  onEvaluateSubObjective?: (subObjective: Objective) => void;
  canEdit?: boolean;
  canEvaluate?: boolean;
  readOnly?: boolean;
}

export function ObjectiveCard({
  objective,
  onEdit,
  onDelete,
  onUpdateProgress,
  onEvaluate,
  onEvaluateSubObjective,
  canEdit = false,
  canEvaluate = false,
  readOnly = false,
}: ObjectiveCardProps) {
  const periodicity = (objective.periodicity || 'annual') as ObjectivePeriodicity;
  const statusColor = STATUS_COLORS[objective.status];
  const hasAchievement = objective.achievement_percentage !== null && objective.achievement_percentage !== undefined;
  const hasSubObjectives = objective.sub_objectives && objective.sub_objectives.length > 0;
  const requiredSubObjectives = SUB_OBJECTIVES_COUNT[periodicity] || 0;
  const actualSubObjectives = objective.sub_objectives?.length || 0;
  const subObjectivesComplete = actualSubObjectives >= requiredSubObjectives;
  
  // Use calculated_progress for objectives with sub-objectives
  const displayProgress = objective.calculated_progress ?? objective.progress_percentage;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Objective Number */}
            {objective.objective_number && (
              <span className="text-xs font-bold text-white bg-purple-600 px-2 py-0.5 rounded">
                #{objective.objective_number}
              </span>
            )}
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              {objective.year}
            </span>
            {/* Periodicity badge */}
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {PERIODICITY_LABELS[periodicity]?.split(' ')[0] || 'Anual'}
            </span>
            {/* Weight badge */}
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Peso: {objective.weight_pct ?? 50}%
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
              {STATUS_LABELS[objective.status]}
            </span>
            {hasAchievement && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                Evaluado: {objective.achievement_percentage}%
              </span>
            )}
            {objective.is_locked && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                Bloqueado
              </span>
            )}
          </div>
          <h4 className="font-medium text-zinc-900">{objective.title}</h4>
          {objective.description && (
            <p className="mt-1 text-sm text-zinc-500">{objective.description}</p>
          )}
          
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Progreso {hasSubObjectives ? '(calculado)' : ''}</span>
              <span>{displayProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div
                className={`h-2 rounded-full transition-all ${
                  displayProgress === 100 ? 'bg-green-500' :
                  displayProgress >= 50 ? 'bg-purple-500' :
                  'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Sub-objectives section */}
          {requiredSubObjectives > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-700">
                  Sub-objetivos ({actualSubObjectives}/{requiredSubObjectives})
                </span>
                {!subObjectivesComplete && (
                  <span className="text-xs text-amber-600">
                    Faltan {requiredSubObjectives - actualSubObjectives} sub-objetivo(s)
                  </span>
                )}
              </div>
              
              {hasSubObjectives ? (
                <div className="space-y-2">
                  {objective.sub_objectives!.map((sub, idx) => {
                    const subHasAchievement = sub.achievement_percentage !== null && sub.achievement_percentage !== undefined;
                    return (
                    <div key={sub.id} className="rounded-lg bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                          {SUB_OBJECTIVE_LABELS[periodicity]?.[idx] || `#${idx + 1}`}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-700">{sub.title}</p>
                          {sub.description && (
                            <p className="text-xs text-zinc-500 mt-0.5">{sub.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {subHasAchievement ? (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                              {sub.achievement_percentage}%
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-zinc-200">
                                  <div 
                                    className="h-1.5 rounded-full bg-purple-500"
                                    style={{ width: `${sub.progress_percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-zinc-500">{sub.progress_percentage}%</span>
                              </div>
                            </>
                          )}
                          {!readOnly && canEvaluate && onEvaluateSubObjective && (
                            <button
                              onClick={() => onEvaluateSubObjective(sub)}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              {subHasAchievement ? 'Editar' : 'Evaluar'}
                            </button>
                          )}
                        </div>
                      </div>
                      {subHasAchievement && sub.achievement_notes && (
                        <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 rounded p-2">
                          {sub.achievement_notes}
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  Agrega sub-objetivos para este objetivo {periodicity}
                </p>
              )}
            </div>
          )}

          {/* Achievement Notes */}
          {hasAchievement && objective.achievement_notes && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Notas de evaluación:</p>
              <p className="text-sm text-emerald-600">{objective.achievement_notes}</p>
            </div>
          )}
        </div>

        {!readOnly && (canEdit || canEvaluate) && (
          <div className="flex flex-col items-end gap-2">
            {canEvaluate && onEvaluate && (
              <button
                onClick={onEvaluate}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Evaluar
              </button>
            )}
            {canEdit && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    title="Editar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
