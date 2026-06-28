'use client';

import { useState } from 'react';

const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  exam: 'Certificado de exámen',
  medical: 'Certificado médico',
  travel_assistance: 'Comprobante asistencia al viajero',
};

const CERTIFICATE_TYPE_COLORS: Record<string, string> = {
  exam: 'bg-accent text-accent-foreground',
  medical: 'bg-danger-subtle text-[var(--red-600)]',
  travel_assistance: 'bg-cat-violet-subtle text-cat-violet',
};

type Certificate = {
  id: string;
  type: string;
  file_name: string;
  file_size: number | null;
  notes: string | null;
  uploaded_at: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    department: { id: string; name: string } | null;
  } | null;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CertificatesAdminClient({ initialCertificates }: { initialCertificates: Certificate[] }) {
  const [certificates] = useState<Certificate[]>(initialCertificates);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = certificates.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (searchEmployee) {
      const name = `${c.employee?.first_name || ''} ${c.employee?.last_name || ''}`.toLowerCase();
      if (!name.includes(searchEmployee.toLowerCase())) return false;
    }
    return true;
  });

  const handleDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id);
    try {
      const res = await fetch(`/api/admin/certificates/${cert.id}`);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Certificados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentos subidos por los empleados
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-48">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por empleado..."
            value={searchEmployee}
            onChange={(e) => setSearchEmployee(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-4 py-2 text-sm focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tipo:</span>
          <div className="flex rounded-lg border border-[var(--border)] bg-white p-1">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'exam', label: 'Exámen' },
              { value: 'medical', label: 'Médico' },
              { value: 'travel_assistance', label: 'Viajero' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  typeFilter === opt.value ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-sm text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-muted-foreground">
            {certificates.length === 0
              ? 'Aún no se subieron certificados'
              : 'No hay certificados con los filtros seleccionados'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Archivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Observaciones</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {filtered.map((cert) => (
                <tr key={cert.id} className="hover:bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-foreground">
                      {cert.employee?.first_name} {cert.employee?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cert.employee?.job_title || ''}{cert.employee?.department ? ` · ${cert.employee.department.name}` : ''}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CERTIFICATE_TYPE_COLORS[cert.type] || 'bg-secondary text-muted-foreground'}`}>
                      {CERTIFICATE_TYPE_LABELS[cert.type] || cert.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-secondary-foreground max-w-xs truncate">{cert.file_name}</p>
                    {cert.file_size && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(cert.file_size)}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground max-w-xs truncate">
                      {cert.notes || <span className="text-muted-foreground italic">—</span>}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-secondary-foreground">
                      {new Date(cert.uploaded_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDownload(cert)}
                      disabled={downloadingId === cert.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {downloadingId === cert.id ? 'Descargando...' : 'Descargar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
