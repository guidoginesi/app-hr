'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type EntrenamientoIAShellProps = {
  children: ReactNode;
  active: 'ranking' | 'puntuacion' | 'sessions';
};

export function EntrenamientoIAShell({ children, active }: EntrenamientoIAShellProps) {
  const nav = [
    { key: 'ranking' as const, label: 'Ranking', href: '/admin/entrenamiento-ia' },
    { key: 'puntuacion' as const, label: 'Cargar puntos', href: '/admin/entrenamiento-ia/puntuacion' },
    { key: 'sessions' as const, label: 'Sesiones', href: '/admin/entrenamiento-ia/sessions' },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Entrenamiento IA</p>
              <p className="text-xs text-zinc-500">Ranking de capacitaciones</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active === item.key
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
              }`}
            >
              <span>{item.label}</span>
              {active === item.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>
          ))}
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

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Entrenamiento IA</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">
              Capacitaciones internas · ranking estilo Coderhouse
            </p>
          </div>
          <AdminProfileDropdown />
        </header>
        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
