import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireLeader, getDirectReports } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';

export const dynamic = 'force-dynamic';

export default async function PortalTeamPage() {
  const auth = await requireLeader();
  
  if (!auth || !auth.employee) {
    redirect('/portal');
  }

  const { employee, isLeader } = auth;

  // Get direct reports
  const directReports = await getDirectReports(employee.id);

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="team">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mi Equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {directReports.length} {directReports.length === 1 ? 'persona a tu cargo' : 'personas a tu cargo'}
          </p>
        </div>

        {/* Quick actions - Moved to top */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time Off Approvals */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Aprobación de Time Off</h3>
                <p className="text-sm text-zinc-500">Aprobar solicitudes de tu equipo</p>
              </div>
            </div>
            <Link
              href="/portal/team/time-off"
              className="mt-4 inline-flex items-center text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              Ver solicitudes
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Team Evaluations */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Evaluaciones del Equipo</h3>
                <p className="text-sm text-zinc-500">Evaluar a tu equipo</p>
              </div>
            </div>
            <Link
              href="/portal/evaluaciones"
              className="mt-4 inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Ver evaluaciones
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Team members list */}
        {directReports.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <ul className="divide-y divide-zinc-200">
              {directReports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/portal/team/${report.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {report.photo_url ? (
                        <img
                          src={report.photo_url}
                          alt={`${report.first_name} ${report.last_name}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                          <span className="text-sm font-semibold text-emerald-700">
                            {report.first_name.charAt(0)}{report.last_name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {report.first_name} {report.last_name}
                        </p>
                        <p className="text-xs text-zinc-500">{report.job_title || report.work_email || report.personal_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        report.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {report.status === 'active' ? 'Activo' : report.status}
                      </span>
                      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-4 text-sm text-zinc-500">No tienes personas a tu cargo</p>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
