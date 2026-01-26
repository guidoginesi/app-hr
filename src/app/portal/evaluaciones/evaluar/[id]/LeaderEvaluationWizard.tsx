'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ScaleInput } from '@/components/evaluations/ScaleInput';
import { ProgressBar } from '@/components/evaluations/ProgressBar';
import { LEADER_OPEN_QUESTIONS, SCALE_DEFINITIONS, calculateDimensionScore, calculateTotalScore } from '@/types/evaluation';
import type { Employee } from '@/types/employee';
import type { Evaluation, EvaluationDimension, EvaluationItem, EvaluationResponse, EvaluationOpenQuestion, EvaluationObjective, EvaluationRecategorization, RecategorizationResult } from '@/types/evaluation';

type OpenQuestionConfigItem = {
  question_key: string;
  label_self: string;
  label_leader: string;
  description: string | null;
};

type LeaderEvaluationWizardProps = {
  evaluation: Evaluation & { period: any; employee: any };
  dimensions: (EvaluationDimension & { items: EvaluationItem[] })[];
  initialResponses: EvaluationResponse[];
  initialOpenQuestions: EvaluationOpenQuestion[];
  initialObjectives: EvaluationObjective[];
  initialRecategorization: EvaluationRecategorization | null;
  selfEvaluationSummary: { total_score: number | null; dimension_scores: Record<string, number> | null; status: string } | null;
  openQuestionConfig?: OpenQuestionConfigItem[];
  evaluator: Employee;
};

type Step = 'preview' | 'instructions' | `dimension_${number}` | 'open_questions' | 'objectives' | 'recategorization';

