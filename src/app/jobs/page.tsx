import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { JobMessages } from "./JobMessages";

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
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <div className="flex items-center">
            <Image src="/Logo-Pow.svg" alt="Pow" width={150} height={50} priority className="h-auto" />
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
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-6 transition-shadow hover:shadow-md">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-zinc-900">{job.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span>{job.work_mode || 'Remota'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{job.location || 'Buenos Aires, Buenos Aires, Argentina'}</span>
                    </div>
                    {job.department && (
                      <div className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>{job.department}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Link
                  href={`/jobs/${job.id}`}
                  className="ml-6 rounded-md bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
                >
                  Ver oferta
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

