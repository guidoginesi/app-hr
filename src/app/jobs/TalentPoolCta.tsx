import Link from 'next/link';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { Card } from '@pow/ui/components/ui/card';

/**
 * "¿No encontrás lo que buscás?" — entrada al Banco de Talentos.
 *
 * Es sólo la invitación: el formulario vive en su propia página, igual que el
 * de postulación a una búsqueda. Así los dos caminos del portal se ven y se
 * completan igual, y el del banco tiene link propio para compartir.
 */
export function TalentPoolCta() {
  return (
    <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
          ¿No encontrás lo que buscás?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dejanos tus datos y te tenemos en cuenta para las próximas búsquedas.
        </p>
      </div>
      {/* Outline: postularse a una búsqueda abierta es lo que queremos que
          hagan, el banco es la alternativa. Así marca la app la jerarquía entre
          dos acciones, y no con el color. */}
      <Link
        href="/jobs/banco-de-talentos"
        className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}
      >
        Dejar mis datos
      </Link>
    </Card>
  );
}
