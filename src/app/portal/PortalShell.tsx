'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useTransition, useState, useRef, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import type { Employee } from '@/types/employee';
import { NotificationBell } from '@/components/NotificationBell';

type PortalShellProps = {
  children: ReactNode;
  employee: Employee;
  isLeader: boolean;
  active: 'dashboard' | 'profile' | 'team' | 'evaluaciones' | 'objetivos' | 'time-off' | 'messages' | 'offboarding' | 'room-booking';
};

export function PortalShell({ children, employee, isLeader, active }: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/portal/login');
      router.refresh();
    });
  };

  // Get initials for avatar
  const initials = `${employee.first_name?.charAt(0) || ''}${employee.last_name?.charAt(0) || ''}`.toUpperCase();

  const navItems = [
    { key: 'dashboard' as const, label: 'Dashboard', href: '/portal' },
    { key: 'time-off' as const, label: 'Time Off', href: '/portal/time-off' },
    { key: 'evaluaciones' as const, label: 'Evaluaciones', href: '/portal/evaluaciones' },
    { key: 'objetivos' as const, label: 'Objetivos', href: '/portal/objetivos' },
    { key: 'messages' as const, label: 'Mensajes', href: '/portal/messages' },
    ...(isLeader ? [{ key: 'team' as const, label: 'Mi Equipo', href: '/portal/team' }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <span className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Portal
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active === item.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
              }`}
            >
              <span>{item.label}</span>
              {active === item.key && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </Link>
          ))}
        </nav>

      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Portal de Empleados</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">
              Bienvenido, {employee.first_name}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <NotificationBell detailBasePath="/portal/messages" />

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-zinc-100"
            >
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={`${employee.first_name} ${employee.last_name}`}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-zinc-200"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white ring-2 ring-emerald-200">
                  {initials}
                </div>
              )}
              <div className="hidden text-left md:block">
                <p className="font-medium text-zinc-900">{employee.first_name} {employee.last_name}</p>
                <p className="text-xs text-zinc-500">{employee.job_title || 'Empleado'}</p>
              </div>
              <svg
                className={`h-4 w-4 text-zinc-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                {/* User info header */}
                <div className="border-b border-zinc-100 px-4 py-3">
                  <p className="font-semibold text-zinc-900">{employee.first_name} {employee.last_name}</p>
                  <p className="text-sm text-zinc-500">{employee.work_email || employee.personal_email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    href="/portal/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Mi Perfil
                  </Link>

                  <Link
                    href="/portal/evaluaciones"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Evaluaciones
                  </Link>

                  <Link
                    href="/portal/objetivos"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Objetivos
                  </Link>

                  {isLeader && (
                    <Link
                      href="/portal/team"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Mi Equipo
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-zinc-100 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleLogout();
                    }}
                    disabled={isPending}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
