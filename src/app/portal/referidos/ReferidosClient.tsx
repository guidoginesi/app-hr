'use client';

import { useState, useRef } from 'react';

type Job = { id: string; title: string; department?: string | null; location?: string | null; work_mode?: string | null };

type Referral = {
  id: string;
  job_id: string;
  job: { id: string; title: string; department?: string | null } | null;
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de revisión',
  in_process: 'En proceso',
  hired: '¡Contratado/a!',
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

const WORK_MODE_LABELS: Record<string, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
};

type Props = { initialJobs: Job[]; initialReferrals: Referral[] };

export function ReferidosClient({ initialJobs, initialReferrals }: Props) {
  const [jobs] = useState<Job[]>(initialJobs);
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [showModal, setShowModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    candidate_linkedin: '',
    recommendation_reason: '',
  });
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const openModal = (job: Job) => {
    setSelectedJob(job);
    setForm({ candidate_name: '', candidate_email: '', candidate_phone: '', candidate_linkedin: '', recommendation_reason: '' });
    setSubmitError(null);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setSelectedJob(null); };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!form.candidate_name.trim()) { setSubmitError('El nombre es requerido'); return; }
    if (!form.candidate_email.trim()) { setSubmitError('El email es requerido'); return; }
    if (!form.recommendation_reason.trim()) { setSubmitError('El motivo de recomendación es requerido'); reasonRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/referidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: selectedJob!.id, ...form }),
      });
      if (res.ok) {
        const saved: Referral = await res.json();
        setReferrals(prev => [saved, ...prev]);
        closeModal();
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error || `Error ${res.status}`);
      }
    } catch {
      setSubmitError('Error de red. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyReferredJobIds = new Set(referrals.map(r => r.job_id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Referidos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Recomendá personas para las búsquedas abiertas de Pow y obtené tu bonificación si se suman al equipo.
        </p>
      </div>

      {/* Open jobs */}
      <section>
        <h2 className="text-base font-semibold text-zinc-800 mb-3">Búsquedas abiertas</h2>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            No hay búsquedas abiertas en este momento
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const referred = alreadyReferredJobIds.has(job.id);
              return (
                <div key={job.id} className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{job.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {job.department && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{job.department}</span>
                      )}
                      {job.work_mode && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                          {WORK_MODE_LABELS[job.work_mode] || job.work_mode}
                        </span>
                      )}
                      {job.location && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{job.location}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    {referred ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Ya referiste a alguien
                      </span>
                    ) : (
                      <button
                        onClick={() => openModal(job)}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Referir persona
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My referrals */}
      {referrals.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-zinc-800 mb-3">Mis referidos</h2>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <ul className="divide-y divide-zinc-100">
              {referrals.map((ref) => (
                <li key={ref.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-zinc-900">{ref.candidate_name}</p>
                        {ref.bonus_paid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            🎉 Bonificación pagada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ref.candidate_email}{ref.candidate_phone ? ` · ${ref.candidate_phone}` : ''}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Búsqueda: <span className="font-medium text-zinc-700">{ref.job?.title || '—'}</span>
                        {ref.job?.department ? ` · ${ref.job.department}` : ''}
                      </p>
                      <p className="mt-1.5 text-xs text-zinc-500 italic">"{ref.recommendation_reason}"</p>
                      {ref.hr_notes && (
                        <p className="mt-1 text-xs text-blue-600">
                          <span className="font-medium">Nota HR:</span> {ref.hr_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ref.status] || 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[ref.status] || ref.status}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(ref.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Modal */}
      {showModal && selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Referir persona</h2>
                  <p className="text-sm text-zinc-500">{selectedJob.title}</p>
                </div>
                <button onClick={closeModal} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.candidate_name}
                      onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))}
                      placeholder="Ej: María González"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.candidate_email}
                      onChange={e => setForm(f => ({ ...f, candidate_email: e.target.value }))}
                      placeholder="maria@email.com"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Teléfono <span className="text-zinc-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="tel"
                      value={form.candidate_phone}
                      onChange={e => setForm(f => ({ ...f, candidate_phone: e.target.value }))}
                      placeholder="+54 11 1234-5678"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      LinkedIn <span className="text-zinc-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="url"
                      value={form.candidate_linkedin}
                      onChange={e => setForm(f => ({ ...f, candidate_linkedin: e.target.value }))}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      ¿Por qué recomendás a esta persona? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={reasonRef}
                      value={form.recommendation_reason}
                      onChange={e => setForm(f => ({ ...f, recommendation_reason: e.target.value }))}
                      rows={4}
                      placeholder="Contanos qué conocés de esta persona, su experiencia, habilidades o por qué creés que encajaría bien en Pow..."
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Enviando...
                    </>
                  ) : 'Enviar referido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
