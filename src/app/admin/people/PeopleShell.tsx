'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type PeopleShellProps = {
  children: ReactNode;
  active: 'empleados' | 'organizacion' | 'organigrama';
};

export function PeopleShell({ children, active }: PeopleShellProps) {

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">People</p>
              <p className="text-xs text-zinc-500">Gestión de empleados</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/people"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'empleados'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Empleados</span>
            {active === 'empleados' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/people/organizacion"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'organizacion'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Organización</span>
            {active === 'organizacion' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <div
            className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 cursor-not-allowed"
          >
            <span>Organigrama</span>
            <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">Pronto</span>
          </div>
        </nav>
        <div className="border-t border-zinc-200 px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900"
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
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">People</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">
              Gestión de empleados y estructura organizacional
            </p>
          </div>
          <AdminProfileDropdown />
        </header>

        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
