'use client';

import { useSearchParams } from 'next/navigation';

export function JobMessages() {
  const searchParams = useSearchParams();
  const submitted = searchParams.get('submitted');
  const error = searchParams.get('error');

  return (
    <>
      {/* Mensaje de éxito */}
      {submitted === '1' && (
        <div className="mb-6 rounded-xl border border-success/20 bg-success-subtle px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-[var(--green-700)]">
            ✅ ¡Gracias por postularte! Recibimos tu CV y lo vamos a analizar.
          </p>
        </div>
      )}

      {/* Mensaje de error */}
      {error === 'already_applied' && (
        <div className="mb-6 rounded-xl border border-danger/20 bg-danger-subtle px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-[var(--red-600)]">
            ⚠️ Ya te postulaste para este puesto
          </p>
          <p className="mt-1 text-xs text-[var(--red-600)]">
            No puedes aplicar dos veces a la misma búsqueda. Si necesitas actualizar tu información, contacta con nosotros.
          </p>
        </div>
      )}
    </>
  );
}

