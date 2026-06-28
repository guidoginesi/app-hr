'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';

type TimeOffShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'requests' | 'balances' | 'novedades' | 'certificates' | 'settings';
};

export function TimeOffShell({ children, active }: TimeOffShellProps) {
  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-subtle">
              <svg className="h-5 w-5 text-[var(--amber-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Time Off</p>
              <p className="text-xs text-muted-foreground">Vacaciones y Licencias</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/time-off"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/time-off/requests"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'requests'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Solicitudes</span>
            {active === 'requests' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/time-off/balances"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'balances'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Balances</span>
            {active === 'balances' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/time-off/novedades"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'novedades'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Novedades</span>
            {active === 'novedades' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/time-off/certificates"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'certificates'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Certificados</span>
            {active === 'certificates' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <div className="my-3 border-t border-[var(--border)]" />
          <Link
            href="/admin/time-off/settings"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'settings'
                ? 'bg-warning text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Configuración</span>
            {active === 'settings' && (
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
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Time Off</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              Gestión de vacaciones y licencias
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell detailBasePath="/portal/messages" />
            <AdminProfileDropdown />
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-muted px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
