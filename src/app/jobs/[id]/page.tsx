import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@pow/ui/components/ui/button";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { BenefitsSection } from "../BenefitsSection";
import { PublicShell } from "../PublicShell";

// Revalidate every 60 seconds - job details don't change frequently
export const revalidate = 60;

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !job) {
    notFound();
  }

  const bloques = [
    { titulo: 'La propuesta', html: job.description },
    { titulo: 'Responsabilidades', html: job.responsibilities },
    { titulo: 'Requisitos', html: job.requirements },
  ].filter((b) => !!b.html);

  return (
    <PublicShell back={{ href: '/jobs', label: 'Volver a búsquedas' }}>
      <div className="space-y-6">
        <h1 className="type-display">{job.title}</h1>

        {bloques.length > 0 && (
          <section className="rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Descripción del puesto</h2>
            <div className="mt-4 space-y-6">
              {bloques.map((bloque) => (
                <div key={bloque.titulo}>
                  <h3 className="text-sm font-semibold text-foreground">{bloque.titulo}</h3>
                  <div
                    className="prose prose-sm mt-2 max-w-none text-secondary-foreground"
                    dangerouslySetInnerHTML={{ __html: bloque.html as string }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <BenefitsSection />

        {/* El CTA cierra la página: se llega después de leer la oferta. */}
        <div className="flex justify-center">
          <Link href={`/jobs/${job.id}/apply`} className={buttonVariants({ size: 'lg' })}>
            Postularme
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
