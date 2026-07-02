'use client';

import { useState } from 'react';
import { Sheet, SheetContent } from '@pow/ui/components/ui/sheet';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { CertificateUploadForm, formatFileSize, type Certificate } from './CertificateUploadForm';

const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  exam: 'Certificado de exámen',
  medical: 'Certificado médico',
  travel_assistance: 'Comprobante asistencia al viajero',
};

const CERTIFICATE_TYPE_COLORS: Record<string, string> = {
  exam: 'bg-accent text-accent-foreground',
  medical: 'bg-danger-subtle text-[var(--red-600)]',
  travel_assistance: 'bg-secondary text-foreground',
};

type CertificatesClientProps = {
  initialCertificates: Certificate[];
};

export function CertificatesClient({ initialCertificates }: CertificatesClientProps) {
  const [certificates, setCertificates] = useState<Certificate[]>(initialCertificates);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id);
    try {
      const res = await fetch(`/api/portal/certificates/${cert.id}`);
      if (res.ok) {
        const { url } = await res.json();
        const a = document.createElement('a');
        a.href = url;
        a.download = cert.file_name;
        a.target = '_blank';
        a.click();
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (cert: Certificate) => {
    if (!confirm(`¿Eliminar "${cert.file_name}"?`)) return;
    setDeletingId(cert.id);
    try {
      const res = await fetch(`/api/portal/certificates/${cert.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCertificates((prev) => prev.filter((c) => c.id !== cert.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Certificados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá tus certificados médicos, de exámen o comprobantes de viaje
          </p>
        </div>
        <button onClick={() => setOpen(true)} className={buttonVariants({ variant: 'primary' })}>
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Cargar certificado
        </button>
      </div>

      {/* List */}
      {certificates.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-muted-foreground">No tenés certificados cargados aún</p>
          <button
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-[var(--primary-hover)]"
          >
            Cargar tu primer certificado →
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <ul className="divide-y divide-[var(--border)]">
            {certificates.map((cert) => (
              <li key={cert.id} className="flex items-center gap-4 px-6 py-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{cert.file_name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CERTIFICATE_TYPE_COLORS[cert.type] || 'bg-secondary text-muted-foreground'}`}>
                      {CERTIFICATE_TYPE_LABELS[cert.type] || cert.type}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {new Date(cert.uploaded_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {cert.file_size && <p className="text-xs text-muted-foreground">{formatFileSize(cert.file_size)}</p>}
                  </div>
                  {cert.notes && <p className="mt-1 text-xs italic text-muted-foreground">{cert.notes}</p>}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleDownload(cert)}
                    disabled={downloadingId === cert.id}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {downloadingId === cert.id ? 'Descargando…' : 'Descargar'}
                  </button>
                  <button
                    onClick={() => handleDelete(cert)}
                    disabled={deletingId === cert.id}
                    className="rounded-lg border border-danger/20 bg-white px-3 py-1.5 text-xs font-medium text-[var(--red-600)] hover:bg-danger-subtle disabled:opacity-50"
                  >
                    {deletingId === cert.id ? '…' : 'Eliminar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          title="Cargar certificado"
          description="Subí certificados médicos, de exámen o comprobantes de viaje"
          className="sm:max-w-xl"
        >
          <div className="px-1">
            <CertificateUploadForm
              onSuccess={(saved) => {
                setCertificates((prev) => [saved, ...prev]);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
