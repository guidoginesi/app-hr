import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { BenefitsSection } from "../BenefitsSection";

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

  return (
    <div className="min-h-screen bg-muted font-sans text-foreground">
      <header className="border-b border-[var(--border)] bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4">
          <div className="flex items-center">
            <Image src="/Logo-Pow.svg" alt="Pow" width={150} height={50} priority className="h-auto" />
          </div>
          <Link
            href="/jobs"
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            Volver a búsquedas
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-12">
        {/* Job Title Header */}
        <div className="mb-8 flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-8 py-6 shadow-sm">
          <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
        </div>

        {/* Job Description Section */}
        <section className="mb-8 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-foreground">Descripción del puesto</h2>

          {job.description && (
            <div className="mb-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">La propuesta</h3>
              <div 
                className="prose prose-sm max-w-none text-secondary-foreground"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </div>
          )}

          {job.responsibilities && (
            <div className="mb-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Responsabilidades</h3>
              <div 
                className="prose prose-sm max-w-none text-secondary-foreground"
                dangerouslySetInnerHTML={{ __html: job.responsibilities }}
              />
            </div>
          )}

          {job.requirements && (
            <div className="mt-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Requisitos</h3>
              <div 
                className="prose prose-sm max-w-none text-secondary-foreground"
                dangerouslySetInnerHTML={{ __html: job.requirements }}
              />
            </div>
          )}
        </section>

        {/* Call to Action */}
        <div className="mb-8 flex justify-center">
          <Link
            href={`/jobs/${job.id}/apply`}
            className="rounded-lg bg-black px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-secondary"
          >
            Postularme
          </Link>
        </div>

        {/* Perks Section */}
        <BenefitsSection />

        {/* Footer */}
        <footer className="border-t border-[var(--border)] pt-8">
          <div className="mb-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Búsqueda laboral equitativa</p>
            <p className="mt-1">
              Desde Pow sólo te pediremos la información necesaria para el desempeño del trabajo que se ofrece - Ley N° 6471
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Image src="/Logo-Pow.svg" alt="Pow" width={100} height={33} className="h-auto" />
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">© 2025 Pow</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

