'use client';


import { Spinner } from '@/components/Spinner';
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
  relationship_type?: string | null;
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
    return { label: 'Pendiente de revisión', color: 'bg-warning-subtle text-[var(--amber-600)]' };
  }

  // Final outcome takes priority
  if (app.final_outcome === 'HIRED') {
    return { label: '¡Contratado/a! 🎉', color: 'bg-success-subtle text-[var(--green-700)]' };
  }
  if (app.final_outcome === 'REJECTED_BY_POW' || app.final_outcome === 'REJECTED_BY_CANDIDATE') {
    return { label: 'No avanzó', color: 'bg-danger-subtle text-[var(--red-600)]' };
  }
  if (app.final_outcome === 'ROLE_CANCELLED') {
    return { label: 'Búsqueda cerrada', color: 'bg-secondary text-muted-foreground' };
  }
  if (app.final_outcome === 'TALENT_POOL') {
    return { label: 'Banco de talento', color: 'bg-secondary text-foreground' };
  }

  // Discarded in stage
  if (app.current_stage_status === 'DISCARDED_IN_STAGE') {
    return { label: 'No avanzó', color: 'bg-danger-subtle text-[var(--red-600)]' };
  }

  // Offer stage
  if (app.current_stage === 'OFFER') {
    if (app.offer_status === 'ACCEPTED') return { label: 'Oferta aceptada 🎉', color: 'bg-success-subtle text-[var(--green-700)]' };
    if (app.offer_status === 'REJECTED_BY_CANDIDATE') return { label: 'Oferta rechazada', color: 'bg-danger-subtle text-[var(--red-600)]' };
    return { label: 'En etapa de oferta', color: 'bg-success-subtle text-[var(--green-700)]' };
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
    CV_RECEIVED: 'bg-warning-subtle text-[var(--amber-600)]',
    HR_REVIEW: 'bg-accent text-accent-foreground',
    FILTER_QUESTIONS: 'bg-accent text-accent-foreground',
    HR_INTERVIEW: 'bg-accent text-accent-foreground',
    LEAD_INTERVIEW: 'bg-accent text-accent-foreground',
    EO_INTERVIEW: 'bg-secondary text-foreground',
    REFERENCES_CHECK: 'bg-secondary text-foreground',
    SELECTED_FOR_OFFER: 'bg-success-subtle text-[var(--green-700)]',
    CLOSED: 'bg-secondary text-muted-foreground',
  };

  const stage = app.current_stage || 'CV_RECEIVED';
  return {
    label: stageLabels[stage] ?? 'En proceso',
    color: stageColors[stage] ?? 'bg-accent text-accent-foreground',
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
    relationship_type: '',
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
    setForm({ candidate_name: '', candidate_email: '', candidate_phone: '', candidate_province: '', candidate_linkedin: '', recommendation_reason: '', relationship_type: '' });
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
    if (!form.relationship_type) { setSubmitError('Indicá cómo conocés a esta persona'); return; }
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
      if (form.relationship_type) data.append('relationship_type', form.relationship_type);
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
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Referidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ¿Conocés a alguien que podría sumarse a nuestro equipo y compartir nuestros valores? Esta es tu oportunidad de recomendarlo/a y, si ingresa, recibir un bono como reconocimiento.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">¿Cómo funciona?</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-muted-foreground">1.</span>
                <span>
                  Antes de comenzar leé la política{' '}
                  <a
                    href="https://docs.google.com/document/d/1HWXHbKaQ161lsgNufTKcrCS7UIfiIBS98-L6ud80c-U/edit?tab=t.0#heading=h.f5v4k0nmuvib"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--green-700)] underline hover:text-[var(--green-700)]"
                  >Programa de Referidos Pow 🚀</a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-muted-foreground">2.</span>
                <span>Si conocés a alguien que encaje con alguna de nuestras búsquedas abiertas, podés completarlo en el formulario de referidos.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-muted-foreground">3.</span>
                <span>Si tu referido/a es contratado/a y cumple el período de prueba, vas a recibir un bono según la posición y el esquema vigente.</span>
              </li>
            </ol>
          </div>

          <p className="text-sm font-medium text-[var(--green-700)]">
            ¡Tu recomendación puede ser clave para seguir construyendo el equipo que queremos!
          </p>
        </div>
      </div>

      {/* Open jobs */}
      <section>
        <h2 className="text-base font-semibold text-secondary-foreground mb-3">Búsquedas abiertas</h2>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center text-sm text-muted-foreground">
            No hay búsquedas abiertas en este momento
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const referred = alreadyReferredJobIds.has(job.id);
              return (
                <div key={job.id} className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
                  <div>
                    <p className="font-semibold text-foreground">{job.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {job.department && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{job.department}</span>
                      )}
                      {job.work_mode && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                          {WORK_MODE_LABELS[job.work_mode] || job.work_mode}
                        </span>
                      )}
                      {job.location && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{job.location}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    {referred ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--green-700)]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Ya referiste a alguien
                      </span>
                    ) : (
                      <button
                        onClick={() => openModal(job)}
                        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
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
          <h2 className="text-base font-semibold text-secondary-foreground mb-3">Mis referidos</h2>
          <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {referrals.map((ref) => (
                <li key={ref.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{ref.candidate_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ref.candidate_email}
                        {ref.candidate_phone ? ` · ${ref.candidate_phone}` : ''}
                        {ref.candidate_province ? ` · ${ref.candidate_province}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Búsqueda: <span className="font-medium text-secondary-foreground">{ref.job?.title || '—'}</span>
                        {ref.job?.department ? ` · ${ref.job.department}` : ''}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground italic">"{ref.recommendation_reason}"</p>
                      {ref.hr_notes && (
                        <p className="mt-1 text-xs text-accent-foreground">
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                          🎉 Bonificación pagada
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
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
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Referir persona</h2>
                  <p className="text-sm text-muted-foreground">{selectedJob.title}</p>
                </div>
                <button onClick={closeModal} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Nombre completo <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.candidate_name}
                    onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))}
                    placeholder="Ej: María González"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Dirección de email <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.candidate_email}
                    onChange={e => setForm(f => ({ ...f, candidate_email: e.target.value }))}
                    placeholder="maria@email.com"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Número de teléfono <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-muted px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                      🇦🇷 Argentina
                    </div>
                    <input
                      type="tel"
                      value={form.candidate_phone}
                      onChange={e => setForm(f => ({ ...f, candidate_phone: e.target.value }))}
                      placeholder="+54"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Provincia */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Provincia <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <select
                    value={form.candidate_province}
                    onChange={e => setForm(f => ({ ...f, candidate_province: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Seleccionar provincia</option>
                    {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Perfil de LinkedIn (URL) <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.candidate_linkedin}
                    onChange={e => setForm(f => ({ ...f, candidate_linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/in/tuperfil"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Expectativa salarial */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    ¿Cuál es su expectativa salarial mensual neta? <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={salaryDisplay}
                    onChange={e => handleSalaryInput(e.target.value)}
                    placeholder="Ej: 1.500.000"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* CV */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    CV / Currículum <span className="text-[var(--red-600)]">*</span> <span className="text-muted-foreground font-normal">(PDF/DOC hasta 10 MB)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted">
                      Elegir archivo
                      <input
                        ref={cvInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => setCvFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {cvFile ? cvFile.name : 'Ningún archivo seleccionado'}
                    </span>
                    {cvFile && (
                      <button onClick={() => { setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = ''; }} className="text-muted-foreground hover:text-[var(--red-600)]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tipo de relación */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    ¿Trabajaste con esta persona o la conocés por otra vía? <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'worked_together', label: 'Sí, trabajamos juntos' },
                      { value: 'know_well', label: 'No trabajamos juntos, pero la conozco bien' },
                      { value: 'recommended', label: 'Me la recomendaron y confío en la referencia' },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${form.relationship_type === opt.value ? 'border-brand bg-success-subtle' : 'border-[var(--border)] hover:border-[var(--border)] bg-white'}`}>
                        <input
                          type="radio"
                          name="relationship_type"
                          value={opt.value}
                          checked={form.relationship_type === opt.value}
                          onChange={() => setForm(f => ({ ...f, relationship_type: opt.value }))}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm text-secondary-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    ¿Por qué pensaste en esta persona para que sea parte de Pow? <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <textarea
                    ref={reasonRef}
                    value={form.recommendation_reason}
                    onChange={e => setForm(f => ({ ...f, recommendation_reason: e.target.value }))}
                    rows={4}
                    placeholder="Contanos qué conocés de esta persona, su experiencia, habilidades o por qué creés que encajaría bien en Pow..."
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <p className="text-xs text-muted-foreground">Los campos marcados con * son obligatorios.</p>

                {submitError && (
                  <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
                    <p className="text-sm text-[var(--red-600)]">{submitError}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Spinner className="h-4 w-4 text-white" />
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
