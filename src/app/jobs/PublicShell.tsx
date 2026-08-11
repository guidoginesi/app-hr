import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { buttonVariants } from '@pow/ui/components/ui/button';

/**
 * Marco del portal público de búsquedas.
 *
 * Las tres pantallas (listado, oferta y postulación) repetían header y footer
 * copiados a mano, con anchos distintos y sin el aviso de la Ley 6471 en el
 * listado. Acá quedan en un solo lugar y con el mismo ancho.
 *
 * Es la única parte de la app que ve alguien de afuera, así que usa los mismos
 * componentes y tokens que el resto: mismo radio, misma tipografía, mismos
 * botones.
 */
export function PublicShell({
  back,
  children,
}: {
  /** Acción de la derecha del header. Sin esto, sólo se ve el logo. */
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted font-sans text-foreground">
      {/* Franja de marca, la misma que encabeza los mails de Pow. */}
      <div className="h-1 bg-brand" aria-hidden />
      <header className="border-b border-[var(--border)] bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link href="/jobs" aria-label="Pow — búsquedas abiertas" className="flex items-center">
            <Image src="/Logo-Pow.svg" alt="Pow" width={160} height={53} priority className="h-auto" />
          </Link>
          {back && (
            <Link href={back.href} className={buttonVariants({ variant: 'outline' })}>
              {back.label}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">{children}</main>

      <footer className="mx-auto max-w-4xl px-6 pb-10 sm:px-8">
        <div className="border-t border-[var(--border)] pt-6">
          <p className="text-sm font-semibold text-foreground">Búsqueda laboral equitativa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Desde Pow sólo te pediremos la información necesaria para el desempeño del trabajo que se
            ofrece — Ley N° 6471
          </p>
          <div className="mt-6 flex items-center justify-between">
            <Image src="/Logo-Pow.svg" alt="Pow" width={80} height={27} className="h-auto" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Pow</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
