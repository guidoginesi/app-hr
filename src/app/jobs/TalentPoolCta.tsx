import Link from 'next/link';
import { buttonVariants } from '@pow/ui/components/ui/button';

/**
 * "¿No encontrás lo que buscás?" — entrada al Banco de Talentos.
 *
 * Es sólo la invitación: el formulario vive en su propia página, igual que el
 * de postulación a una búsqueda. Así los dos caminos del portal se ven y se
 * completan igual, y el del banco tiene link propio para compartir.
 */
export function TalentPoolCta() {
  return (
    <section className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">¿No encontrás lo que buscás?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dejanos tus datos y te tenemos en cuenta para las próximas búsquedas.
          </p>
        </div>
        <Link
          href="/jobs/banco-de-talentos"
          className={buttonVariants({ size: 'lg', className: 'shrink-0' })}
        >
          Dejar mis datos
        </Link>
      </div>
    </section>
  );
}
