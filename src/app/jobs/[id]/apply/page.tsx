import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { ApplyForm } from "./ApplyForm";
import { BenefitsSection } from "../../BenefitsSection";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
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
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4">
          <div className="flex items-center">
            <Image src="/Logo-Pow.svg" alt="Pow" width={150} height={50} priority className="h-auto" />
          </div>
          <Link
            href={`/jobs/${job.id}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-12">
        {/* Job Title Header */}
        <div className="mb-8 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-8 py-6 shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900">{job.title}</h1>
        </div>

        {/* Application Form */}
        <ApplyForm jobId={job.id} jobTitle={job.title} />

        {/* Perks Section */}
        <div className="mt-8">
          <BenefitsSection />
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-200 pt-8">
          <div className="mb-4 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">Búsqueda laboral equitativa</p>
            <p className="mt-1">
              Desde Pow sólo te pediremos la información necesaria para el desempeño del trabajo que se ofrece - Ley N° 6471
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Image src="/Logo-Pow.svg" alt="Pow" width={100} height={33} className="h-auto" />
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">© 2025 Pow</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

