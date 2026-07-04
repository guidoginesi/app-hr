import Link from 'next/link';
import { NewTimeOffRequestForm } from './NewTimeOffRequestForm';

// Ruta standalone (deep-link). El flujo normal abre el form en un Sheet desde Time Off.
export default function NewTimeOffRequestPage() {
  return (
    <div className="min-h-screen bg-muted px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/portal/time-off"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Time Off
        </Link>

        <div className="rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <h1 className="type-display text-foreground">Nueva solicitud</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicita vacaciones, días Pow, trabajo remoto u otras licencias
          </p>
          <div className="mt-6">
            <NewTimeOffRequestForm />
          </div>
        </div>
      </div>
    </div>
  );
}
