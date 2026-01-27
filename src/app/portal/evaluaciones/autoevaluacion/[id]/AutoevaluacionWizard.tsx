'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScaleInput } from '@/components/evaluations/ScaleInput';
import { ProgressBar } from '@/components/evaluations/ProgressBar';
import { SELF_OPEN_QUESTIONS, SCALE_DEFINITIONS, calculateDimensionScore, calculateTotalScore } from '@/types/evaluation';
import type { Employee } from '@/types/employee';
import type { Evaluation, EvaluationDimension, EvaluationItem, EvaluationResponse, EvaluationOpenQuestion } from '@/types/evaluation';

type OpenQuestionConfigItem = {
  question_key: string;
  label_self: string;
  label_leader: string;
  description: string | null;
};

type AutoevaluacionWizardProps = {
  evaluation: Evaluation & { period: any };
  dimensions: (EvaluationDimension & { items: EvaluationItem[] })[];
  initialResponses: EvaluationResponse[];
  initialOpenQuestions: EvaluationOpenQuestion[];
  openQuestionConfig?: OpenQuestionConfigItem[];
  employee: Employee;
};

type Step = 'instructions' | `dimension_${number}` | 'open_questions' | 'review';

export function AutoevaluacionWizard({
  evaluation,
  dimensions,
  initialResponses,
  initialOpenQuestions,
  openQuestionConfig,
  employee,
}: AutoevaluacionWizardProps) {
  // Use configured questions if available, fallback to hardcoded
  const selfOpenQuestions = openQuestionConfig && openQuestionConfig.length > 0
    ? openQuestionConfig.map(q => ({ key: q.question_key, label: q.label_self }))
    : SELF_OPEN_QUESTIONS;
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(evaluation.current_step === 0 ? 'instructions' : `dimension_${Math.min(evaluation.current_step, dimensions.length)}`);
  const [responses, setResponses] = useState<Record<string, { score: number | null; explanation: string }>>(
    initialResponses.reduce((acc, r) => ({
      ...acc,
      [r.item_id]: { score: r.score, explanation: r.explanation || '' }
    }), {})
  );
  const [openQuestions, setOpenQuestions] = useState<Record<string, string>>(
    initialOpenQuestions.reduce((acc, q) => ({ ...acc, [q.question_key]: q.response || '' }), {})
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = dimensions.length + 2; // instructions + dimensions + open_questions + (review is final)
  
  const getCurrentStepNumber = (): number => {
    if (currentStep === 'instructions') return 1;
    if (currentStep === 'open_questions') return dimensions.length + 2;
    if (currentStep === 'review') return dimensions.length + 2;
    const dimIndex = parseInt(currentStep.split('_')[1]) || 1;
    return dimIndex + 1;
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

  // Handle response change with debounced auto-save
  const handleResponseChange = (itemId: string, field: 'score' | 'explanation', value: number | string) => {
    setResponses(prev => {
      const current = prev[itemId] || { score: null, explanation: '' };
      const updated = { ...current, [field]: value };
      
      // Auto-save
      setTimeout(() => {
        saveResponse(itemId, updated.score, updated.explanation);
      }, 500);
      
      return { ...prev, [itemId]: updated };
    });
  };

  // Handle open question change with debounced auto-save
  const handleOpenQuestionChange = (key: string, value: string) => {
    setOpenQuestions(prev => {
      setTimeout(() => {
        saveOpenQuestion(key, value);
      }, 500);
      return { ...prev, [key]: value };
    });
  };

  // Navigation
  const goToStep = async (step: Step) => {
    setSaving(true);
    try {
      const stepNumber = step === 'instructions' ? 0 : 
        step === 'open_questions' ? dimensions.length + 1 :
        step === 'review' ? dimensions.length + 2 :
        parseInt(step.split('_')[1]) || 0;
      
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

  // Validate current dimension has all scores and explanations filled
  const validateCurrentDimension = (): { valid: boolean; missingScore: boolean; missingExplanation: boolean } => {
    if (!currentDimension) return { valid: true, missingScore: false, missingExplanation: false };
    
    let missingScore = false;
    let missingExplanation = false;
    
    for (const item of currentDimension.items) {
      const response = responses[item.id];
      if (!response?.score) {
        missingScore = true;
      }
      if (response?.score && !response?.explanation?.trim()) {
        missingExplanation = true;
      }
    }
    
    return { 
      valid: !missingScore && !missingExplanation, 
      missingScore, 
      missingExplanation 
    };
  };

  const goNext = () => {
    if (currentStep === 'instructions') {
      goToStep('dimension_1');
    } else if (currentStep.startsWith('dimension_')) {
      // Validate scores and explanations before advancing
      const validation = validateCurrentDimension();
      if (!validation.valid) {
        if (validation.missingScore) {
          setError('Por favor seleccioná una puntuación para todas las afirmaciones antes de continuar.');
        } else if (validation.missingExplanation) {
          setError('Por favor completá la explicación de todas las respuestas antes de continuar.');
        }
        return;
      }
      setError(null);
      
      const dimIndex = parseInt(currentStep.split('_')[1]);
      if (dimIndex < dimensions.length) {
        goToStep(`dimension_${dimIndex + 1}`);
      } else {
        goToStep('open_questions');
      }
    } else if (currentStep === 'open_questions') {
      goToStep('review');
    }
  };

  const goPrev = () => {
    if (currentStep === 'review') {
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
    }
  };

  // Submit evaluation
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/evaluations/${evaluation.id}/submit`, {
        method: 'POST',
      });
      
      if (res.ok) {
        router.push('/portal/evaluaciones/resultados');
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

  // Calculate scores for review
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

  const currentDimensionIndex = currentStep.startsWith('dimension_') ? parseInt(currentStep.split('_')[1]) - 1 : -1;
  const currentDimension = currentDimensionIndex >= 0 ? dimensions[currentDimensionIndex] : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Autoevaluación</h1>
              <p className="text-sm text-zinc-500">{evaluation.period?.name}</p>
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

        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-zinc-900">Instrucciones</h2>
              <div className="mt-6 space-y-4 text-zinc-600">
                <p>A continuación completarás tu autoevaluación de desempeño para el período {evaluation.period?.year}.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Respondé con honestidad, basándote en hechos concretos.</li>
                  <li>Considerá todo el período: Enero - Diciembre {evaluation.period?.year}.</li>
                  <li>Tu progreso se guarda automáticamente.</li>
                  <li>Podés salir y continuar en cualquier momento.</li>
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
                  <div key={item.id} className={`space-y-4 p-4 rounded-lg border ${
                    !responses[item.id]?.score && error?.includes('puntuación')
                      ? 'bg-red-50 border-red-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}>
                    <p className="font-medium text-zinc-800">
                      {idx + 1}. {item.statement}
                    </p>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-zinc-500">Puntuación <span className="text-red-500">*</span></span>
                        {!responses[item.id]?.score && error?.includes('puntuación') && (
                          <span className="text-xs text-red-500">Requerido</span>
                        )}
                      </div>
                      <ScaleInput
                        value={responses[item.id]?.score || null}
                        onChange={(score) => handleResponseChange(item.id, 'score', score)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        Explicá tu puntuación <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={responses[item.id]?.explanation || ''}
                        onChange={(e) => handleResponseChange(item.id, 'explanation', e.target.value)}
                        rows={2}
                        required
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 ${
                          responses[item.id]?.score && !responses[item.id]?.explanation?.trim() 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-zinc-300'
                        }`}
                        placeholder="Comentarios o ejemplos (obligatorio)..."
                      />
                      {responses[item.id]?.score && !responses[item.id]?.explanation?.trim() && (
                        <p className="mt-1 text-xs text-red-500">Este campo es obligatorio</p>
                      )}
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
                {selfOpenQuestions.map((q) => (
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

        {/* Review Step */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-zinc-900 mb-6">Revisión y envío</h2>
              
              {(() => {
                const { dimensionScores, totalScore } = calculateScores();
                return (
                  <>
                    <div className="mb-8 p-6 rounded-lg bg-purple-50 border border-purple-200 text-center">
                      <p className="text-sm font-medium text-purple-700">Puntaje total</p>
                      <p className="text-4xl font-bold text-purple-900 mt-2">
                        {totalScore.toFixed(1)}<span className="text-lg text-purple-600">/10</span>
                      </p>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-700 mb-4">Puntaje por dimensión</h3>
                    <div className="space-y-3 mb-8">
                      {dimensions.map((dim) => {
                        const score = dimensionScores[dim.id];
                        return (
                          <div key={dim.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50">
                            <span className="text-sm text-zinc-700">{dim.name}</span>
                            <span className="text-sm font-semibold text-zinc-900">
                              {score ? score.toFixed(1) : '-'}/10
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              <div className="border-t border-zinc-200 pt-6">
                <p className="text-sm text-zinc-500 mb-4">
                  Una vez enviada la evaluación no podrás modificarla. ¿Estás seguro de enviar?
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentStep === 'instructions' || saving}
            className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Anterior
          </button>
          
          {currentStep === 'review' ? (
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
            Evaluación de Desempeño {evaluation.period?.year} — {employee.first_name} {employee.last_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
