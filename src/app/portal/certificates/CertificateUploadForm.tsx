'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

export type Certificate = {
  id: string;
  type: string;
  file_name: string;
  file_size: number | null;
  notes: string | null;
  uploaded_at: string;
};

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CertificateUploadForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (cert: Certificate) => void;
  onCancel: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: '', notes: '', file: null as File | null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    setUploadError(null);
    if (!form.type) { setUploadError('Seleccioná el tipo de certificado'); return; }
    if (!form.file) { setUploadError('Seleccioná un archivo'); return; }

    setUploading(true);
    try {
      const data = new FormData();
      data.append('type', form.type);
      data.append('file', form.file);
      if (form.notes.trim()) data.append('notes', form.notes.trim());

      const res = await fetch('/api/portal/certificates', { method: 'POST', body: data });
      if (res.ok) {
        onSuccess(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadError(err.error || `Error ${res.status} al subir el archivo`);
      }
    } catch {
      setUploadError('Error de red. Intentá de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tipo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary-foreground">
          Tipo de certificado <span className="text-[var(--red-600)]">*</span>
        </label>
        <SelectMenu
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          placeholder="Seleccioná un tipo"
          ariaLabel="Tipo de certificado"
          className="w-full"
          // 'medical' ya no se ofrece: el certificado médico se sube dentro de la
          // licencia por enfermedad, no suelto. Suelto no queda asociado a nada,
          // no alimenta el "presentó certificado" del KPI y duplica el lugar
          // donde buscarlo. Los que ya se cargaron así se siguen viendo.
          options={[
            { value: 'exam', label: 'Certificado de exámen' },
            { value: 'travel_assistance', label: 'Comprobante asistencia al viajero' },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          ¿Buscás subir un <b className="font-medium text-foreground">certificado médico</b>? Va adjunto a la licencia,
          en <Link href="/portal/time-off/requests" className="text-[var(--brand-strong)] hover:underline">Time Off →
          Historial de solicitudes</Link>.
        </p>
      </div>

      {/* Archivo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary-foreground">
          Archivo <span className="text-[var(--red-600)]">*</span>
        </label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] p-6 transition-colors hover:border-[var(--ring)] hover:bg-muted"
          onClick={() => fileInputRef.current?.click()}
        >
          {form.file ? (
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-foreground">{form.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(form.file.size)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Click para cambiar</p>
            </div>
          ) : (
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="mt-2 text-sm font-medium text-secondary-foreground">Click para seleccionar archivo</p>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG hasta 10 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
          />
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="mb-1 block text-sm font-medium text-secondary-foreground">
          Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="Ej: Certificado del exámen del 15/03, materia Cálculo II…"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {uploadError && (
        <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
          <p className="text-sm text-[var(--red-600)]">{uploadError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>
          Cancelar
        </Button>
        <Button onClick={handleUpload} loading={uploading} disabled={!form.type || !form.file}>
          Subir certificado
        </Button>
      </div>
    </div>
  );
}
