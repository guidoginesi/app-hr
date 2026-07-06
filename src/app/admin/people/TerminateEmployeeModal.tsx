'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

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
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" flush title="Registrar baja" className="max-w-lg">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger-subtle">
              <svg className="h-5 w-5 text-[var(--red-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="type-title">Registrar baja</h2>
              <p className="text-sm text-muted-foreground">
                {employee.first_name} {employee.last_name}
              </p>
            </div>
            <SheetClose
              aria-label="Cerrar"
              className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {error && (
                <div className="rounded-lg bg-danger-subtle p-4 text-sm text-[var(--red-600)]">
                  {error}
                </div>
              )}

              {/* Termination Date */}
              <div>
                <label htmlFor="terminationDate" className="block text-sm font-medium text-secondary-foreground">
                  Fecha de baja <span className="text-[var(--red-600)]">*</span>
                </label>
                <input
                  type="date"
                  id="terminationDate"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Termination Reason */}
              <div>
                <label htmlFor="terminationReason" className="block text-sm font-medium text-secondary-foreground">
                  Motivo <span className="text-[var(--red-600)]">*</span>
                </label>
                <SelectMenu
                  ariaLabel="Motivo"
                  className="mt-1 w-full"
                  value={terminationReason}
                  onChange={(v) => setTerminationReason(v as TerminationReason)}
                  options={[
                    { value: 'resignation', label: 'Renuncia' },
                    { value: 'dismissal', label: 'Despido' },
                  ]}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="terminationNotes" className="block text-sm font-medium text-secondary-foreground">
                  Notas <span className="text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  id="terminationNotes"
                  value={terminationNotes}
                  onChange={(e) => setTerminationNotes(e.target.value)}
                  rows={3}
                  placeholder="Información adicional sobre la baja..."
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Enable Offboarding */}
              <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOffboarding}
                    onChange={(e) => setEnableOffboarding(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-foreground focus:ring-ring"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Habilitar encuesta de salida
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      El empleado podrá completar una encuesta de offboarding desde el portal
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning */}
              <div className="rounded-lg bg-warning-subtle border border-warning/30 p-4">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-[var(--amber-600)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[var(--amber-600)]">
                      Esta acción cambiará el estado del empleado a "Desvinculado"
                    </p>
                    <p className="mt-1 text-xs text-[var(--amber-600)]">
                      El empleado perderá acceso al portal excepto a la encuesta de salida (si está habilitada)
                    </p>
                  </div>
                </div>
              </div>
            </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" loading={isSubmitting}>
              Confirmar baja
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
