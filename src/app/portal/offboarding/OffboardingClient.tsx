'use client';

import { useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { OFFBOARDING_QUESTIONS, type OffboardingQuestion } from '@/config/offboardingQuestions';

type OffboardingClientProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    terminationDate: string | null;
    offboardingEnabled: boolean;
    offboardingCompletedAt: string | null;
  };
  offboardingResponse: {
    id: string;
    status: string;
    responses: Record<string, any>;
    submitted_at: string | null;
  } | null;
};

export function OffboardingClient({ employee, offboardingResponse }: OffboardingClientProps) {
  const [responses, setResponses] = useState<Record<string, any>>(
    offboardingResponse?.responses || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(
    offboardingResponse?.status === 'submitted' || !!employee.offboardingCompletedAt
  );

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/portal/offboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar la encuesta');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If offboarding is not enabled
  if (!employee.offboardingEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Encuesta de Salida" description="Tu encuesta de salida no está disponible" />

        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Encuesta no habilitada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            La encuesta de salida no ha sido habilitada para tu cuenta.<br />
            Si crees que esto es un error, contacta al equipo de Recursos Humanos.
          </p>
        </div>
      </div>
    );
  }

  // If already submitted
  if (isSubmitted) {
    const submittedDate = offboardingResponse?.submitted_at || employee.offboardingCompletedAt;
    return (
      <div className="space-y-6">
        <PageHeader title="Encuesta de Salida" description={`${employee.firstName}, gracias por completar la encuesta`} />

        <div className="rounded-xl border border-brand bg-success-subtle p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--green-700)]">Encuesta enviada</h3>
          <p className="mt-2 text-sm text-[var(--green-700)]">
            Gracias por tomarte el tiempo de completar nuestra encuesta de salida.
            Tu feedback es muy valioso para nosotros y nos ayudará a mejorar.
          </p>
          {submittedDate && (
            <p className="mt-4 text-xs text-[var(--green-700)]">
              Enviada el {new Date(submittedDate).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Te deseamos lo mejor</h2>
          <p className="text-sm text-muted-foreground">
            Esperamos que tu experiencia con nosotros haya sido positiva y te deseamos mucho éxito
            en tus futuros proyectos. Las puertas siempre estarán abiertas.
          </p>
        </div>
      </div>
    );
  }

  // Show the survey form
  return (
    <div className="space-y-6">
      <PageHeader title="Encuesta de Salida" description={`${employee.firstName}, nos gustaría conocer tu experiencia en la empresa`} />

      <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 text-[var(--amber-600)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[var(--amber-600)]">
              Tu feedback es importante para nosotros
            </p>
            <p className="mt-1 text-xs text-[var(--amber-600)]">
              Esta encuesta es confidencial y nos ayudará a mejorar como organización.
              Tus respuestas serán tratadas de forma anónima.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-danger-subtle p-4 text-sm text-[var(--red-600)]">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
          {OFFBOARDING_QUESTIONS.map((question, index) => (
            <QuestionField
              key={question.id}
              question={question}
              value={responses[question.id]}
              onChange={(value) => handleResponseChange(question.id, value)}
              index={index + 1}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>
            Enviar encuesta
          </Button>
        </div>
      </form>
    </div>
  );
}

// Question field component
function QuestionField({
  question,
  value,
  onChange,
  index,
}: {
  question: OffboardingQuestion;
  value: any;
  onChange: (value: any) => void;
  index: number;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
          {index}
        </span>
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-[var(--red-600)] ml-1">*</span>}
          </label>
          {question.description && (
            <p className="mt-1 text-xs text-muted-foreground">{question.description}</p>
          )}

          <div className="mt-3">
            {question.type === 'text' && (
              <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}

            {question.type === 'textarea' && (
              <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}

            {question.type === 'rating_1_5' && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => onChange(rating)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                      value === rating
                        ? 'border-foreground bg-foreground text-white'
                        : 'border-[var(--border)] bg-white text-secondary-foreground hover:border-[var(--border)] hover:bg-muted'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'yes_no' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onChange(true)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    value === true
                      ? 'border-brand bg-success-subtle text-[var(--green-700)]'
                      : 'border-[var(--border)] bg-white text-secondary-foreground hover:border-[var(--border)] hover:bg-muted'
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => onChange(false)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    value === false
                      ? 'border-danger/30 bg-danger-subtle text-[var(--red-600)]'
                      : 'border-[var(--border)] bg-white text-secondary-foreground hover:border-[var(--border)] hover:bg-muted'
                  }`}
                >
                  No
                </button>
              </div>
            )}

            {question.type === 'single_select' && question.options && (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      value === option.value
                        ? 'border-foreground bg-muted'
                        : 'border-[var(--border)] hover:border-[var(--border)] hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      checked={value === option.value}
                      onChange={() => onChange(option.value)}
                      className="h-4 w-4 border-[var(--border)] text-foreground focus:ring-ring"
                    />
                    <span className="text-sm text-secondary-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'multi_select' && question.options && (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const selected = Array.isArray(value) && value.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        selected
                          ? 'border-foreground bg-muted'
                          : 'border-[var(--border)] hover:border-[var(--border)] hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const currentValue = Array.isArray(value) ? value : [];
                          if (e.target.checked) {
                            onChange([...currentValue, option.value]);
                          } else {
                            onChange(currentValue.filter((v: string) => v !== option.value));
                          }
                        }}
                        className="h-4 w-4 rounded border-[var(--border)] text-foreground focus:ring-ring"
                      />
                      <span className="text-sm text-secondary-foreground">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
