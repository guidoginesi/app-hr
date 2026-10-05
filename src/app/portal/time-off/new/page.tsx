import Link from 'next/link';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import type { LeaveType, LeaveBalanceWithDetails } from '@/types/time-off';
import { NewTimeOffRequestForm } from './NewTimeOffRequestForm';

export const dynamic = 'force-dynamic';

// Ruta standalone (deep-link). El flujo normal abre el form en un Sheet desde Time Off.
export default async function NewTimeOffRequestPage() {
  // Los tipos y los saldos se leen acá, juntos, para que el form arranque listo
  // en vez de esperar a dos APIs con el spinner (igual las pide en segundo plano,
  // para refrescar). Son las mismas consultas que esas APIs
  // (/api/portal/time-off/leave-types y /balances, del año en curso). Si no hay
  // sesión, el form queda sin datos iniciales y los pide como antes.
  const auth = await requirePortalAccess();
  let initialLeaveTypes: LeaveType[] | undefined;
  let initialBalances: LeaveBalanceWithDetails[] | undefined;
  const currentYear = new Date().getFullYear();

  if (auth?.employee) {
    const employee = auth.employee;
    const supabase = getSupabaseServer();
    const [typesResult, balancesResult] = await Promise.all([
      supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('leave_balances_with_details')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('year', currentYear),
    ]);

    if (!typesResult.error && !balancesResult.error) {
      // La licencia por estudio sólo para quien la tiene habilitada, igual que la API.
      initialLeaveTypes = ((typesResult.data ?? []) as LeaveType[]).filter(
        (type) => type.code !== 'study' || employee.is_studying,
      );
      initialBalances = (balancesResult.data ?? []) as LeaveBalanceWithDetails[];
    }
  }

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
            <NewTimeOffRequestForm
              initialLeaveTypes={initialLeaveTypes}
              initialBalances={initialBalances}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
