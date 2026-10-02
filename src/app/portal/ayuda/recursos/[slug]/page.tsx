import { notFound, redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { contenidoParaElPortal } from '@/lib/ayudaContenidosQuery';
import { slugDe, tipoDeLink } from '@/lib/ayudaContenidos';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { CuerpoDeAyuda } from '@/components/ayuda/CuerpoDeAyuda';
import { PortalAyudaLayout } from '../../PortalAyudaLayout';
import { formatDateLocal } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * Un contenido de People: una política, un beneficio, cómo se hace algo.
 *
 * Lo que no está publicado, o no es para la forma de contratación de quien lo
 * abre, responde como si no existiera.
 */
export default async function RecursoDeAyudaPage({ params }: { params: Promise<{ slug: string }> }) {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  const { slug } = await params;
  const c = await contenidoParaElPortal(slug, auth.employee.employment_type);
  if (!c) notFound();

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      title={c.titulo}
      description={c.resumen ?? c.seccion}
      volverA={`/portal/ayuda?tema=${slugDe(c.seccion)}`}
    >
      <article className="rounded-xl border border-[var(--border)] bg-white px-6 py-6 shadow-sm sm:px-8">
        <CuerpoDeAyuda html={c.html} />

        {c.link_url && (
          <a
            href={c.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonVariants()} mt-6`}
          >
            {tipoDeLink(c.link_url).abrir}
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
          </a>
        )}

        <p className="mt-8 border-t border-[var(--border)] pt-4 text-xs text-muted-foreground">
          Actualizado el {formatDateLocal(c.updated_at.slice(0, 10))}. Si algo no está claro, escribile a People desde Consultas.
        </p>
      </article>
    </PortalAyudaLayout>
  );
}
