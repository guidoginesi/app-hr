'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScaleInput } from '@/components/evaluations/ScaleInput';
import { ProgressBar } from '@/components/evaluations/ProgressBar';
import { Button } from '@pow/ui/components/ui/button';
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
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Autoevaluación</h1>
              <p className="text-sm text-muted-foreground">{evaluation.period?.name}</p>
            </div>
            <button
              onClick={() => router.push('/portal/evaluaciones')}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-muted"
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
          <div className="mb-6 rounded-lg bg-danger-subtle p-4 text-sm text-[var(--red-600)]">{error}</div>
        )}

        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-white p-8">
              <h2 className="text-xl font-semibold text-foreground">Instrucciones</h2>
              <div className="mt-6 space-y-4 text-muted-foreground">
                <p>A continuación completarás tu autoevaluación de desempeño para el período {evaluation.period?.year}.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Respondé con honestidad, basándote en hechos concretos.</li>
                  <li>Considerá todo el período: Enero - Diciembre {evaluation.period?.year}.</li>
                  <li>Tu progreso se guarda automáticamente.</li>
                  <li>Podés salir y continuar en cualquier momento.</li>
                </ul>
              </div>
              
              <div className="mt-8 p-4 rounded-lg bg-secondary border border-[var(--border)]">
                <h3 className="text-sm font-semibold text-foreground mb-3">Escala de evaluación</h3>
                <div className="space-y-2">
                  {SCALE_DEFINITIONS.map((def) => (
                    <div key={def.min} className="flex items-center gap-2">
                      <span className="w-10 text-sm font-semibold text-foreground">{def.min}-{def.max}</span>
                      <span className="text-sm text-foreground">{def.label}</span>
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
            <div className="rounded-xl border border-[var(--border)] bg-white p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
                  {currentDimensionIndex + 1}
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{currentDimension.name}</h2>
                  {currentDimension.description && (
                    <p className="text-sm text-muted-foreground">{currentDimension.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {currentDimension.items.map((item, idx) => (
                  <div key={item.id} className={`space-y-4 p-4 rounded-lg border ${
                    !responses[item.id]?.score && error?.includes('puntuación')
                      ? 'bg-danger-subtle border-danger/20'
                      : 'bg-muted border-[var(--border)]'
                  }`}>
                    <p className="font-medium text-secondary-foreground">
                      {idx + 1}. {item.statement}
                    </p>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Puntuación <span className="text-[var(--red-600)]">*</span></span>
                        {!responses[item.id]?.score && error?.includes('puntuación') && (
                          <span className="text-xs text-[var(--red-600)]">Requerido</span>
                        )}
                      </div>
                      <ScaleInput
                        value={responses[item.id]?.score || null}
                        onChange={(score) => handleResponseChange(item.id, 'score', score)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Explicá tu puntuación <span className="text-[var(--red-600)]">*</span>
                      </label>
                      <textarea
                        value={responses[item.id]?.explanation || ''}
                        onChange={(e) => handleResponseChange(item.id, 'explanation', e.target.value)}
                        rows={2}
                        required
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] ${
                          responses[item.id]?.score && !responses[item.id]?.explanation?.trim() 
                            ? 'border-danger/20 bg-danger-subtle' 
                            : 'border-[var(--border)]'
                        }`}
                        placeholder="Comentarios o ejemplos (obligatorio)..."
                      />
                      {responses[item.id]?.score && !responses[item.id]?.explanation?.trim() && (
                        <p className="mt-1 text-xs text-[var(--red-600)]">Este campo es obligatorio</p>
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
            <div className="rounded-xl border border-[var(--border)] bg-white p-8">
              <h2 className="text-xl font-semibold text-foreground mb-6">Preguntas abiertas</h2>
              
              <div className="space-y-6">
                {selfOpenQuestions.map((q) => (
                  <div key={q.key} className="space-y-2">
                    <label className="block text-sm font-medium text-secondary-foreground">
                      {q.label}
                    </label>
                    <textarea
                      value={openQuestions[q.key] || ''}
                      onChange={(e) => handleOpenQuestionChange(q.key, e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
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
            <div className="rounded-xl border border-[var(--border)] bg-white p-8">
              <h2 className="text-xl font-semibold text-foreground mb-6">Revisión y envío</h2>
              
              {(() => {
                const { dimensionScores, totalScore } = calculateScores();
                return (
                  <>
                    <div className="mb-8 p-6 rounded-lg bg-secondary border border-[var(--border)] text-center">
                      <p className="text-sm font-medium text-foreground">Puntaje total</p>
                      <p className="text-4xl font-bold text-foreground mt-2">
                        {totalScore.toFixed(1)}<span className="text-lg text-foreground">/10</span>
                      </p>
                    </div>

                    <h3 className="text-sm font-semibold text-secondary-foreground mb-4">Puntaje por dimensión</h3>
                    <div className="space-y-3 mb-8">
                      {dimensions.map((dim) => {
                        const score = dimensionScores[dim.id];
                        return (
                          <div key={dim.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                            <span className="text-sm text-secondary-foreground">{dim.name}</span>
                            <span className="text-sm font-semibold text-foreground">
                              {score ? score.toFixed(1) : '-'}/10
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              <div className="border-t border-[var(--border)] pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Una vez enviada la evaluación no podrás modificarla. ¿Estás seguro de enviar?
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={goPrev}
            disabled={currentStep === 'instructions' || saving}
          >
            Anterior
          </Button>

          {currentStep === 'review' ? (
            <Button size="lg" onClick={handleSubmit} loading={submitting}>
              Enviar evaluación
            </Button>
          ) : (
            <Button size="lg" onClick={goNext} loading={saving}>
              Siguiente
            </Button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white py-4">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs text-muted-foreground text-center">
            Evaluación de Desempeño {evaluation.period?.year} — {employee.first_name} {employee.last_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
