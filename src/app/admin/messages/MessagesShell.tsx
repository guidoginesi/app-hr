'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';

type Props = { children: ReactNode; active?: string };

export function MessagesShell({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar — mismo estilo que AdminMessagesClient */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cat-violet-subtle">
              <svg className="h-5 w-5 text-cat-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Mensajes</p>
              <p className="text-xs text-muted-foreground">Centro de comunicación</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/messages"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary hover:text-black transition-all duration-150"
          >
            <span>Todos los mensajes</span>
          </Link>
          <div className="my-3 border-t border-[var(--border)]" />
          <span className="flex w-full items-center justify-between rounded-lg bg-cat-violet px-3 py-2.5 text-sm font-medium text-white shadow-sm">
            <span>Configuración</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </nav>
        <div className="border-t border-[var(--border)] px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
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
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Centro de Mensajes</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">Gestión de comunicaciones y anuncios</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <AdminProfileDropdown />
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-muted px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
