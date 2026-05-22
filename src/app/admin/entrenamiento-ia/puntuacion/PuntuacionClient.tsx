'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AiTrainingCycle, AiTrainingSession } from '@/types/entrenamiento-ia';
import { calculateSessionPoints } from '@/types/entrenamiento-ia';

type ScoreRow = {
  employee_id: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  attended: boolean;
  camera_on: boolean;
  participation_count: number;
  exam_score: number | '';
  activity_on_time: boolean;
  manual_adjustment: number;
  notes: string;
  total_points: number;
  hasExisting: boolean;
};

type Props = {
  cycles: AiTrainingCycle[];
  sessions: AiTrainingSession[];
  selectedCycleId: string | null;
  selectedSessionId: string | null;
};

function emptyScoreRow(emp: {
  employee_id: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
}): ScoreRow {
  return {
    ...emp,
    attended: false,
    camera_on: false,
    participation_count: 0,
    exam_score: '',
    activity_on_time: false,
    manual_adjustment: 0,
    notes: '',
    total_points: 0,
    hasExisting: false,
  };
}

function computePoints(row: ScoreRow) {
  return calculateSessionPoints({
    attended: row.attended,
    camera_on: row.camera_on,
    participation_count: row.participation_count,
    exam_score: row.exam_score === '' ? null : Number(row.exam_score),
    activity_on_time: row.activity_on_time,
    manual_adjustment: row.manual_adjustment,
  });
}

export function PuntuacionClient({ cycles, sessions, selectedCycleId, selectedSessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const cycleSessions = useMemo(
    () => sessions.filter((s) => s.cycle_id === selectedCycleId),
    [sessions, selectedCycleId]
  );

  const loadScores = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/entrenamiento-ia/scores?session_id=${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar puntajes');

      const mapped: ScoreRow[] = (data.rows ?? []).map((item: any) => {
        const base = emptyScoreRow({
          employee_id: item.employee_id,
          first_name: item.first_name,
          last_name: item.last_name,
          department_name: item.department_name,
        });
        if (!item.score) return base;
        const s = item.score;
        const row: ScoreRow = {
          ...base,
          attended: s.attended,
          camera_on: s.camera_on,
          participation_count: s.participation_count ?? 0,
          exam_score: s.exam_score ?? '',
          activity_on_time: s.activity_on_time,
          manual_adjustment: s.manual_adjustment ?? 0,
          notes: s.notes ?? '',
          total_points: s.total_points ?? 0,
          hasExisting: true,
        };
        row.total_points = computePoints(row);
        return row;
      });
      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) loadScores(selectedSessionId);
    else setRows([]);
  }, [selectedSessionId, loadScores]);

  const updateParams = (cycleId?: string, sessionId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cycleId) params.set('cycle_id', cycleId);
    if (sessionId) params.set('session_id', sessionId);
    else params.delete('session_id');
    router.push(`/admin/entrenamiento-ia/puntuacion?${params.toString()}`);
  };

  const updateRow = (employeeId: string, patch: Partial<ScoreRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.employee_id !== employeeId) return row;
        const next = { ...row, ...patch };
        next.total_points = computePoints(next);
        return next;
      })
    );
  };

  const filteredRows = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${row.first_name} ${row.last_name}`.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!selectedSessionId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = rows
        .filter(
          (row) =>
            row.hasExisting ||
            row.attended ||
            row.camera_on ||
            row.participation_count > 0 ||
            row.exam_score !== '' ||
            row.activity_on_time ||
            row.manual_adjustment !== 0 ||
            row.notes.trim()
        )
        .map((row) => ({
          employee_id: row.employee_id,
          attended: row.attended,
          camera_on: row.camera_on,
          participation_count: row.participation_count,
          exam_score: row.exam_score === '' ? null : Number(row.exam_score),
          activity_on_time: row.activity_on_time,
          manual_adjustment: row.manual_adjustment,
          notes: row.notes.trim() || null,
        }));

      const res = await fetch('/api/admin/entrenamiento-ia/scores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedSessionId, scores: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setMessage(`Puntajes guardados (${payload.length} empleado${payload.length !== 1 ? 's' : ''})`);
      await loadScores(selectedSessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Cargar puntos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Asigná o corregí el puntaje de cada colaborador por sesión
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Ciclo</label>
          <select
            value={selectedCycleId ?? ''}
            onChange={(e) => updateParams(e.target.value, undefined)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Sesión</label>
          <select
            value={selectedSessionId ?? ''}
            onChange={(e) => updateParams(selectedCycleId ?? undefined, e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Seleccionar sesión…</option>
            {cycleSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.session_date} — {session.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Buscar</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre del colaborador"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            disabled={!selectedSessionId}
          />
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!selectedSessionId ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">Seleccioná una sesión para cargar puntajes.</p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Cargando colaboradores…
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-3 sticky left-0 bg-zinc-50 z-10 min-w-[180px]">Colaborador</th>
                    <th className="px-2 py-3 text-center">Asistió</th>
                    <th className="px-2 py-3 text-center">Cámara</th>
                    <th className="px-2 py-3 text-center">Particip.</th>
                    <th className="px-2 py-3 text-center">Examen %</th>
                    <th className="px-2 py-3 text-center">Actividad</th>
                    <th className="px-2 py-3 text-center">Ajuste</th>
                    <th className="px-3 py-3">Notas</th>
                    <th className="px-3 py-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map((row) => (
                    <tr key={row.employee_id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 sticky left-0 bg-white z-10">
                        <p className="font-medium text-zinc-900">
                          {row.first_name} {row.last_name}
                        </p>
                        <p className="text-xs text-zinc-500">{row.department_name ?? '—'}</p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.attended}
                          onChange={(e) => updateRow(row.employee_id, { attended: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.camera_on}
                          onChange={(e) => updateRow(row.employee_id, { camera_on: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={row.participation_count}
                          onChange={(e) =>
                            updateRow(row.employee_id, {
                              participation_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                            })
                          }
                          className="w-14 rounded border border-zinc-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row.exam_score}
                          onChange={(e) =>
                            updateRow(row.employee_id, {
                              exam_score:
                                e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                            })
                          }
                          className="w-16 rounded border border-zinc-300 px-2 py-1 text-center text-sm"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.activity_on_time}
                          onChange={(e) =>
                            updateRow(row.employee_id, { activity_on_time: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          value={row.manual_adjustment}
                          onChange={(e) =>
                            updateRow(row.employee_id, {
                              manual_adjustment: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-16 rounded border border-zinc-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateRow(row.employee_id, { notes: e.target.value })}
                          className="w-full min-w-[120px] rounded border border-zinc-300 px-2 py-1 text-sm"
                          placeholder="Opcional"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-sky-700">{row.total_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar puntajes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