export function LeaderEvaluationWizard({
  evaluation,
  dimensions,
  initialResponses,
  initialOpenQuestions,
  initialObjectives,
  initialRecategorization,
  selfEvaluationSummary,
  openQuestionConfig,
  evaluator,
}: LeaderEvaluationWizardProps) {
  // Use configured questions if available, fallback to hardcoded
  const leaderOpenQuestions = openQuestionConfig && openQuestionConfig.length > 0
    ? openQuestionConfig.map(q => ({ key: q.question_key, label: q.label_leader }))
    : LEADER_OPEN_QUESTIONS;
  const router = useRouter();
  
  // Module configuration from period
  const objectivesEnabled = evaluation.period?.objectives_enabled ?? true;
  const recategorizationEnabled = evaluation.period?.recategorization_enabled ?? true;
  
  const [currentStep, setCurrentStep] = useState<Step>(evaluation.current_step === 0 ? 'preview' : 'instructions');
  const [responses, setResponses] = useState<Record<string, { score: number | null; explanation: string }>>(
    initialResponses.reduce((acc, r) => ({
      ...acc,
      [r.item_id]: { score: r.score, explanation: r.explanation || '' }
    }), {})
  );
  const [openQuestions, setOpenQuestions] = useState<Record<string, string>>(
    initialOpenQuestions.reduce((acc, q) => ({ ...acc, [q.question_key]: q.response || '' }), {})
  );
  const [objectives, setObjectives] = useState<Record<number, { description: string; percentage: number | null }>>(
    initialObjectives.reduce((acc, o) => ({
      ...acc,
      [o.quarter]: { description: o.objectives_description || '', percentage: o.completion_percentage }
    }), { 1: { description: '', percentage: null }, 2: { description: '', percentage: null }, 3: { description: '', percentage: null }, 4: { description: '', percentage: null } })
  );
  const [recategorization, setRecategorization] = useState({
    level: initialRecategorization?.level_recategorization || null as RecategorizationResult | null,
    position: initialRecategorization?.position_recategorization || null as RecategorizationResult | null,
    notes: initialRecategorization?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate total steps based on enabled modules
  const baseSteps = dimensions.length + 3; // preview + instructions + dimensions + open_questions
  const totalSteps = baseSteps + (objectivesEnabled ? 1 : 0) + (recategorizationEnabled ? 1 : 0);
  
  const getCurrentStepNumber = (): number => {
    if (currentStep === 'preview') return 1;
    if (currentStep === 'instructions') return 2;
    if (currentStep === 'open_questions') return dimensions.length + 3;
    if (currentStep === 'objectives') return dimensions.length + 4;
    if (currentStep === 'recategorization') {
      return dimensions.length + 3 + (objectivesEnabled ? 1 : 0) + 1;
    }
    const dimIndex = parseInt(currentStep.split('_')[1]) || 1;
    return dimIndex + 2;
  };

  // Auto-save response
  const saveResponse = useCallback(async (itemId: string, score: number | null, explanation: string) => {
    try {
      await fetch(`/api/portal/evaluations/${evaluation.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, score, explanation }),
      });
    } catch (err) {
      console.error('Error saving response:', err);
    }
  }, [evaluation.id]);

  // Auto-save open question
  const saveOpenQuestion = useCallback(async (questionKey: string, response: string) => {
    try {
      await fetch(`/api/portal/evaluations/${evaluation.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_key: questionKey, response }),
      });
    } catch (err) {
      console.error('Error saving open question:', err);
    }
  }, [evaluation.id]);

  // Auto-save objective
  const saveObjective = useCallback(async (quarter: number, description: string, percentage: number | null) => {
    try {
      await fetch(`/api/portal/evaluations/${evaluation.id}/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarter, objectives_description: description, completion_percentage: percentage }),
      });
    } catch (err) {
      console.error('Error saving objective:', err);
    }
  }, [evaluation.id]);

  const handleResponseChange = (itemId: string, field: 'score' | 'explanation', value: number | string) => {
    setResponses(prev => {
      const current = prev[itemId] || { score: null, explanation: '' };
      const updated = { ...current, [field]: value };
      setTimeout(() => saveResponse(itemId, updated.score, updated.explanation), 500);
      return { ...prev, [itemId]: updated };
    });
  };

  const handleOpenQuestionChange = (key: string, value: string) => {
    setOpenQuestions(prev => {
      setTimeout(() => saveOpenQuestion(key, value), 500);
      return { ...prev, [key]: value };
    });
  };

  const handleObjectiveChange = (quarter: number, field: 'description' | 'percentage', value: string | number) => {
    setObjectives(prev => {
      const current = prev[quarter] || { description: '', percentage: null };
      const updated = { ...current, [field]: value };
      setTimeout(() => saveObjective(quarter, updated.description, updated.percentage), 500);
      return { ...prev, [quarter]: updated };
    });
  };

  // Navigation
  const goToStep = async (step: Step) => {
    setSaving(true);
    try {
      const stepNumber = step === 'preview' ? 0 :
        step === 'instructions' ? 1 :
        step === 'open_questions' ? dimensions.length + 2 :
        step === 'objectives' ? dimensions.length + 3 :
        step === 'recategorization' ? dimensions.length + 4 :
        parseInt(step.split('_')[1]) + 1 || 1;
      
      await fetch(`/api/portal/evaluations/${evaluation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_step: stepNumber, status: 'in_progress' }),
      });
      setCurrentStep(step);
    } catch (err) {
      setError('Error al guardar el progreso');
    } finally {
      setSaving(false);
    }
  };

  // Determine the final step based on enabled modules
  const getFinalStep = (): Step => {
    if (recategorizationEnabled) return 'recategorization';
    if (objectivesEnabled) return 'objectives';
    return 'open_questions';
  };

  const goNext = () => {
    if (currentStep === 'preview') {
      goToStep('instructions');
    } else if (currentStep === 'instructions') {
      goToStep('dimension_1');
    } else if (currentStep.startsWith('dimension_')) {
      const dimIndex = parseInt(currentStep.split('_')[1]);
      if (dimIndex < dimensions.length) {
        goToStep(`dimension_${dimIndex + 1}`);
      } else {
        goToStep('open_questions');
      }
    } else if (currentStep === 'open_questions') {
      if (objectivesEnabled) {
        goToStep('objectives');
      } else if (recategorizationEnabled) {
        goToStep('recategorization');
      }
      // If neither is enabled, open_questions is the final step (handled by submit)
    } else if (currentStep === 'objectives') {
      if (recategorizationEnabled) {
        goToStep('recategorization');
      }
      // If recategorization is disabled, objectives is the final step (handled by submit)
    }
  };

  const goPrev = () => {
    if (currentStep === 'recategorization') {
      if (objectivesEnabled) {
        goToStep('objectives');
      } else {
        goToStep('open_questions');
      }
    } else if (currentStep === 'objectives') {
      goToStep('open_questions');
    } else if (currentStep === 'open_questions') {
      goToStep(`dimension_${dimensions.length}`);
    } else if (currentStep.startsWith('dimension_')) {
      const dimIndex = parseInt(currentStep.split('_')[1]);
      if (dimIndex > 1) {
        goToStep(`dimension_${dimIndex - 1}`);
      } else {
        goToStep('instructions');
      }
    } else if (currentStep === 'instructions') {
      goToStep('preview');
    }
  };

  // Calculate scores
  const calculateScores = () => {
    const dimensionScores: Record<string, number> = {};
    dimensions.forEach(dim => {
      const dimResponses = dim.items.map(item => ({
        item_id: item.id,
        score: responses[item.id]?.score || null,
      })) as any[];
      const score = calculateDimensionScore(dimResponses, dim.items);
      if (score !== null) {
        dimensionScores[dim.id] = score;
      }
    });
    const totalScore = calculateTotalScore(dimensionScores);
    return { dimensionScores, totalScore };
  };

  // Submit evaluation
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/evaluations/${evaluation.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level_recategorization: recategorization.level,
          position_recategorization: recategorization.position,
          notes: recategorization.notes,
        }),
      });
      
      if (res.ok) {
        router.push('/portal/evaluaciones');
      } else {
        const data = await res.json();
        setError(data.error || 'Error al enviar la evaluación');
      }
    } catch (err) {
      setError('Error al enviar la evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  const currentDimensionIndex = currentStep.startsWith('dimension_') ? parseInt(currentStep.split('_')[1]) - 1 : -1;
  const currentDimension = currentDimensionIndex >= 0 ? dimensions[currentDimensionIndex] : null;
  const employeeInfo = evaluation.employee;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                Evaluación de {employeeInfo?.first_name} {employeeInfo?.last_name}
              </h1>
              <p className="text-sm text-zinc-500">
                {employeeInfo?.job_title || 'Sin puesto'} — {evaluation.period?.name}
              </p>
            </div>
            <button
              onClick={() => router.push('/portal/evaluaciones')}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Guardar y salir
            </button>
          </div>
          <div className="mt-4">
            <ProgressBar current={getCurrentStepNumber()} total={totalSteps} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* Preview Step - Self evaluation results */}
        {currentStep === 'preview' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-8">
              <h2 className="text-xl font-semibold text-purple-900 mb-4">
                Resultados de la autoevaluación de {employeeInfo?.first_name}
              </h2>
              {selfEvaluationSummary && selfEvaluationSummary.status === 'submitted' ? (
                <>
                  <p className="text-sm text-purple-700 mb-4">
                    Antes de comenzar tu evaluación, revisá cómo se autoevaluó {employeeInfo?.first_name}.
                  </p>
                  <div className="p-4 rounded-lg bg-white border border-purple-200 text-center mb-6">
                    <p className="text-sm text-purple-600">Puntaje autoevaluación</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {selfEvaluationSummary.total_score?.toFixed(1) || '-'}<span className="text-lg text-purple-600">/10</span>
                    </p>
                  </div>
                  {selfEvaluationSummary.dimension_scores && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-purple-800 mb-2">Por dimensión:</p>
                      {dimensions.map(dim => (
                        <div key={dim.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                          <span className="text-purple-700">{dim.name}</span>
                          <span className="font-semibold text-purple-900">
                            {selfEvaluationSummary.dimension_scores?.[dim.id]?.toFixed(1) || '-'}/10
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-purple-700">
                  {employeeInfo?.first_name} aún no ha completado su autoevaluación.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <div className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                <p className="text-sm text-zinc-600">
                  <strong>Colaborador:</strong> {employeeInfo?.first_name} {employeeInfo?.last_name}
                </p>
                <p className="text-sm text-zinc-600">
                  <strong>Puesto:</strong> {employeeInfo?.job_title || 'Sin puesto'}
                </p>
                <p className="text-sm text-zinc-600">
                  <strong>Período:</strong> Enero - Diciembre {evaluation.period?.year}
                </p>
              </div>

              <h2 className="text-xl font-semibold text-zinc-900">Instrucciones</h2>
              <div className="mt-6 space-y-4 text-zinc-600">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Evaluá el desempeño observado durante el período.</li>
                  <li>Considerá resultados, comportamientos y evolución.</li>
                  <li>Sé coherente con el feedback que ya diste durante el año.</li>
                  <li>Esta evaluación servirá de base para la conversación de desarrollo.</li>
                </ul>
              </div>
              
              <div className="mt-8 p-4 rounded-lg bg-purple-50 border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-900 mb-3">Escala de evaluación</h3>
                <div className="space-y-2">
                  {SCALE_DEFINITIONS.map((def) => (
                    <div key={def.min} className="flex items-center gap-2">
                      <span className="w-10 text-sm font-semibold text-purple-700">{def.min}-{def.max}</span>
                      <span className="text-sm text-purple-600">{def.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dimension Steps */}
        {currentDimension && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-lg font-semibold text-purple-600">
                  {currentDimensionIndex + 1}
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">{currentDimension.name}</h2>
                  {currentDimension.description && (
                    <p className="text-sm text-zinc-500">{currentDimension.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {currentDimension.items.map((item, idx) => (
                  <div key={item.id} className="space-y-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                    <p className="font-medium text-zinc-800">
                      {idx + 1}. {item.statement}
                    </p>
                    <ScaleInput
                      value={responses[item.id]?.score || null}
                      onChange={(score) => handleResponseChange(item.id, 'score', score)}
                    />
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        Explicá tu puntuación (opcional)
                      </label>
                      <textarea
                        value={responses[item.id]?.explanation || ''}
                        onChange={(e) => handleResponseChange(item.id, 'explanation', e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        placeholder="Comentarios o ejemplos..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Open Questions Step */}
        {currentStep === 'open_questions' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-zinc-900 mb-6">Preguntas abiertas</h2>
              
              <div className="space-y-6">
                {leaderOpenQuestions.map((q) => (
                  <div key={q.key} className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700">
                      {q.label}
                    </label>
                    <textarea
                      value={openQuestions[q.key] || ''}
                      onChange={(e) => handleOpenQuestionChange(q.key, e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Objectives Step */}
        {objectivesEnabled && currentStep === 'objectives' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-zinc-900 mb-6">Cumplimiento de Objetivos</h2>
              <p className="text-sm text-zinc-500 mb-6">
                Registrá los objetivos de cada trimestre y su porcentaje de cumplimiento.
              </p>
              
              <div className="space-y-6">
                {[1, 2, 3, 4].map((quarter) => (
                  <div key={quarter} className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">{quarter}° Trimestre</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Objetivos</label>
                        <textarea
                          value={objectives[quarter]?.description || ''}
                          onChange={(e) => handleObjectiveChange(quarter, 'description', e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Describí los objetivos del trimestre..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">% Cumplimiento</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={objectives[quarter]?.percentage ?? ''}
                          onChange={(e) => handleObjectiveChange(quarter, 'percentage', parseInt(e.target.value) || 0)}
                          className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recategorization Step */}
        {recategorizationEnabled && currentStep === 'recategorization' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-zinc-900 mb-6">Resultados y Recategorización</h2>
              
              {(() => {
                const { dimensionScores, totalScore } = calculateScores();
                const selfScore = selfEvaluationSummary?.total_score;
                const gap = selfScore !== null && selfScore !== undefined ? (totalScore - selfScore).toFixed(1) : null;
                const objectivesAvg = Object.values(objectives).reduce((acc, o) => acc + (o.percentage || 0), 0) / 4;

                return (
                  <>
                    {/* Scores Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
                        <p className="text-xs font-medium text-blue-600">Autoevaluación</p>
                        <p className="text-2xl font-bold text-blue-900">{selfScore?.toFixed(1) || '-'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 text-center">
                        <p className="text-xs font-medium text-purple-600">Evaluación Líder</p>
                        <p className="text-2xl font-bold text-purple-900">{totalScore.toFixed(1)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-center">
                        <p className="text-xs font-medium text-zinc-600">GAP</p>
                        <p className={`text-2xl font-bold ${gap && parseFloat(gap) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {gap ? (parseFloat(gap) >= 0 ? '+' : '') + gap : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 mb-8">
                      <p className="text-sm font-medium text-amber-800">
                        Cumplimiento de objetivos promedio: {objectivesAvg.toFixed(0)}%
                      </p>
                    </div>

                    {/* Dimension Comparison */}
                    <h3 className="text-sm font-semibold text-zinc-700 mb-4">Comparativa por dimensión</h3>
                    <div className="space-y-2 mb-8">
                      {dimensions.map((dim) => {
                        const selfDimScore = selfEvaluationSummary?.dimension_scores?.[dim.id];
                        const leaderDimScore = dimensionScores[dim.id];
                        return (
                          <div key={dim.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 text-sm">
                            <span className="text-zinc-700 flex-1">{dim.name}</span>
                            <span className="w-20 text-center text-blue-600">{selfDimScore?.toFixed(1) || '-'}</span>
                            <span className="w-20 text-center text-purple-600 font-semibold">{leaderDimScore?.toFixed(1) || '-'}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recategorization */}
                    <h3 className="text-sm font-semibold text-zinc-700 mb-4">Recategorización</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-zinc-600 mb-2">Recategorización dentro del nivel</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={recategorization.level === 'approved'}
                              onChange={() => setRecategorization(prev => ({ ...prev, level: 'approved' }))}
                              className="text-purple-600 focus:ring-purple-600"
                            />
                            <span className="text-sm text-zinc-700">Aprobado</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={recategorization.level === 'not_approved'}
                              onChange={() => setRecategorization(prev => ({ ...prev, level: 'not_approved' }))}
                              className="text-purple-600 focus:ring-purple-600"
                            />
                            <span className="text-sm text-zinc-700">No aprobado</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-600 mb-2">Recategorización de nivel</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={recategorization.position === 'approved'}
                              onChange={() => setRecategorization(prev => ({ ...prev, position: 'approved' }))}
                              className="text-purple-600 focus:ring-purple-600"
                            />
                            <span className="text-sm text-zinc-700">Aprobado</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={recategorization.position === 'not_approved'}
                              onChange={() => setRecategorization(prev => ({ ...prev, position: 'not_approved' }))}
                              className="text-purple-600 focus:ring-purple-600"
                            />
                            <span className="text-sm text-zinc-700">No aprobado</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-600 mb-2">Notas adicionales</label>
                        <textarea
                          value={recategorization.notes}
                          onChange={(e) => setRecategorization(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Comentarios finales..."
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentStep === 'preview' || saving}
            className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Anterior
          </button>
          
          {currentStep === getFinalStep() ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar evaluación'}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={saving}
              className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Siguiente'}
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs text-zinc-500 text-center">
            Evaluación de Desempeño {evaluation.period?.year} — Evaluando a: {employeeInfo?.first_name} {employeeInfo?.last_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
