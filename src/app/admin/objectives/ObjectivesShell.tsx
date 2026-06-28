'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type ObjectivesShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'config' | 'periods' | 'employee' | 'bonos';
};

export function ObjectivesShell({ children, active }: ObjectivesShellProps) {

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-subtle">
              <svg className="h-5 w-5 text-[var(--red-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Objetivos</p>
              <p className="text-xs text-muted-foreground">OKRs y metas</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/objectives"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-danger text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/objectives/config"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'config'
                ? 'bg-danger text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Objetivos Corporativos</span>
            {active === 'config' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/objectives/periods"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'periods'
                ? 'bg-danger text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Períodos</span>
            {active === 'periods' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/objectives/bonos"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'bonos'
                ? 'bg-danger text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Bonos</span>
            {active === 'bonos' && (
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
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Objetivos</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              OKRs y objetivos anuales
            </p>
          </div>
          <AdminProfileDropdown />
        </header>

        <main className="min-w-0 flex-1 bg-muted px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
