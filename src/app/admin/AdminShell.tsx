'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type AdminShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'people' | 'busquedas' | 'candidatos' | 'referidos' | 'configuracion';
};

export function AdminShell({ children, active }: AdminShellProps) {

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <span className="rounded-md bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            HR Admin
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin"
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
            href="/admin/people"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'people'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>People</span>
            {active === 'people' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/jobs"
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
            href="/admin/candidates"
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
          <Link
            href="/admin/referidos"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'referidos'
                ? 'bg-black text-white shadow-sm'
                : 'text-secondary-foreground hover:bg-secondary hover:text-black'
            }`}
          >
            <span>Referidos</span>
            {active === 'referidos' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/configuracion"
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
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Sistema de Recursos Humanos</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              Panel de administración
            </p>
          </div>
          <AdminProfileDropdown />
        </header>

        <main className="min-w-0 flex-1 bg-muted px-8 py-8">{children}</main>
      </div>
    </div>
  );
}


