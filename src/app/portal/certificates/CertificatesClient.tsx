'use client';

import { useState, useRef } from 'react';

const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  exam: 'Certificado de exámen',
  medical: 'Certificado médico',
  travel_assistance: 'Comprobante asistencia al viajero',
};

const CERTIFICATE_TYPE_COLORS: Record<string, string> = {
  exam: 'bg-blue-100 text-blue-700',
  medical: 'bg-red-100 text-red-700',
  travel_assistance: 'bg-purple-100 text-purple-700',
};

type Certificate = {
  id: string;
  type: string;
  file_name: string;
  file_size: number | null;
  notes: string | null;
  uploaded_at: string;
};

type CertificatesClientProps = {
  initialCertificates: Certificate[];
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CertificatesClient({ initialCertificates }: CertificatesClientProps) {
  const [certificates, setCertificates] = useState<Certificate[]>(initialCertificates);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: '' as string,
    notes: '',
    file: null as File | null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ type: '', notes: '', file: null });
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

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
        const saved: Certificate = await res.json();
        setCertificates(prev => [saved, ...prev]);
        closeModal();
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
        setCertificates(prev => prev.filter(c => c.id !== cert.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Certificados</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cargá tus certificados médicos, de exámen o comprobantes de viaje
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Cargar certificado
        </button>
      </div>

      {/* List */}
      {certificates.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-zinc-500">No tenés certificados cargados aún</p>
          <button
            onClick={openModal}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Cargar tu primer certificado →
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {certificates.map((cert) => (
              <li key={cert.id} className="flex items-center gap-4 px-6 py-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-900 truncate">{cert.file_name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CERTIFICATE_TYPE_COLORS[cert.type] || 'bg-zinc-100 text-zinc-600'}`}>
                      {CERTIFICATE_TYPE_LABELS[cert.type] || cert.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-zinc-500">
                      {new Date(cert.uploaded_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                    {cert.file_size && (
                      <p className="text-xs text-zinc-400">{formatFileSize(cert.file_size)}</p>
                    )}
                  </div>
                  {cert.notes && (
                    <p className="mt-1 text-xs text-zinc-500 italic">{cert.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(cert)}
                    disabled={downloadingId === cert.id}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {downloadingId === cert.id ? 'Descargando...' : 'Descargar'}
                  </button>
                  <button
                    onClick={() => handleDelete(cert)}
                    disabled={deletingId === cert.id}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === cert.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Cargar certificado</h2>
                <button onClick={closeModal} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Tipo de certificado <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Seleccioná un tipo</option>
                    <option value="exam">Certificado de exámen</option>
                    <option value="medical">Certificado médico</option>
                    <option value="travel_assistance">Comprobante asistencia al viajero</option>
                  </select>
                </div>

                {/* File */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Archivo <span className="text-red-500">*</span>
                  </label>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-6 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {form.file ? (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-zinc-900">{form.file.name}</p>
                        <p className="text-xs text-zinc-500">{formatFileSize(form.file.size)}</p>
                        <p className="mt-1 text-xs text-emerald-600">Click para cambiar</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-zinc-700">Click para seleccionar archivo</p>
                        <p className="text-xs text-zinc-500">PDF, JPG, PNG hasta 10 MB</p>
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

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Observaciones <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Ej: Certificado del exámen del 15/03, materia Cálculo II..."
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {uploadError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{uploadError}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  onClick={closeModal}
                  disabled={uploading}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !form.type || !form.file}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Subiendo...
                    </>
                  ) : (
                    'Subir certificado'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
