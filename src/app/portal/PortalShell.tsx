'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useTransition, useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  Target,
  GraduationCap,
  CalendarDays,
  Banknote,
  Wallet,
  FileText,
  Award,
  ScrollText,
  MessageSquare,
  MessagesSquare,
  DoorOpen,
  UserPlus,
  Users,
  BookOpen,
  Receipt,
} from 'lucide-react';
import { NavSidebar, type NavGroup } from '@pow/ui/components/ui/nav-sidebar';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import type { Employee } from '@/types/employee';
import { NotificationBell } from '@/components/NotificationBell';
import { ShellSwitch, useAccess } from '@/components/ShellSwitch';

type PortalShellProps = {
  children: ReactNode;
  employee: Employee;
  isLeader: boolean;
  active: 'dashboard' | 'profile' | 'team' | 'reintegros' | 'reintegros-equipo' | 'evaluaciones' | 'objetivos' | 'time-off' | 'adelantos' | 'capacitaciones' | 'liquidaciones' | 'recibos' | 'messages' | 'consultas' | 'consultas-equipo' | 'offboarding' | 'room-booking' | 'certificates' | 'referidos' | 'entrenamiento-ia' | 'ayuda';
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

  // Misma segmentación que el admin: Desempeño / Gestión / Espacio de trabajo /
  // Equipo / Sistema, con el Dashboard suelto arriba.
  const on = (key: PortalShellProps['active']) => active === key;
  // Reintegros no es para todo el equipo: el ítem aparece sólo si la persona está
  // habilitada. Lo resuelve el server, no el cliente.
  const access = useAccess();

  const navGroups: NavGroup[] = [
    {
      items: [{ label: 'Dashboard', href: '/portal', icon: LayoutDashboard, active: on('dashboard') }],
    },
    {
      label: 'Desempeño',
      items: [
        { label: 'Evaluaciones', href: '/portal/evaluaciones', icon: ClipboardCheck, active: on('evaluaciones') },
        { label: 'Objetivos', href: '/portal/objetivos', icon: Target, active: on('objetivos') },
        { label: 'Entrenamiento IA', href: '/portal/entrenamiento-ia', icon: GraduationCap, active: on('entrenamiento-ia') },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { label: 'Time Off', href: '/portal/time-off', icon: CalendarDays, active: on('time-off') },
        { label: 'Adelantos', href: '/portal/adelantos', icon: Banknote, active: on('adelantos') },
        ...(isRelDep
          ? [{ label: 'Recibos de sueldo', href: '/portal/recibos', icon: FileText, active: on('recibos') }]
          : [{ label: 'Liquidaciones', href: '/portal/liquidaciones', icon: Wallet, active: on('liquidaciones') }]),
        { label: 'Capacitaciones', href: '/portal/capacitaciones', icon: Award, active: on('capacitaciones') },
        { label: 'Certificados', href: '/portal/certificates', icon: ScrollText, active: on('certificates') },
        ...(access?.canReimburse
          ? [{ label: 'Reintegros', href: '/portal/reintegros', icon: Receipt, active: on('reintegros') }]
          : []),
      ],
    },
    {
      label: 'Espacio de trabajo',
      items: [
        { label: 'Comunicaciones', href: '/portal/messages', icon: MessageSquare, active: on('messages') },
        { label: 'Consultas', href: '/portal/consultas', icon: MessagesSquare, active: on('consultas') },
        { label: 'Reserva de Salas', href: '/portal/room-booking', icon: DoorOpen, active: on('room-booking') },
        { label: 'Referidos', href: '/portal/referidos', icon: UserPlus, active: on('referidos') },
      ],
    },
    ...(isLeader
      ? [
          {
            label: 'Equipo',
            items: [
              { label: 'Mi Equipo', href: '/portal/team', icon: Users, active: on('team') },
              {
                label: 'Consultas de mi equipo',
                href: '/portal/consultas-equipo',
                icon: MessagesSquare,
                active: on('consultas-equipo'),
              },
              { label: 'Reintegros del equipo', href: '/portal/team/reintegros', icon: Receipt, active: on('reintegros-equipo') },
            ],
          },
        ]
      : []),
    {
      label: 'Sistema',
      items: [{ label: 'Ayuda', href: '/portal/ayuda', icon: BookOpen, active: on('ayuda') }],
    },
  ];

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar: mismo componente y misma segmentación que el admin */}
      <NavSidebar
        groups={navGroups}
        header={
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none text-foreground">Portal</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Empleados</p>
            </div>
          </Link>
        }
        footer={
        <div className="space-y-1">
          {/* Sólo aparece para admin y Administración; ShellSwitch lo resuelve. */}
          <ShellSwitch to="admin" />
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
        }
      />

      {/* Main content (sin barra superior, patrón app-adm) */}
      <main className="min-w-0 flex-1 bg-muted">
        <div className="mx-auto max-w-[1400px] px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
