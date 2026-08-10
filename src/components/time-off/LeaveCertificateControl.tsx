'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import type { LeaveRequestWithDetails } from '@/types/time-off';
import {
  leaveCertStatus,
  leaveCertRule,
  leaveCertDeadline,
  LEAVE_CERT_STATUS_LABELS,
  type LeaveCertStatus,
} from '@/lib/leaveCertificates';

const CHIP: Record<LeaveCertStatus, string> = {
  presentado: 'bg-success-subtle text-[var(--green-700)]',
  pendiente: 'bg-warning-subtle text-[var(--amber-600)]',
  vencido: 'bg-danger-subtle text-[var(--red-600)]',
};

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Estado del certificado adjunto a una licencia + acciones. Sirve para los tipos
 * que se acreditan con un comprobante (enfermedad y estudio); para el resto
 * devuelve null y no renderiza nada.
 *
 * mode='owner' (portal): el colaborador sube o reemplaza su certificado y puede verlo.
 * mode='admin' (HR): sólo ve el certificado; no lo sube.
 * El líder no usa este componente — no ve el certificado.
 *
 * La carga abre un Sheet en vez de disparar el file picker desde la fila: es la
 * convención del resto de la app (Nueva solicitud, Cargar certificado, Nuevo
 * reintegro) y además da lugar para decir el plazo, que en la fila no entraba.
 */
export function LeaveCertificateControl({
  request,
  mode,
  onChange,
}: {
  request: LeaveRequestWithDetails;
  mode: 'owner' | 'admin';
  onChange?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Sin onChange (páginas server, como el inicio de Time Off) se refresca la
  // ruta: si no, se sube el archivo y el chip sigue diciendo "pendiente".
  const refrescar = onChange ?? (() => router.refresh());

  const status = leaveCertStatus({
    leaveTypeCode: request.leave_type_code,
    certificateUploadedAt: request.certificate_uploaded_at,
    startDate: request.start_date,
    endDate: request.end_date,
  });
  const rule = leaveCertRule(request.leave_type_code);
  const hasCert = Boolean(request.certificate_uploaded_at);

  const basePath =
    mode === 'admin'
      ? `/api/admin/time-off/requests/${request.id}/certificate`
      : `/api/portal/time-off/requests/${request.id}/certificate`;

  async function view() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(basePath);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank', 'noopener');
      else setError(data.error ?? 'No se pudo abrir.');
    } catch {
      setError('No se pudo abrir.');
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(basePath, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpen(false);
        setFile(null);
        refrescar();
      } else {
        setError(data.error ?? 'No se pudo subir.');
      }
    } catch {
      setError('No se pudo subir.');
    } finally {
      setBusy(false);
    }
  }

  // Los tipos que no se acreditan con comprobante no muestran nada.
  if (!status || !rule) return null;

  const vence = leaveCertDeadline({
    leaveTypeCode: request.leave_type_code,
    startDate: request.start_date,
    endDate: request.end_date,
  });
  const desde = rule.anchor === 'end' ? 'que termina' : 'que empieza';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[status]}`}>
          {LEAVE_CERT_STATUS_LABELS[status]}
        </span>
        {hasCert && (
          <Button size="sm" variant="outline" loading={busy} onClick={view}>
            Ver
          </Button>
        )}
        {mode === 'owner' && (
          <Sheet
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setFile(null);
                setError(null);
              }
            }}
          >
            <SheetTrigger className={buttonVariants({ variant: hasCert ? 'ghost' : 'primary', size: 'sm' })}>
              {hasCert ? 'Reemplazar' : 'Subir certificado'}
            </SheetTrigger>
            <SheetContent
              title={hasCert ? `Reemplazar ${rule.label}` : `Subir ${rule.label}`}
              description={`${request.leave_type_name} · ${formatearFecha(request.start_date)}${
                request.start_date === request.end_date ? '' : ` al ${formatearFecha(request.end_date)}`
              }`}
              className="sm:max-w-xl"
            >
              {/* px-1: aire para que el ring de foco no se corte contra el overflow del Sheet */}
              <div className="space-y-4 px-1">
                <div className="rounded-lg border border-[var(--border)] bg-muted p-4 text-sm text-foreground">
                  Tenés <b>{rule.businessDays} días hábiles</b> desde {desde} la licencia
                  {vence && (
                    <>
                      : el plazo vence el <b>{formatearFecha(vence)}</b>
                    </>
                  )}
                  . Si se pasa, la licencia no se anula — queda marcada hasta que lo subas.
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary-foreground">
                    Archivo <span className="text-[var(--red-600)]">*</span>
                  </label>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] p-6 transition-colors hover:border-[var(--ring)] hover:bg-muted"
                    onClick={() => fileRef.current?.click()}
                  >
                    {file ? (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-foreground">{file.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Click para cambiar</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-secondary-foreground">Click para seleccionar archivo</p>
                        <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP hasta 10 MB</p>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setError(null);
                      }}
                    />
                  </div>
                  {hasCert && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Al subir uno nuevo, el anterior se reemplaza.
                    </p>
                  )}
                </div>

                {error && (
                  <div role="alert" className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
                    <p className="text-sm text-[var(--red-600)]">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                    Cancelar
                  </Button>
                  <Button onClick={upload} loading={busy} disabled={!file}>
                    Subir
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      {error && !open && <span className="text-xs text-[var(--red-600)]">{error}</span>}
    </div>
  );
}
