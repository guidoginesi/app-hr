'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type EvaluationsShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'periods' | 'dimensions' | 'open_questions' | 'all' | 'recategorizations';
};

export function EvaluationsShell({ children, active }: EvaluationsShellProps) {

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Evaluaciones</p>
              <p className="text-xs text-zinc-500">Desempeño</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/evaluations"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/evaluations/periods"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'periods'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Períodos</span>
            {active === 'periods' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/evaluations/dimensions"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dimensions'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Dimensiones</span>
            {active === 'dimensions' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/evaluations/open-questions"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'open_questions'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Preguntas Abiertas</span>
            {active === 'open_questions' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <div className="my-3 border-t border-zinc-200" />
          <Link
            href="/admin/evaluations/all"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Todas las evaluaciones</span>
            {active === 'all' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/evaluations/recategorizations"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'recategorizations'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Recategorizaciones</span>
            {active === 'recategorizations' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
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
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Evaluaciones de Desempeño</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">
              Configuración y seguimiento
            </p>
          </div>
          <AdminProfileDropdown />
        </header>

        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
