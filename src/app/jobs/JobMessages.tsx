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
        <div className="mb-6 rounded-xl border border-green-300 bg-green-50 px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-green-800">
            ✅ ¡Gracias por postularte! Recibimos tu CV y lo vamos a analizar.
          </p>
        </div>
      )}

      {/* Mensaje de error */}
      {error === 'already_applied' && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-red-800">
            ⚠️ Ya te postulaste para este puesto
          </p>
          <p className="mt-1 text-xs text-red-700">
            No puedes aplicar dos veces a la misma búsqueda. Si necesitas actualizar tu información, contacta con nosotros.
          </p>
        </div>
      )}
    </>
  );
}

