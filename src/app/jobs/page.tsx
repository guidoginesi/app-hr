import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { JobMessages } from "./JobMessages";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let jobs: {
    id: string;
    title: string;
    department?: string | null;
    location?: string | null;
    description?: string | null;
  }[] = [];

  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("jobs")
      .select("id,title,department,location,description,is_published")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    jobs = data ?? [];
  } catch {
    jobs = [];
  }
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <Image className="dark:invert" src="/next.svg" alt="Pow HR" width={90} height={18} />
            <span className="text-lg font-semibold tracking-tight text-zinc-900">Pow - Búsquedas abiertas</span>
          </div>
          <Link href="#" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
            Trabaja con nosotros
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Oportunidades actuales</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Postúlate a las posiciones abiertas que tenemos disponibles
          </p>
        </div>
        
        <Suspense fallback={null}>
          <JobMessages />
        </Suspense>
        
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">No hay búsquedas publicadas por el momento</p>
            <p className="mt-1 text-xs text-zinc-400">Vuelve pronto para ver nuevas oportunidades</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-zinc-900">{job.title}</h2>
                  <p className="mt-1.5 text-sm font-medium text-zinc-600">
                    {job.department ? `${job.department} · ` : ''}{job.location ?? 'Remoto'}
                  </p>
                  {job.description && (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-500">{job.description}</p>
                  )}
                </div>

                <form
                  className="space-y-3 border-t border-zinc-200 pt-5"
                  action="/api/candidates"
                  method="POST"
                  encType="multipart/form-data"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      type="text"
                      name="name"
                      placeholder="Nombre y Apellido"
                      required
                    />
                    <input
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      type="email"
                      name="email"
                      placeholder="Email"
                      required
                    />
                    <input
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      type="url"
                      name="linkedinUrl"
                      placeholder="LinkedIn (opcional)"
                    />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-700">CV *</label>
                      <input
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        type="file"
                        name="resume"
                        accept=".pdf,.doc,.docx,.txt"
                        required
                      />
                    </div>
                  </div>
                  <button
                    className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md"
                    type="submit"
                  >
                    Postularme
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

