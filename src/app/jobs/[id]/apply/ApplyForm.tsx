'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert } from '@pow/ui/components/ui/alert';
import { Button } from '@pow/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pow/ui/components/ui/card';
import { Input } from '@pow/ui/components/ui/input';
import { Select } from '@pow/ui/components/ui/select';
import { FileField } from '../../FileField';

interface ApplyFormProps {
  jobId: string;
  jobTitle: string;
}

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

    // El input de archivo no lleva `required` (está oculto detrás del botón del
    // DS y el navegador no puede enfocarlo para avisar), así que se valida acá.
    const file = formData.get('resume');
    if (!(file instanceof File) || file.size === 0) {
      setError('Adjuntá tu CV para poder postularte.');
      return;
    }

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="jobId" value={jobId} />

      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>Completá la información a continuación.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información adicional</CardTitle>
          <CardDescription>Opcional, pero nos ayuda a conocerte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <FileField
            id="resume"
            name="resume"
            label="CV / Currículum"
            required
            accept=".pdf,.doc,.docx,.txt"
            helper="PDF o Word, hasta 10MB."
          />
        </CardContent>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
        <Button type="submit" loading={isPending} className="w-full sm:w-auto">
          Enviar postulación
        </Button>
      </div>
    </form>
  );
}
