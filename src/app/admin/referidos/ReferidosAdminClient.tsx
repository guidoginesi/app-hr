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
  pending: 'bg-amber-100 text-amber-700',
  in_process: 'bg-blue-100 text-blue-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-zinc-100 text-zinc-600',
};

type Referral = {
  id: string;
  job_id: string;
  job: { id: string; title: string; department?: string | null } | null;
  referrer: { id: string; first_name: string; last_name: string; job_title?: string | null } | null;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string | null;
  candidate_linkedin?: string | null;
  recommendation_reason: string;
  status: string;
  bonus_paid: boolean;
  hr_notes?: string | null;
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Referidos</h1>
        <p className="mt-1 text-sm text-zinc-500">Gestión de candidatos referidos por empleados de Pow</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total referidos', value: referrals.length, color: 'bg-zinc-50 border-zinc-200', text: 'text-zinc-900' },
          { label: 'Pendientes', value: pending, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'En proceso', value: inProcess, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Contratados', value: hired, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border ${stat.color} p-4`}>
            <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {bonusPending > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <span className="text-lg">🎉</span>
          <p className="text-sm font-medium text-yellow-800">
            {bonusPending} bonificación{bonusPending > 1 ? 'es' : ''} pendiente{bonusPending > 1 ? 's' : ''} de pagar
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar candidato o quien refirió..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="all">Todas las búsquedas</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <span className="text-sm text-zinc-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">{referrals.length === 0 ? 'Aún no hay referidos' : 'Sin resultados para los filtros seleccionados'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Candidato</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Búsqueda</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Referido por</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Bonif.</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {filtered.map(ref => (
                <tr key={ref.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-zinc-900">{ref.candidate_name}</p>
                    <p className="text-xs text-zinc-500">{ref.candidate_email}</p>
                    {ref.candidate_linkedin && (
                      <a href={ref.candidate_linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">LinkedIn</a>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-700">{ref.job?.title || '—'}</p>
                    {ref.job?.department && <p className="text-xs text-zinc-400">{ref.job.department}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-700">{ref.referrer ? `${ref.referrer.first_name} ${ref.referrer.last_name}` : '—'}</p>
                    {ref.referrer?.job_title && <p className="text-xs text-zinc-400">{ref.referrer.job_title}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ref.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[ref.status] || ref.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {ref.status === 'hired' ? (
                      ref.bonus_paid
                        ? <span className="text-xs font-medium text-emerald-600">✓ Pagada</span>
                        : <span className="text-xs font-medium text-amber-600">Pendiente</span>
                    ) : <span className="text-xs text-zinc-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {new Date(ref.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openDetail(ref)}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
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
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Detalle del referido</h2>
                <button onClick={closeDetail} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Candidate info */}
                <div className="rounded-lg bg-zinc-50 p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-zinc-900">{selectedReferral.candidate_name}</p>
                  <p className="text-sm text-zinc-600">{selectedReferral.candidate_email}</p>
                  {selectedReferral.candidate_phone && <p className="text-sm text-zinc-600">{selectedReferral.candidate_phone}</p>}
                  {selectedReferral.candidate_linkedin && (
                    <a href={selectedReferral.candidate_linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">LinkedIn →</a>
                  )}
                  <p className="text-xs text-zinc-400 pt-1">
                    Referido por: <span className="font-medium text-zinc-600">
                      {selectedReferral.referrer ? `${selectedReferral.referrer.first_name} ${selectedReferral.referrer.last_name}` : '—'}
                    </span>
                    {' · '}Búsqueda: <span className="font-medium text-zinc-600">{selectedReferral.job?.title || '—'}</span>
                  </p>
                </div>

                {/* Recommendation reason */}
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Motivo de recomendación</p>
                  <p className="text-sm text-zinc-700 italic">"{selectedReferral.recommendation_reason}"</p>
                </div>

                {/* Editable fields */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Estado</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
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
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-zinc-700">Bonificación pagada al empleado</span>
                  </label>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Notas internas HR <span className="text-zinc-400 font-normal">(visible para el empleado)</span>
                  </label>
                  <textarea
                    value={editHrNotes}
                    onChange={e => setEditHrNotes(e.target.value)}
                    rows={3}
                    placeholder="Ej: El candidato fue entrevistado, continuamos proceso..."
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  onClick={closeDetail}
                  disabled={saving}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
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
