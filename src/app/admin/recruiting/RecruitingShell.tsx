'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type RecruitingShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'busquedas' | 'candidatos' | 'configuracion';
};

export function RecruitingShell({ children, active }: RecruitingShellProps) {

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Reclutamiento</p>
              <p className="text-xs text-muted-foreground">Gestión de selección</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/recruiting"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/recruiting/jobs"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'busquedas'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Búsquedas</span>
            {active === 'busquedas' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/recruiting/candidates"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'candidatos'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Candidatos</span>
            {active === 'candidatos' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <div className="my-3 border-t border-[var(--border)]" />
          <Link
            href="/admin/recruiting/config"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'configuracion'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Configuración</span>
            {active === 'configuracion' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
        </nav>
        <div className="border-t border-[var(--border)] px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Volver al inicio</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Reclutamiento</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              Gestión de búsquedas y candidatos
            </p>
          </div>
          <AdminProfileDropdown />
        </header>

        <main className="min-w-0 flex-1 bg-muted px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
