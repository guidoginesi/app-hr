'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserPlus,
  ClipboardCheck,
  Target,
  GraduationCap,
  CalendarDays,
  Wallet,
  Banknote,
  DoorOpen,
  MessageSquare,
  Settings,
  BookOpen,
} from 'lucide-react';
import { NavSidebar, type NavGroup } from '@pow/ui/components/ui/nav-sidebar';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

type AdminShellProps = {
  children: ReactNode;
  // Aceptado por compatibilidad con llamadas existentes; el ítem activo se
  // deriva del pathname, así que no hace falta pasarlo.
  active?: string;
  // Perfil Administración (aprobador de adelantos): nav recortada a Adelantos.
  advancesOnly?: boolean;
};

export function AdminShell({ children, advancesOnly = false }: AdminShellProps) {
  const pathname = usePathname() || '';

  const match = (href: string, ...aliases: string[]) =>
    [href, ...aliases].some((h) => pathname === h || pathname.startsWith(h + '/'));

  const groups: NavGroup[] = [
    {
      items: [
        { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, active: pathname === '/admin' },
      ],
    },
    {
      label: 'Personas',
      items: [
        { label: 'People', href: '/admin/people', icon: Users, active: match('/admin/people') },
        { label: 'Reclutamiento', href: '/admin/recruiting', icon: Briefcase, active: match('/admin/recruiting', '/admin/jobs', '/admin/candidates') },
        { label: 'Referidos', href: '/admin/referidos', icon: UserPlus, active: match('/admin/referidos') },
      ],
    },
    {
      label: 'Desempeño',
      items: [
        { label: 'Evaluaciones', href: '/admin/evaluations', icon: ClipboardCheck, active: match('/admin/evaluations') },
        { label: 'Objetivos', href: '/admin/objectives', icon: Target, active: match('/admin/objectives') },
        { label: 'Entrenamiento IA', href: '/admin/entrenamiento-ia', icon: GraduationCap, active: match('/admin/entrenamiento-ia') },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { label: 'Time Off', href: '/admin/time-off', icon: CalendarDays, active: match('/admin/time-off') },
        { label: 'Liquidaciones', href: '/admin/payroll', icon: Wallet, active: match('/admin/payroll') },
        { label: 'Adelantos', href: '/admin/salary-advances', icon: Banknote, active: match('/admin/salary-advances') },
      ],
    },
    {
      label: 'Espacio de trabajo',
      items: [
        { label: 'Reserva de Salas', href: '/admin/room-booking', icon: DoorOpen, active: match('/admin/room-booking') },
        { label: 'Mensajes', href: '/admin/messages', icon: MessageSquare, active: match('/admin/messages') },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { label: 'Configuración', href: '/admin/configuracion', icon: Settings, active: match('/admin/configuracion') },
        { label: 'Ayuda', href: '/admin/ayuda', icon: BookOpen, active: match('/admin/ayuda') },
      ],
    },
  ];

  const navGroups: NavGroup[] = advancesOnly
    ? [
        {
          label: 'Gestión',
          items: [
            { label: 'Adelantos', href: '/admin/salary-advances', icon: Banknote, active: match('/admin/salary-advances') },
          ],
        },
      ]
    : groups;

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      <NavSidebar
        groups={navGroups}
        header={
          <a href="/admin" className="flex items-center gap-2">
            <img src="/brand/pow-logo-horizontal.svg" alt="Pow" className="h-6 w-auto" />
            <span className="type-label text-muted-foreground">Admin</span>
          </a>
        }
        footer={<AdminProfileDropdown direction="up" fullWidth />}
      />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
