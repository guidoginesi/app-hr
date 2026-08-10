'use client';

import { useRef, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import type { LeaveRequestWithDetails } from '@/types/time-off';
import { sickCertStatus, SICK_CERT_STATUS_LABELS, type SickCertStatus } from '@/lib/sickLeave';

const CHIP: Record<SickCertStatus, string> = {
  presentado: 'bg-success-subtle text-[var(--green-700)]',
  pendiente: 'bg-warning-subtle text-[var(--amber-600)]',
  vencido: 'bg-danger-subtle text-[var(--red-600)]',
};

/**
 * Estado del certificado médico + acciones, para licencias por enfermedad.
 *
 * mode='owner' (portal): el colaborador sube o reemplaza su certificado y puede verlo.
 * mode='admin' (HR): sólo ve el certificado; no lo sube.
 * El líder no usa este componente — no ve el certificado.
 */
export function SickCertificateControl({
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
  const fileRef = useRef<HTMLInputElement>(null);

  const status = sickCertStatus({
    certificateUploadedAt: request.certificate_uploaded_at,
    startDate: request.start_date,
  });
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

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(basePath, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onChange?.();
      else setError(data.error ?? 'No se pudo subir.');
    } catch {
      setError('No se pudo subir.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[status]}`}>
          {SICK_CERT_STATUS_LABELS[status]}
        </span>
        {hasCert && (
          <Button size="sm" variant="outline" loading={busy} onClick={view}>
            Ver
          </Button>
        )}
        {mode === 'owner' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant={hasCert ? 'ghost' : 'primary'} loading={busy} onClick={() => fileRef.current?.click()}>
              {hasCert ? 'Reemplazar' : 'Subir certificado'}
            </Button>
          </>
        )}
      </div>
      {error && <span className="text-xs text-[var(--red-600)]">{error}</span>}
    </div>
  );
}
