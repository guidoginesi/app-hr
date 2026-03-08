'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';

type Props = { children: ReactNode };

export function MessagesShell({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar — mismo estilo que AdminMessagesClient */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Mensajes</p>
              <p className="text-xs text-zinc-500">Centro de comunicación</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/messages"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-black transition-all duration-150"
          >
            <span>Todos los mensajes</span>
          </Link>
          <div className="my-3 border-t border-zinc-200" />
          <span className="flex w-full items-center justify-between rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm">
            <span>Configuración</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </nav>
        <div className="border-t border-zinc-200 px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Centro de Mensajes</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">Gestión de comunicaciones y anuncios</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <AdminProfileDropdown />
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
