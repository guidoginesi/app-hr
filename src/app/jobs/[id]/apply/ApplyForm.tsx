'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface ApplyFormProps {
  jobId: string;
  jobTitle: string;
}

export function ApplyForm({ jobId, jobTitle }: ApplyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salaryDisplay, setSalaryDisplay] = useState<string>('');
  
  // Formatear expectativa salarial mientras escribe
  function handleSalaryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // Remover todo excepto números
    const onlyNumbers = value.replace(/\D/g, '');
    
    if (onlyNumbers === '') {
      setSalaryDisplay('');
      return;
    }
    
    // Formatear con separadores de miles
    const formatted = new Intl.NumberFormat('es-AR').format(parseInt(onlyNumbers));
    setSalaryDisplay(formatted);
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
    } catch (err) {
      setError('Error al enviar la aplicación. Por favor intenta nuevamente.');
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-8">
        <input type="hidden" name="jobId" value={jobId} />

      {/* My information */}
      <section>
        <h2 className="mb-2 text-xl font-bold text-zinc-900">Mi información</h2>
        <p className="mb-6 text-sm text-zinc-600">Completá la información a continuación</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-zinc-900">
              Nombre completo *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Nombre completo"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-900">
              Dirección de email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Tu dirección de email"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-zinc-900">
              Número de teléfono *
            </label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5">
                <span className="text-sm text-zinc-600">🇦🇷</span>
                <span className="text-sm font-medium text-zinc-900">Argentina</span>
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+54"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label htmlFor="provincia" className="mb-1.5 block text-sm font-medium text-zinc-900">
              Provincia *
            </label>
            <select
              id="provincia"
              name="provincia"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="">Seleccionar provincia</option>
              <option value="CABA">CABA</option>
              <option value="GBA">GBA</option>
              <option value="OTRA">Otra</option>
            </select>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section>
        <h2 className="mb-2 text-xl font-bold text-zinc-900">Información adicional</h2>
        <p className="mb-6 text-sm text-zinc-600">Completá la información adicional</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="linkedinUrl" className="mb-1.5 block text-sm font-medium text-zinc-900">
              Perfil de LinkedIn (URL)
            </label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/tuperfil"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>
      </section>

      {/* Salary Expectation */}
      <section>
        <label htmlFor="salaryExpectation" className="mb-1.5 block text-sm font-medium text-zinc-900">
          ¿Cuál es tu expectativa salarial mensual neta (mano)?
        </label>
        <input
          id="salaryExpectation"
          name="salaryExpectation"
          type="text"
          value={salaryDisplay}
          onChange={handleSalaryChange}
          placeholder="Ej: 1.500.000"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        />
      </section>

      {/* CV Upload */}
      <section>
        <label htmlFor="resume" className="mb-1.5 block text-sm font-medium text-zinc-900">
          CV / Currículum *
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          required
          accept=".pdf,.doc,.docx,.txt"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        />
      </section>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="text-xs text-zinc-500">
        Todos los campos marcados con * son obligatorios.
      </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-black px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending && (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {isPending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

