'use client';

import { useState } from 'react';
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Encuesta de Salida</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tu encuesta de salida no está disponible
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">Encuesta no habilitada</h3>
          <p className="mt-2 text-sm text-zinc-500">
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Encuesta de Salida</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {employee.firstName}, gracias por completar la encuesta
          </p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-green-900">Encuesta enviada</h3>
          <p className="mt-2 text-sm text-green-700">
            Gracias por tomarte el tiempo de completar nuestra encuesta de salida.
            Tu feedback es muy valioso para nosotros y nos ayudará a mejorar.
          </p>
          {submittedDate && (
            <p className="mt-4 text-xs text-green-600">
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

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Te deseamos lo mejor</h2>
          <p className="text-sm text-zinc-600">
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Encuesta de Salida</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {employee.firstName}, nos gustaría conocer tu experiencia en la empresa
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Tu feedback es importante para nosotros
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Esta encuesta es confidencial y nos ayudará a mejorar como organización.
              Tus respuestas serán tratadas de forma anónima.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200">
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar encuesta'}
          </button>
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
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
          {index}
        </span>
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-900">
            {question.label}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {question.description && (
            <p className="mt-1 text-xs text-zinc-500">{question.description}</p>
          )}

          <div className="mt-3">
            {question.type === 'text' && (
              <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            )}

            {question.type === 'textarea' && (
              <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
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
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => onChange(false)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    value === false
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
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
                        ? 'border-zinc-900 bg-zinc-50'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      checked={value === option.value}
                      onChange={() => onChange(option.value)}
                      className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span className="text-sm text-zinc-700">{option.label}</span>
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
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
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
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      <span className="text-sm text-zinc-700">{option.label}</span>
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
