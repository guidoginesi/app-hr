'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, PauseCircle, Send, X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Stat } from '@pow/ui/components/ui/stat';
import {
  MANUAL_TALENT_POOL_STATUSES,
  SENIORITY_OPTIONS,
  TALENT_POOL_STATUS_LABELS,
  type TalentPoolStatus,
} from '@/lib/talentPool';

export type TalentPoolRow = {
  id: string;
  name: string;
  email: string;
  linkedinUrl: string | null;
  areas: string[];
  seniority: string | null;
  message: string | null;
  status: TalentPoolStatus;
  createdAt: string;
  lastSubmittedAt: string;
  resubmitted: boolean;
  submissionsCount: number;
  assignedJobTitle: string | null;
  assignedAt: string | null;
  /** Búsquedas en las que la persona ya está en proceso, por otro canal. */
  activeApplications: string[];
};

const STATUS_STYLES: Record<TalentPoolStatus, string> = {
  NEW: 'bg-warning-subtle text-[var(--amber-600)]',
  ON_HOLD: 'bg-secondary text-secondary-foreground',
  DISCARDED: 'bg-danger-subtle text-[var(--red-600)]',
  ASSIGNED: 'bg-success-subtle text-[var(--green-700)]',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TalentPoolClient({
  rows,
  areas,
  openJobs,
}: {
  rows: TalentPoolRow[];
  areas: string[];
  openJobs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [seniorityFilter, setSeniorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<TalentPoolRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.email}`.toLowerCase().includes(q)) return false;
      if (areaFilter !== 'ALL' && !r.areas.includes(areaFilter)) return false;
      if (seniorityFilter !== 'ALL' && r.seniority !== seniorityFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, areaFilter, seniorityFilter, statusFilter]);

  async function send(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/talent-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'No pudimos guardar el cambio.');
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError('Error de conexión. Probá de nuevo.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(
    () => ({
      NEW: rows.filter((r) => r.status === 'NEW').length,
      ON_HOLD: rows.filter((r) => r.status === 'ON_HOLD').length,
      ASSIGNED: rows.filter((r) => r.status === 'ASSIGNED').length,
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Stat
          icon={<Inbox className="h-6 w-6" />}
          label="Nuevos"
          value={String(counts.NEW)}
          sub="Sin revisar"
        />
        <Stat
          icon={<PauseCircle className="h-6 w-6" />}
          label="En espera"
          value={String(counts.ON_HOLD)}
          sub="Buenos perfiles guardados"
        />
        <Stat
          icon={<Send className="h-6 w-6" />}
          label="Asignados"
          value={String(counts.ASSIGNED)}
          sub="Ya derivados a una búsqueda"
        />
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-card">
        <div className="space-y-4 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Banco de Talentos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gente que dejó sus datos sin postularse a una búsqueda en particular.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="text"
              placeholder="Buscar por nombre o mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <SelectMenu
              ariaLabel="Filtrar por área"
              className="lg:w-56"
              value={areaFilter}
              onChange={setAreaFilter}
              options={[
                { value: 'ALL', label: 'Todas las áreas' },
                ...areas.map((a) => ({ value: a, label: a })),
              ]}
            />
            <SelectMenu
              ariaLabel="Filtrar por seniority"
              className="lg:w-48"
              value={seniorityFilter}
              onChange={setSeniorityFilter}
              options={[
                { value: 'ALL', label: 'Todos los niveles' },
                ...SENIORITY_OPTIONS.map((s) => ({ value: s, label: s })),
              ]}
            />
            <SelectMenu
              ariaLabel="Filtrar por estado"
              className="lg:w-48"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'Todos los estados' },
                ...(Object.keys(TALENT_POOL_STATUS_LABELS) as TalentPoolStatus[]).map((s) => ({
                  value: s,
                  label: TALENT_POOL_STATUS_LABELS[s],
                })),
              ]}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
              <p className="text-xs font-medium text-[var(--red-600)]">{error}</p>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {rows.length === 0
                ? 'Todavía no dejó sus datos nadie'
                : 'Ningún registro coincide con los filtros'}
            </p>
            {rows.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Los registros llegan desde el portal público de búsquedas.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((row) => (
              <li key={row.id} className="px-6 py-4 transition-colors hover:bg-muted">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{row.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                      >
                        {TALENT_POOL_STATUS_LABELS[row.status]}
                      </span>
                      {row.seniority && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                          {row.seniority}
                        </span>
                      )}
                      {row.resubmitted && (
                        <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-[var(--amber-600)]">
                          Volvió a anotarse
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{row.email}</span>
                      <span>·</span>
                      <span>Se anotó el {formatDate(row.createdAt)}</span>
                      {row.submissionsCount > 1 && (
                        <>
                          <span>·</span>
                          <span>Último envío el {formatDate(row.lastSubmittedAt)}</span>
                        </>
                      )}
                      {row.linkedinUrl && (
                        <>
                          <span>·</span>
                          <a
                            href={row.linkedinUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-medium text-foreground underline underline-offset-2"
                          >
                            LinkedIn
                          </a>
                        </>
                      )}
                    </div>

                    {row.areas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.areas.map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-secondary-foreground"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {row.status === 'ASSIGNED' && row.assignedJobTitle && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Asignado a <span className="font-semibold text-foreground">{row.assignedJobTitle}</span>
                        {row.assignedAt ? ` el ${formatDate(row.assignedAt)}` : ''}
                      </p>
                    )}

                    {row.activeApplications.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ya está en proceso en{' '}
                        <span className="font-semibold text-foreground">
                          {row.activeApplications.join(', ')}
                        </span>
                      </p>
                    )}

                    {row.message && (
                      <div className="mt-2">
                        <p
                          className={`text-xs text-secondary-foreground ${expanded === row.id ? '' : 'line-clamp-2'}`}
                        >
                          {row.message}
                        </p>
                        {row.message.length > 140 && (
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                            className="mt-1 text-xs font-medium text-foreground underline underline-offset-2"
                          >
                            {expanded === row.id ? 'Ver menos' : 'Ver más'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <a
                      href={`/api/admin/talent-pool/cv?id=${row.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-9 items-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Ver CV
                    </a>
                    <SelectMenu
                      ariaLabel={`Estado de ${row.name}`}
                      className="w-40"
                      // Un asignado no se mueve de estado a mano: su estado lo
                      // define la búsqueda a la que fue.
                      disabled={row.status === 'ASSIGNED' || busyId === row.id}
                      value={row.status === 'ASSIGNED' ? 'ASSIGNED' : row.status}
                      onChange={(v) => send({ action: 'status', id: row.id, status: v }, row.id)}
                      options={
                        row.status === 'ASSIGNED'
                          ? [{ value: 'ASSIGNED', label: 'Asignado' }]
                          : MANUAL_TALENT_POOL_STATUSES.map((s) => ({
                              value: s,
                              label: TALENT_POOL_STATUS_LABELS[s],
                            }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setError(null);
                        setAssigning(row);
                      }}
                    >
                      Asignar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AssignSheet
        row={assigning}
        openJobs={openJobs}
        onClose={() => setAssigning(null)}
        onConfirm={async (jobId) => {
          if (!assigning) return;
          const ok = await send({ action: 'assign', id: assigning.id, jobId }, assigning.id);
          if (ok) setAssigning(null);
        }}
      />
    </div>
  );
}

function AssignSheet({
  row,
  openJobs,
  onClose,
  onConfirm,
}: {
  row: TalentPoolRow | null;
  openJobs: { id: string; title: string }[];
  onClose: () => void;
  onConfirm: (jobId: string) => Promise<void>;
}) {
  const [jobId, setJobId] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <Sheet
      open={!!row}
      onOpenChange={(o) => {
        if (!o) {
          setJobId('');
          onClose();
        }
      }}
    >
      <SheetContent side="right" flush title="Asignar a una búsqueda">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="type-title">Asignar a una búsqueda</h2>
          <SheetClose
            aria-label="Cerrar"
            className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {row && (
            <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">{row.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.email}</p>
              {row.activeApplications.length > 0 && (
                <p className="mt-2 text-xs text-[var(--amber-600)]">
                  Ojo: ya está en proceso en {row.activeApplications.join(', ')}.
                </p>
              )}
            </div>
          )}

          {openJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay búsquedas publicadas. Publicá una desde la pestaña Búsquedas para poder asignar.
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-secondary-foreground">
                Búsqueda *
              </label>
              <SelectMenu
                ariaLabel="Búsqueda"
                className="w-full"
                placeholder="Elegí una búsqueda"
                value={jobId}
                onChange={setJobId}
                options={openJobs.map((j) => ({ value: j.id, label: j.title }))}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Solo aparecen las búsquedas publicadas. La persona entra en Revisión HR con la
                etiqueta Banco de Talentos, y su registro queda acá como Asignado.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!jobId}
            loading={sending}
            onClick={async () => {
              setSending(true);
              await onConfirm(jobId);
              setSending(false);
              setJobId('');
            }}
          >
            Asignar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
