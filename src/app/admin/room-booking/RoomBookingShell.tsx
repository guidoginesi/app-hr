'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type RoomBookingShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'rooms' | 'bookings';
};

export function RoomBookingShell({ children, active }: RoomBookingShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
              <svg className="h-5 w-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Reserva de Salas</p>
              <p className="text-xs text-zinc-500">Gestión de espacios</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/room-booking"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </Link>
          <Link
            href="/admin/room-booking/rooms"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'rooms'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Salas</span>
            {active === 'rooms' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </Link>
          <Link
            href="/admin/room-booking/bookings"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'bookings'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Reservas</span>
            {active === 'bookings' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
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

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Reserva de Salas</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">Gestión de salas de reunión y reservas</p>
          </div>
          <AdminProfileDropdown />
        </header>
        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
