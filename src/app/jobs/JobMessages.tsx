'use client';

import { useSearchParams } from 'next/navigation';
import { Alert } from '@pow/ui/components/ui/alert';

export function JobMessages() {
  const searchParams = useSearchParams();
  const submitted = searchParams.get('submitted');
  const error = searchParams.get('error');

  if (submitted === '1') {
    return (
      <Alert variant="success" title="¡Gracias por postularte!">
        Recibimos tu CV y lo vamos a analizar. Si tu perfil encaja, te escribimos.
      </Alert>
    );
  }

  if (error === 'already_applied') {
    return (
      <Alert variant="danger" title="Ya te postulaste para este puesto">
        No se puede aplicar dos veces a la misma búsqueda. Si necesitás actualizar tu información,
        escribinos.
      </Alert>
    );
  }

  return null;
}
