'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useTransition, useState, useRef, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import type { Employee } from '@/types/employee';
import { NotificationBell } from '@/components/NotificationBell';

type PortalShellProps = {
  children: ReactNode;
  employee: Employee;
  isLeader: boolean;
  active: 'dashboard' | 'profile' | 'team' | 'evaluaciones' | 'objetivos' | 'time-off' | 'liquidaciones' | 'recibos' | 'messages' | 'offboarding' | 'room-booking' | 'certificates' | 'referidos' | 'entrenamiento-ia';
};

export function PortalShell({ children, employee, isLeader, active }: PortalShellProps) {
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

  const isRelDep = employee.employment_type === 'dependency';

  const navGroups: { label: string; items: { key: PortalShellProps['active']; label: string; href: string }[] }[] = [
    {
      label: 'General',
      items: [{ key: 'dashboard', label: 'Dashboard', href: '/portal' }],
    },
    {
      label: 'Mi trabajo',
      items: [
        { key: 'time-off', label: 'Time Off', href: '/portal/time-off' },
        { key: 'evaluaciones', label: 'Evaluaciones', href: '/portal/evaluaciones' },
        { key: 'objetivos', label: 'Objetivos', href: '/portal/objetivos' },
        { key: 'entrenamiento-ia', label: 'Entrenamiento IA', href: '/portal/entrenamiento-ia' },
        ...(!isRelDep ? [{ key: 'liquidaciones' as const, label: 'Liquidaciones', href: '/portal/liquidaciones' }] : []),
        { key: 'certificates', label: 'Certificados', href: '/portal/certificates' },
        { key: 'messages', label: 'Mensajes', href: '/portal/messages' },
      ],
    },
    {
      label: 'Recursos',
      items: [
        { key: 'room-booking', label: 'Reserva de Salas', href: '/portal/room-booking' },
        ...(isRelDep ? [{ key: 'recibos' as const, label: 'Recibos de sueldo', href: '/portal/recibos' }] : []),
        { key: 'referidos', label: 'Referidos', href: '/portal/referidos' },
      ],
    },
    ...(isLeader ? [{ label: 'Equipo', items: [{ key: 'team' as const, label: 'Mi Equipo', href: '/portal/team' }] }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-52 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white">
        {/* Logo / header */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none text-foreground">Portal</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Empleados</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = active === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="mr-2 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie del sidebar: usuario + notificaciones (patrón app-adm) */}
        <div className="mt-auto space-y-1 border-t border-[var(--border)] p-2">
          <NotificationBell direction="up" label="Notificaciones" />
          <div className="relative min-w-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary ${isProfileOpen ? 'bg-secondary' : ''}`}
              >
                {employee.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={`${employee.first_name} ${employee.last_name}`}
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-2 ring-ring"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white ring-2 ring-ring">
                    {initials}
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{employee.first_name} {employee.last_name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{employee.job_title || 'Empleado'}</span>
                </span>
                <svg
                  className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu (abre hacia arriba) */}
              {isProfileOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-[var(--border)] bg-white py-2 shadow-lg">
                  {/* User info header */}
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <p className="font-semibold text-foreground">{employee.first_name} {employee.last_name}</p>
                    <p className="text-sm text-muted-foreground">{employee.work_email || employee.personal_email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/portal/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-muted"
                    >
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Mi Perfil
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-[var(--border)] py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleLogout();
                      }}
                      disabled={isPending}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

      {/* Main content (sin barra superior, patrón app-adm) */}
      <main className="min-w-0 flex-1 bg-muted">
        <div className="mx-auto max-w-[1400px] px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
