import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { ApplyForm } from "./ApplyForm";
import { PublicShell } from "../../PublicShell";

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
    <PublicShell back={{ href: `/jobs/${job.id}`, label: 'Volver' }}>
      <div className="space-y-6">
        <div>
          <h1 className="type-display">Postularme</h1>
          <p className="mt-1 text-sm text-muted-foreground">{job.title}</p>
        </div>

        {/* Sin beneficios ni descripción acá: en el formulario lo único que
            queremos es que la persona lo complete y lo mande. */}
        <ApplyForm jobId={job.id} jobTitle={job.title} />
      </div>
    </PublicShell>
  );
}
