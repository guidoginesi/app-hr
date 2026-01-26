import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import Link from 'next/link';
import type { LeaveBalanceWithDetails, LeaveRequestWithDetails } from '@/types/time-off';

export const dynamic = 'force-dynamic';

export default async function TimeOffPortalPage() {
  const auth = await requirePortalAccess();

  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();
  const currentYear = new Date().getFullYear();

  // Get balances
  const { data: balances } = await supabase
    .from('leave_balances_with_details')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', currentYear);

  // Get recent/pending requests
  const { data: requests } = await supabase
    .from('leave_requests_with_details')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Group balances by type
  const balancesByType: Record<string, LeaveBalanceWithDetails> = {};
  (balances || []).forEach((b: LeaveBalanceWithDetails) => {
    balancesByType[b.leave_type_code] = b;
  });

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="time-off">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Time Off</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Gestiona tus vacaciones y licencias
            </p>
          </div>
          <Link
            href="/portal/time-off/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Nueva solicitud
          </Link>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Vacaciones */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Vacaciones</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-900">
                  {balancesByType['vacation']?.available_days ?? 0}
                  <span className="text-sm font-normal text-zinc-500">
                    {' '}/ {(balancesByType['vacation']?.entitled_days ?? 0) + (balancesByType['vacation']?.carried_over ?? 0)} días
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Días Pow */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Días Pow</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-900">
                  {balancesByType['pow_days']?.available_days ?? 0}
                  <span className="text-sm font-normal text-zinc-500">
                    {' '}/ {(balancesByType['pow_days']?.entitled_days ?? 0) + (balancesByType['pow_days']?.carried_over ?? 0)} días
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Estudio */}
          {employee.is_studying && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Estudio</p>
                  <p className="mt-0.5 text-2xl font-bold text-zinc-900">
                    {balancesByType['study']?.available_days ?? 0}
                    <span className="text-sm font-normal text-zinc-500">
                      {' '}/ {balancesByType['study']?.entitled_days ?? 0} días
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Trabajo Remoto */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Trabajo Remoto</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-900">
                  {balancesByType['remote_work']?.available_days ?? 0}
                  <span className="text-sm font-normal text-zinc-500">
                    {' '}/ {balancesByType['remote_work']?.entitled_days ?? 0} semanas
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info banners */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-medium text-blue-900">Sobre las vacaciones</h3>
            <p className="mt-1 text-sm text-blue-700">
              Recuerda comunicar tus vacaciones con <strong>45 días de anticipación</strong> y
              coordinarlas con tu jefe directo.
            </p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <h3 className="font-medium text-purple-900">Días Pow</h3>
            <p className="mt-1 text-sm text-purple-700">
              Tus días Pow son <strong>acumulables</strong> y puedes tomarlos de a uno o todos
              juntos.
            </p>
          </div>
        </div>

        {/* Recent requests */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Mis solicitudes</h2>
            <Link
              href="/portal/time-off/requests"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Ver todas →
            </Link>
          </div>
          {requests && requests.length > 0 ? (
            <ul className="divide-y divide-zinc-200">
              {(requests as LeaveRequestWithDetails[]).map((request) => (
                <li key={request.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{request.leave_type_name}</p>
                      <p className="text-sm text-zinc-500">
                        {new Date(request.start_date).toLocaleDateString('es-AR')} -{' '}
                        {new Date(request.end_date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600">
                        {request.days_requested} día{request.days_requested > 1 ? 's' : ''}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          request.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {request.status === 'pending'
                          ? 'Pendiente'
                          : request.status === 'approved'
                          ? 'Aprobada'
                          : request.status === 'rejected'
                          ? 'Rechazada'
                          : 'Cancelada'}
                      </span>
                    </div>
                  </div>
                  {request.rejection_reason && (
                    <p className="mt-2 text-sm text-red-600">Motivo: {request.rejection_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">
              No tienes solicitudes recientes
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
