'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert } from '@pow/ui/components/ui/alert';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Select } from '@pow/ui/components/ui/select';

interface ApplyFormProps {
  jobId: string;
  jobTitle: string;
}

/** Estilo del input de archivo: no hay componente de DS para file. */
const fileInputClass =
  'w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--gray-300)] file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function ApplyForm({ jobId }: ApplyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salaryDisplay, setSalaryDisplay] = useState<string>('');

  // Formatear expectativa salarial mientras escribe
  function handleSalaryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const onlyNumbers = e.target.value.replace(/\D/g, '');
    if (onlyNumbers === '') {
      setSalaryDisplay('');
      return;
    }
    setSalaryDisplay(new Intl.NumberFormat('es-AR').format(parseInt(onlyNumbers)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Asegurarse de enviar solo números para salary
    const salaryValue = salaryDisplay.replace(/\D/g, '');
    if (salaryValue) {
      formData.set('salaryExpectation', salaryValue);
    }

    try {
      const response = await fetch('/api/candidates', {
        method: 'POST',
        body: formData,
      });

      if (response.redirected) {
        const url = new URL(response.url);
        if (url.searchParams.get('error') === 'already_applied') {
          setError('Ya te postulaste para este puesto');
          return;
        }
        startTransition(() => {
          router.push('/jobs?submitted=1');
        });
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Error al enviar la aplicación');
        return;
      }

      startTransition(() => {
        router.push('/jobs?submitted=1');
      });
    } catch {
      setError('Error al enviar la aplicación. Por favor intenta nuevamente.');
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
      <form onSubmit={handleSubmit} className="space-y-8">
        <input type="hidden" name="jobId" value={jobId} />

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mi información</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Completá la información a continuación.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="name" name="name" label="Nombre completo" required placeholder="Nombre y apellido" />
            <Input
              id="email"
              name="email"
              type="email"
              label="Dirección de email"
              required
              placeholder="tu@mail.com"
            />

            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-sm font-medium text-secondary-foreground">
                Número de teléfono
                <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              </label>
              <div className="flex gap-2">
                <span className="inline-flex h-9 shrink-0 items-center rounded-[var(--radius)] border border-input bg-muted px-3 text-sm text-muted-foreground">
                  🇦🇷 +54
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="11 5555 5555"
                  className="h-9 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-[var(--gray-300)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <Select
              id="provincia"
              name="provincia"
              label="Provincia"
              required
              defaultValue=""
              placeholder="Seleccionar provincia"
              options={[
                { value: 'CABA', label: 'CABA' },
                { value: 'GBA', label: 'GBA' },
                { value: 'OTRA', label: 'Otra' },
              ]}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Información adicional</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Opcional, pero nos ayuda a conocerte.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              label="Perfil de LinkedIn"
              placeholder="https://linkedin.com/in/tuperfil"
            />
            <Input
              id="salaryExpectation"
              name="salaryExpectation"
              label="Expectativa salarial mensual neta"
              value={salaryDisplay}
              onChange={handleSalaryChange}
              placeholder="Ej: 1.500.000"
              inputMode="numeric"
            />
          </div>
        </section>

        <section className="space-y-1.5">
          <label htmlFor="resume" className="block text-sm font-medium text-secondary-foreground">
            CV / Currículum
            <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
          </label>
          <input
            id="resume"
            name="resume"
            type="file"
            required
            accept=".pdf,.doc,.docx,.txt"
            className={fileInputClass}
          />
        </section>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
          <Button
            type="submit"
            variant="brand"
            size="lg"
            loading={isPending}
            className="w-full sm:w-auto"
          >
            Enviar postulación
          </Button>
        </div>
      </form>
    </div>
  );
}
