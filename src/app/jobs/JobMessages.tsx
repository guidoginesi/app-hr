'use client';

import { useSearchParams } from 'next/navigation';
import { Alert } from '@pow/ui/components/ui/alert';

export function JobMessages() {
  const searchParams = useSearchParams();
  const submitted = searchParams.get('submitted');
  const talento = searchParams.get('talento');
  const error = searchParams.get('error');

  if (talento === '1') {
    return (
      <Alert variant="success" title="¡Listo, ya te sumamos!">
        Tus datos quedaron en nuestro Banco de Talentos y te mandamos un mail de confirmación.
        Cuando abramos una búsqueda que tenga que ver con lo tuyo, te escribimos.
      </Alert>
    );
  }

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
