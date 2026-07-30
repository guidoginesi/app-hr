import { ReactNode } from 'react';

/**
 * Un paso de manual: número + título + descripción + captura.
 * Si `image` no está seteada, muestra un placeholder "Captura pendiente".
 */
export function ManualStep({
  n,
  title,
  image,
  imageAlt,
  children,
}: {
  n: number;
  title: string;
  image?: string;
  imageAlt: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-6">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground nums-tabular">
          {n}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-medium">
            {children}
          </div>
          <figure className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-muted">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={imageAlt} className="block w-full" />
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-8 text-center">
                <svg className="h-8 w-8 text-[var(--gray-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs font-medium text-muted-foreground">Captura pendiente</p>
                <p className="max-w-xs text-xs text-[var(--gray-400)]">{imageAlt}</p>
              </div>
            )}
          </figure>
        </div>
      </div>
    </section>
  );
}
