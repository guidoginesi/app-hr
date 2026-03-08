'use client';

import { useState, useRef } from 'react';

const PROVINCIAS = ['CABA', 'GBA', 'Otra'];

type Job = { id: string; title: string; department?: string | null; location?: string | null; work_mode?: string | null };

type ApplicationSnapshot = {
  id: string;
  current_stage: string | null;
  current_stage_status: string | null;
  final_outcome: string | null;
  offer_status: string | null;
};

type Referral = {
  id: string;
  job_id: string;
  job: { id: string; title: string; department?: string | null } | null;
  application: ApplicationSnapshot | null;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string | null;
  candidate_province?: string | null;
  candidate_linkedin?: string | null;
  candidate_salary_expectation?: string | null;
  recommendation_reason: string;
  status: string;
  bonus_paid: boolean;
  hr_notes?: string | null;
  cv_filename?: string | null;
  created_at: string;
};

// Derive a friendly label + color from the linked application stage
function getApplicationStatusBadge(ref: Referral): { label: string; color: string } {
  const app = ref.application;

  if (!app) {
    return { label: 'Pendiente de revisión', color: 'bg-amber-100 text-amber-700' };
  }

  // Final outcome takes priority
  if (app.final_outcome === 'HIRED') {
    return { label: '¡Contratado/a! 🎉', color: 'bg-emerald-100 text-emerald-700' };
  }
  if (app.final_outcome === 'REJECTED_BY_POW' || app.final_outcome === 'REJECTED_BY_CANDIDATE') {
    return { label: 'No avanzó', color: 'bg-red-100 text-red-700' };
  }
  if (app.final_outcome === 'ROLE_CANCELLED') {
    return { label: 'Búsqueda cerrada', color: 'bg-zinc-100 text-zinc-600' };
  }
  if (app.final_outcome === 'TALENT_POOL') {
    return { label: 'Banco de talento', color: 'bg-purple-100 text-purple-700' };
  }

  // Discarded in stage
  if (app.current_stage_status === 'DISCARDED_IN_STAGE') {
    return { label: 'No avanzó', color: 'bg-red-100 text-red-700' };
  }

  // Offer stage
  if (app.current_stage === 'OFFER') {
    if (app.offer_status === 'ACCEPTED') return { label: 'Oferta aceptada 🎉', color: 'bg-emerald-100 text-emerald-700' };
    if (app.offer_status === 'REJECTED_BY_CANDIDATE') return { label: 'Oferta rechazada', color: 'bg-red-100 text-red-700' };
    return { label: 'En etapa de oferta', color: 'bg-emerald-100 text-emerald-700' };
  }

  const stageLabels: Record<string, string> = {
    CV_RECEIVED: 'CV recibido',
    HR_REVIEW: 'En revisión HR',
    FILTER_QUESTIONS: 'Preguntas filtro',
    HR_INTERVIEW: 'Entrevista HR',
    LEAD_INTERVIEW: 'Entrevista con líder',
    EO_INTERVIEW: 'Entrevista EO/CEO',
    REFERENCES_CHECK: 'Chequeo de referencias',
    SELECTED_FOR_OFFER: 'Seleccionado/a para oferta',
    CLOSED: 'Búsqueda cerrada',
  };

  const stageColors: Record<string, string> = {
    CV_RECEIVED: 'bg-amber-100 text-amber-700',
    HR_REVIEW: 'bg-blue-100 text-blue-700',
    FILTER_QUESTIONS: 'bg-blue-100 text-blue-700',
    HR_INTERVIEW: 'bg-indigo-100 text-indigo-700',
    LEAD_INTERVIEW: 'bg-indigo-100 text-indigo-700',
    EO_INTERVIEW: 'bg-violet-100 text-violet-700',
    REFERENCES_CHECK: 'bg-violet-100 text-violet-700',
    SELECTED_FOR_OFFER: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-zinc-100 text-zinc-600',
  };

  const stage = app.current_stage || 'CV_RECEIVED';
  return {
    label: stageLabels[stage] ?? 'En proceso',
    color: stageColors[stage] ?? 'bg-blue-100 text-blue-700',
  };
}

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
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [salaryDisplay, setSalaryDisplay] = useState('');
  const [form, setForm] = useState({
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    candidate_province: '',
    candidate_linkedin: '',
    recommendation_reason: '',
  });
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const handleSalaryInput = (value: string) => {
    const onlyNumbers = value.replace(/\D/g, '');
    if (!onlyNumbers) { setSalaryDisplay(''); return; }
    setSalaryDisplay(new Intl.NumberFormat('es-AR').format(parseInt(onlyNumbers)));
  };

  const openModal = (job: Job) => {
    setSelectedJob(job);
    setForm({ candidate_name: '', candidate_email: '', candidate_phone: '', candidate_province: '', candidate_linkedin: '', recommendation_reason: '' });
    setSalaryDisplay('');
    setCvFile(null);
    setSubmitError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedJob(null);
    if (cvInputRef.current) cvInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!form.candidate_name.trim()) { setSubmitError('El nombre es requerido'); return; }
    if (!form.candidate_email.trim()) { setSubmitError('El email es requerido'); return; }
    if (!form.candidate_phone.trim()) { setSubmitError('El teléfono es requerido'); return; }
    if (!form.candidate_province) { setSubmitError('La provincia es requerida'); return; }
    if (!cvFile) { setSubmitError('El CV es requerido'); return; }
    if (!form.recommendation_reason.trim()) { setSubmitError('El motivo de recomendación es requerido'); reasonRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('job_id', selectedJob!.id);
      data.append('candidate_name', form.candidate_name);
      data.append('candidate_email', form.candidate_email);
      data.append('candidate_phone', form.candidate_phone);
      data.append('candidate_province', form.candidate_province);
      if (form.candidate_linkedin.trim()) data.append('candidate_linkedin', form.candidate_linkedin);
      if (salaryDisplay) data.append('candidate_salary_expectation', salaryDisplay.replace(/\D/g, ''));
      data.append('recommendation_reason', form.recommendation_reason);
      if (cvFile) data.append('cv', cvFile);

      const res = await fetch('/api/portal/referidos', { method: 'POST', body: data });
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
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ref.candidate_email}
                        {ref.candidate_phone ? ` · ${ref.candidate_phone}` : ''}
                        {ref.candidate_province ? ` · ${ref.candidate_province}` : ''}
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
                      {(() => {
                        const { label, color } = getApplicationStatusBadge(ref);
                        return (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
                            {label}
                          </span>
                        );
                      })()}
                      {ref.bonus_paid && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          🎉 Bonificación pagada
                        </span>
                      )}
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

              <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                {/* Nombre */}
                <div>
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

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Dirección de email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.candidate_email}
                    onChange={e => setForm(f => ({ ...f, candidate_email: e.target.value }))}
                    placeholder="maria@email.com"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Número de teléfono <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 whitespace-nowrap">
                      🇦🇷 Argentina
                    </div>
                    <input
                      type="tel"
                      value={form.candidate_phone}
                      onChange={e => setForm(f => ({ ...f, candidate_phone: e.target.value }))}
                      placeholder="+54"
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Provincia */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Provincia <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.candidate_province}
                    onChange={e => setForm(f => ({ ...f, candidate_province: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Seleccionar provincia</option>
                    {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Perfil de LinkedIn (URL) <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.candidate_linkedin}
                    onChange={e => setForm(f => ({ ...f, candidate_linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/in/tuperfil"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Expectativa salarial */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    ¿Cuál es su expectativa salarial mensual neta? <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={salaryDisplay}
                    onChange={e => handleSalaryInput(e.target.value)}
                    placeholder="Ej: 1.500.000"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* CV */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    CV / Currículum <span className="text-red-500">*</span> <span className="text-zinc-400 font-normal">(PDF/DOC hasta 10 MB)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                      Elegir archivo
                      <input
                        ref={cvInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => setCvFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <span className="text-sm text-zinc-500 truncate max-w-[200px]">
                      {cvFile ? cvFile.name : 'Ningún archivo seleccionado'}
                    </span>
                    {cvFile && (
                      <button onClick={() => { setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = ''; }} className="text-zinc-400 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Motivo */}
                <div>
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

                <p className="text-xs text-zinc-400">Los campos marcados con * son obligatorios.</p>

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
