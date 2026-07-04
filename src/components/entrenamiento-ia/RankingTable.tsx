'use client';

import type { AiTrainingRankingRow } from '@/types/entrenamiento-ia';
import { employeeDisplayName, employeeInitials } from '@/lib/entrenamientoIa';

type Props = {
  rows: AiTrainingRankingRow[];
  highlightEmployeeId?: string | null;
  showSessions?: boolean;
};

function rankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-warning-subtle border-warning/30';
  if (rank === 2) return 'bg-secondary border-[var(--border)]';
  if (rank === 3) return 'bg-accent border-[var(--orange-100)]';
  return 'bg-white border-[var(--border)]';
}

export function RankingTable({ rows, highlightEmployeeId, showSessions = true }: Props) {
  const sorted = [...rows].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return employeeDisplayName(a.first_name, a.last_name).localeCompare(
      employeeDisplayName(b.first_name, b.last_name),
      'es'
    );
  });

  const maxPoints = sorted[0]?.total_points ?? 0;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-12 text-center">
        <p className="text-sm text-muted-foreground">Todavía no hay participantes en este ciclo.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 w-16">#</th>
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3 hidden md:table-cell">Área</th>
              {showSessions && <th className="px-4 py-3 hidden lg:table-cell text-center">Sesiones</th>}
              <th className="px-4 py-3 text-right">Puntos</th>
              <th className="px-4 py-3 hidden sm:table-cell w-40">Progreso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((row, index) => {
              const rank = index + 1;
              const name = employeeDisplayName(row.first_name, row.last_name);
              const isMe = highlightEmployeeId === row.employee_id;
              const progress = maxPoints > 0 ? Math.round((row.total_points / maxPoints) * 100) : 0;

              return (
                <tr
                  key={row.employee_id}
                  className={`${rankStyle(rank)} ${isMe ? 'ring-2 ring-inset ring-ring' : ''}`}
                >
                  <td className="px-4 py-3 font-bold text-secondary-foreground">{rankBadge(rank)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.photo_url ? (
                        <img
                          src={row.photo_url}
                          alt={name}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                          {employeeInitials(row.first_name, row.last_name)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {name}
                          {isMe && (
                            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                              Vos
                            </span>
                          )}
                        </p>
                        {row.job_title && (
                          <p className="text-xs text-muted-foreground md:hidden">{row.job_title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {row.department_name ?? '—'}
                  </td>
                  {showSessions && (
                    <td className="px-4 py-3 hidden lg:table-cell text-center text-muted-foreground">
                      {row.sessions_scored}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <span className="text-lg font-bold text-foreground">{row.total_points}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScoringRulesCard() {
  const rules = [
    { action: 'Asistir a la capacitación', points: '10 pts' },
    { action: 'Participar (micrófono / preguntas)', points: '5 pts c/u, máx. 15 pts' },
    { action: 'Aprobar el examen (≥ 70%)', points: '15 pts' },
    { action: 'Nota perfecta en el examen (100%)', points: '5 pts bonus' },
    { action: 'Entregar actividad práctica en tiempo', points: '10 pts' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Cómo sumar puntos</h3>
      <p className="mt-1 text-xs text-muted-foreground">Por cada sesión de capacitación</p>
      <ul className="mt-4 space-y-2">
        {rules.map((rule) => (
          <li key={rule.action} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-secondary-foreground">{rule.action}</span>
            <span className="shrink-0 font-semibold text-foreground">{rule.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
