'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AiTrainingCycle, AiTrainingSession } from '@/types/entrenamiento-ia';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

type Props = {
  cycles: AiTrainingCycle[];
  sessions: AiTrainingSession[];
  selectedCycleId: string | null;
};

export function SessionsClient({ cycles, sessions, selectedCycleId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cycleSessions = sessions
    .filter((s) => s.cycle_id === selectedCycleId)
    .sort((a, b) => b.session_date.localeCompare(a.session_date));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId || !title.trim() || !sessionDate) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/entrenamiento-ia/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: selectedCycleId,
          title: title.trim(),
          session_date: sessionDate,
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear sesión');

      setTitle('');
      setSessionDate('');
      setDescription('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    router.push(`/admin/entrenamiento-ia/sessions?cycle_id=${cycleId}`);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Ciclo</label>
        <SelectMenu
          ariaLabel="Ciclo"
          className="w-full"
          value={selectedCycleId ?? ''}
          onChange={handleCycleChange}
          options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
        />
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm space-y-4 max-w-xl">
        <h3 className="text-sm font-semibold text-foreground">Nueva sesión</h3>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Ej. Introducción a prompts"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}
        <Button type="submit" loading={saving} disabled={!selectedCycleId}>
          Crear sesión
        </Button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Sesiones del ciclo ({cycleSessions.length})
          </h3>
        </div>
        {cycleSessions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No hay sesiones en este ciclo.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {cycleSessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{session.title}</p>
                  <p className="text-xs text-muted-foreground">{session.session_date}</p>
                  {session.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
                  )}
                </div>
                <a
                  href={`/admin/entrenamiento-ia/puntuacion?cycle_id=${selectedCycleId}&session_id=${session.id}`}
                  className="shrink-0 text-sm font-medium text-accent-foreground hover:underline"
                >
                  Cargar puntos →
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
