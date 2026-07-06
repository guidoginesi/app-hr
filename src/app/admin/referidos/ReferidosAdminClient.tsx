'use client';

import { useState } from 'react';
import { X, UserPlus, Clock, RefreshCw, UserCheck } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { Stat } from '@pow/ui/components/ui/stat';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_process: 'En proceso',
  hired: 'Contratado/a',
  rejected: 'No avanzó',
  closed: 'Búsqueda cerrada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-subtle text-[var(--amber-600)]',
  in_process: 'bg-secondary text-secondary-foreground',
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
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={<UserPlus className="h-6 w-6" />} label="Total referidos" value={String(referrals.length)} />
        <Stat icon={<Clock className="h-6 w-6" />} label="Pendientes" value={String(pending)} tone="warning" />
        <Stat icon={<RefreshCw className="h-6 w-6" />} label="En proceso" value={String(inProcess)} />
        <Stat icon={<UserCheck className="h-6 w-6" />} label="Contratados" value={String(hired)} tone="success" />
      </div>

      {bonusPending > 0 && (
        <div className="rounded-[var(--radius)] border border-warning/30 bg-warning-subtle px-4 py-3">
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
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-4 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <SelectMenu
          ariaLabel="Filtrar por estado"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Todos los estados' },
            ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        <SelectMenu
          ariaLabel="Filtrar por búsqueda"
          value={jobFilter}
          onChange={setJobFilter}
          options={[
            { value: 'all', label: 'Todas las búsquedas' },
            ...jobs.map(j => ({ value: j.id, label: j.title })),
          ]}
        />
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
                    <Button variant="outline" size="sm" onClick={() => openDetail(ref)}>
                      Ver / Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedReferral && (
        <Sheet open onOpenChange={(o) => { if (!o) closeDetail(); }}>
          <SheetContent side="right" flush title="Detalle del referido" className="max-w-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="type-title">Detalle del referido</h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                  <SelectMenu
                    ariaLabel="Estado"
                    className="w-full"
                    value={editStatus}
                    onChange={setEditStatus}
                    options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                </div>

                {editStatus === 'hired' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={editBonusPaid}
                      onCheckedChange={c => setEditBonusPaid(c === true)}
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
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button variant="outline" onClick={closeDetail} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  Guardar cambios
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
