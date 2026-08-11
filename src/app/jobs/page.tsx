import Link from "next/link";
import { Suspense } from "react";
import { Briefcase, Home, MapPin } from "lucide-react";
import { buttonVariants } from "@pow/ui/components/ui/button";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { JobMessages } from "./JobMessages";
import { PublicShell } from "./PublicShell";
import { TalentPoolCta } from "./TalentPoolCta";

// Revalidate every 60 seconds - jobs don't change that frequently
export const revalidate = 60;

export default async function JobsPage() {
  let jobs: {
    id: string;
    title: string;
    department?: string | null;
    location?: string | null;
    work_mode?: string | null;
    description?: string | null;
  }[] = [];

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      jobs = [];
    } else {
      jobs = data ?? [];
    }
  } catch (err) {
    console.error('Error in jobs page:', err);
    jobs = [];
  }

  return (
    <PublicShell>
      <div>
        <h1 className="type-display">Oportunidades actuales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Postulate a las posiciones abiertas que tenemos disponibles.
        </p>
      </div>

      <Suspense fallback={null}>
        <div className="mt-6 empty:mt-0">
          <JobMessages />
        </div>
      </Suspense>

      {jobs.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-card p-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No hay búsquedas publicadas por el momento
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dejanos tus datos acá abajo y te avisamos cuando abramos una.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-card p-6 transition-colors hover:border-[var(--gray-300)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{job.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Home className="h-4 w-4 shrink-0" aria-hidden />
                    {job.work_mode || 'Remota'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    {job.location || 'Buenos Aires, Argentina'}
                  </span>
                  {job.department && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
                      {job.department}
                    </span>
                  )}
                </div>
              </div>
              {/* Naranja: es la acción que queremos que hagan. El botón del
                  Banco de Talentos queda en tinta, un escalón más abajo. */}
              <Link
                href={`/jobs/${job.id}`}
                className={buttonVariants({ variant: 'brand', size: 'lg', className: 'shrink-0' })}
              >
                Ver oferta
              </Link>
            </li>
          ))}
        </ul>
      )}

      <TalentPoolCta />
    </PublicShell>
  );
}
