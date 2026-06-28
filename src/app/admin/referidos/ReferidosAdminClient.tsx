'use client';

import { useState } from 'react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_process: 'En proceso',
  hired: 'Contratado/a',
  rejected: 'No avanzó',
  closed: 'Búsqueda cerrada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-subtle text-[var(--amber-600)]',
  in_process: 'bg-accent text-accent-foreground',
  hired: 'bg-success-subtle text-[var(--green-700)]',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  closed: 'bg-secondary text-muted-foreground',
};

type Referral = {
  id: string;
  job_id: string;
  job: { id: string; title: string; department?: string | null } | null;
  referrer: { id: string; first_name: string; last_name: string; job_title?: string | null } | null;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string | null;
  candidate_province?: string | null;
  candidate_linkedin?: string | null;
  candidate_salary_expectation?: string | null;
  recommendation_reason: string;
  relationship_type?: string | null;
  status: string;
  bonus_paid: boolean;
  hr_notes?: string | null;
  cv_storage_path?: string | null;
  cv_filename?: string | null;
  created_at: string;
};

type Props = { initialReferrals: Referral[]; jobs: { id: string; title: string }[] };

export function ReferidosAdminClient({ initialReferrals, jobs }: Props) {
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editBonusPaid, setEditBonusPaid] = useState(false);
  const [editHrNotes, setEditHrNotes] = useState('');

  const openDetail = (ref: Referral) => {
    setSelectedReferral(ref);
    setEditStatus(ref.status);
    setEditBonusPaid(ref.bonus_paid);
    setEditHrNotes(ref.hr_notes || '');
  };

  const closeDetail = () => setSelectedReferral(null);

  const handleSave = async () => {
    if (!selectedReferral) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/referidos/${selectedReferral.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, bonus_paid: editBonusPaid, hr_notes: editHrNotes }),
      });
      if (res.ok) {
        const updated: Referral = await res.json();
        setReferrals(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelectedReferral(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = referrals.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (jobFilter !== 'all' && r.job_id !== jobFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = r.candidate_name.toLowerCase();
      const referrer = `${r.referrer?.first_name} ${r.referrer?.last_name}`.toLowerCase();
      if (!name.includes(q) && !referrer.includes(q)) return false;
    }
    return true;
  });

  const hired = referrals.filter(r => r.status === 'hired').length;
  const pending = referrals.filter(r => r.status === 'pending').length;
  const inProcess = referrals.filter(r => r.status === 'in_process').length;
  const bonusPending = referrals.filter(r => r.status === 'hired' && !r.bonus_paid).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Referidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestión de candidatos referidos por empleados de Pow</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total referidos', value: referrals.length, color: 'bg-muted border-[var(--border)]', text: 'text-foreground' },
          { label: 'Pendientes', value: pending, color: 'bg-warning-subtle border-warning/30', text: 'text-[var(--amber-600)]' },
          { label: 'En proceso', value: inProcess, color: 'bg-accent border-[var(--orange-100)]', text: 'text-accent-foreground' },
          { label: 'Contratados', value: hired, color: 'bg-success-subtle border-success/20', text: 'text-[var(--green-700)]' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border ${stat.color} p-4`}>
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {bonusPending > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3">
          <span className="text-lg">🎉</span>
          <p className="text-sm font-medium text-[var(--amber-600)]">
            {bonusPending} bonificación{bonusPending > 1 ? 'es' : ''} pendiente{bonusPending > 1 ? 's' : ''} de pagar
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar candidato o quien refirió..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-4 py-2 text-sm focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        >
          <option value="all">Todas las búsquedas</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <p className="text-sm text-muted-foreground">{referrals.length === 0 ? 'Aún no hay referidos' : 'Sin resultados para los filtros seleccionados'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Candidato</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Búsqueda</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Referido por</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Bonif.</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {filtered.map(ref => (
                <tr key={ref.id} className="hover:bg-muted">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">{ref.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">{ref.candidate_email}</p>
                    {ref.candidate_linkedin && (
                      <a href={ref.candidate_linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-foreground hover:underline">LinkedIn</a>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-secondary-foreground">{ref.job?.title || '—'}</p>
                    {ref.job?.department && <p className="text-xs text-muted-foreground">{ref.job.department}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-secondary-foreground">{ref.referrer ? `${ref.referrer.first_name} ${ref.referrer.last_name}` : '—'}</p>
                    {ref.referrer?.job_title && <p className="text-xs text-muted-foreground">{ref.referrer.job_title}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ref.status] || 'bg-secondary text-muted-foreground'}`}>
                      {STATUS_LABELS[ref.status] || ref.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {ref.status === 'hired' ? (
                      ref.bonus_paid
                        ? <span className="text-xs font-medium text-[var(--green-700)]">✓ Pagada</span>
                        : <span className="text-xs font-medium text-[var(--amber-600)]">Pendiente</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(ref.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openDetail(ref)}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted"
                    >
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeDetail} />
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Detalle del referido</h2>
                <button onClick={closeDetail} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Candidate info */}
                <div className="rounded-lg bg-muted p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{selectedReferral.candidate_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedReferral.candidate_email}</p>
                  {selectedReferral.candidate_phone && <p className="text-sm text-muted-foreground">{selectedReferral.candidate_phone}</p>}
                  {selectedReferral.candidate_province && <p className="text-sm text-muted-foreground">{selectedReferral.candidate_province}</p>}
                  {selectedReferral.candidate_salary_expectation && (
                    <p className="text-sm text-muted-foreground">
                      Expectativa salarial: {new Intl.NumberFormat('es-AR').format(parseInt(selectedReferral.candidate_salary_expectation))}
                    </p>
                  )}
                  {selectedReferral.candidate_linkedin && (
                    <a href={selectedReferral.candidate_linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-foreground hover:underline block">LinkedIn →</a>
                  )}
                  {selectedReferral.cv_filename && selectedReferral.cv_storage_path && (
                    <p className="text-sm text-muted-foreground">
                      CV: <span className="font-medium">{selectedReferral.cv_filename}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Referido por: <span className="font-medium text-muted-foreground">
                      {selectedReferral.referrer ? `${selectedReferral.referrer.first_name} ${selectedReferral.referrer.last_name}` : '—'}
                    </span>
                    {' · '}Búsqueda: <span className="font-medium text-muted-foreground">{selectedReferral.job?.title || '—'}</span>
                  </p>
                </div>

                {/* Relación con el candidato */}
                {selectedReferral.relationship_type && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">¿Cómo lo/la conoce?</p>
                    <p className="text-sm text-secondary-foreground">
                      {selectedReferral.relationship_type === 'worked_together' && 'Trabajaron juntos'}
                      {selectedReferral.relationship_type === 'know_well' && 'No trabajaron juntos, pero lo/la conoce bien'}
                      {selectedReferral.relationship_type === 'recommended' && 'Se lo/la recomendaron y confía en la referencia'}
                    </p>
                  </div>
                )}

                {/* Recommendation reason */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Motivo de recomendación</p>
                  <p className="text-sm text-secondary-foreground italic">"{selectedReferral.recommendation_reason}"</p>
                </div>

                {/* Editable fields */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Estado</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                {editStatus === 'hired' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editBonusPaid}
                      onChange={e => setEditBonusPaid(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)] text-[var(--green-700)] focus:ring-ring"
                    />
                    <span className="text-sm font-medium text-secondary-foreground">Bonificación pagada al empleado</span>
                  </label>
                )}

                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Notas internas HR <span className="text-muted-foreground font-normal">(visible para el empleado)</span>
                  </label>
                  <textarea
                    value={editHrNotes}
                    onChange={e => setEditHrNotes(e.target.value)}
                    rows={3}
                    placeholder="Ej: El candidato fue entrevistado, continuamos proceso..."
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={closeDetail}
                  disabled={saving}
                  className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
