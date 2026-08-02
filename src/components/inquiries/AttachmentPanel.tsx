'use client';

import { useCallback, useEffect, useState } from 'react';

type Attachment = {
  id: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
};

const kb = (n: number | null) => (n ? `${Math.round(n / 1024)} KB` : '');

/**
 * Adjuntos de una consulta. Se usa igual en el portal y en el admin:
 * el backend resuelve el acceso, así que el componente no decide permisos.
 * `canUpload` solo controla si se muestra la zona de subida.
 */
export function AttachmentPanel({
  inquiryId,
  canUpload = true,
}: {
  inquiryId: string;
  canUpload?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/inquiries/${inquiryId}/attachments`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, [inquiryId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/inquiries/${inquiryId}/attachments`, { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'No se pudo subir el archivo');
        return;
      }
      await load();
    } catch {
      setError('No se pudo subir el archivo');
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string) => {
    const res = await fetch(`/api/inquiries/${inquiryId}/attachments/${id}`);
    if (!res.ok) return setError('No se pudo abrir el archivo');
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  };

  if (items.length === 0 && !canUpload) return null;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-secondary-foreground">Archivos adjuntos</p>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => download(a.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">{a.file_name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{kb(a.file_size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--brand)] bg-accent px-4 py-4 text-center transition-colors hover:bg-[var(--orange-100)]">
          <span className="text-sm font-medium text-foreground">{busy ? 'Subiendo…' : 'Adjuntar un archivo'}</span>
          <span className="text-xs text-muted-foreground">PDF, JPG o PNG · máx. 4 MB</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
      )}

      {error && <p className="text-xs text-[var(--red-600)]">{error}</p>}
    </div>
  );
}
