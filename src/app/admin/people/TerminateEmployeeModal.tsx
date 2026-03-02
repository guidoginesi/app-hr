'use client';

import { useState } from 'react';

type TerminateEmployeeModalProps = {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    personal_email: string;
  };
  onClose: () => void;
  onSuccess: (updatedEmployee: any) => void;
};

type TerminationReason = 'resignation' | 'dismissal';

const reasonLabels: Record<TerminationReason, string> = {
  resignation: 'Renuncia',
  dismissal: 'Despido',
};

export function TerminateEmployeeModal({ employee, onClose, onSuccess }: TerminateEmployeeModalProps) {
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('resignation');
  const [terminationNotes, setTerminationNotes] = useState('');
  const [enableOffboarding, setEnableOffboarding] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termination_date: terminationDate,
          termination_reason: terminationReason,
          termination_notes: terminationNotes || null,
          enable_offboarding: enableOffboarding,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la baja');
      }

      onSuccess(data.employee);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Registrar baja</h2>
                <p className="text-sm text-zinc-500">
                  {employee.first_name} {employee.last_name}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
                  {error}
                </div>
              )}

              {/* Termination Date */}
              <div>
                <label htmlFor="terminationDate" className="block text-sm font-medium text-zinc-700">
                  Fecha de baja <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="terminationDate"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Termination Reason */}
              <div>
                <label htmlFor="terminationReason" className="block text-sm font-medium text-zinc-700">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <select
                  id="terminationReason"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value as TerminationReason)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="resignation">Renuncia</option>
                  <option value="dismissal">Despido</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="terminationNotes" className="block text-sm font-medium text-zinc-700">
                  Notas <span className="text-zinc-400">(opcional)</span>
                </label>
                <textarea
                  id="terminationNotes"
                  value={terminationNotes}
                  onChange={(e) => setTerminationNotes(e.target.value)}
                  rows={3}
                  placeholder="Información adicional sobre la baja..."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Enable Offboarding */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOffboarding}
                    onChange={(e) => setEnableOffboarding(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-900">
                      Habilitar encuesta de salida
                    </span>
                    <p className="mt-1 text-xs text-zinc-500">
                      El empleado podrá completar una encuesta de offboarding desde el portal
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Esta acción cambiará el estado del empleado a "Desvinculado"
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      El empleado perderá acceso al portal excepto a la encuesta de salida (si está habilitada)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Registrando...' : 'Confirmar baja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
