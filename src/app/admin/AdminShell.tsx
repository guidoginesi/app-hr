'use client';

import { ReactNode, useEffect, useState } from 'react';
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
  Award,
  DoorOpen,
  MessageSquare,
  MessagesSquare,
  Settings,
  Receipt,
  BookOpen,
  FileCheck,
} from 'lucide-react';
import { NavSidebar, type NavGroup } from '@pow/ui/components/ui/nav-sidebar';
import { moduleForPath, type AdminModule } from '@/lib/adminModules';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';
import { ShellSwitch } from '@/components/ShellSwitch';

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
  const [novedades, setNovedades] = useState<Partial<Record<AdminModule, number>>>({});

  // Al entrar a un módulo se marca como visto y se releen los conteos en la
  // misma llamada. El punto de ese módulo se apaga solo, que es el sentido de
  // que sea "desde tu última visita".
  useEffect(() => {
    const modulo = moduleForPath(pathname);
    const req = modulo
      ? fetch('/api/admin/pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: modulo }),
        })
      : fetch('/api/admin/pendientes');

    let vigente = true;
    req
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vigente && d?.counts) setNovedades(d.counts);
      })
      // Si falla, el sidebar se muestra sin puntos: no vale romper la nav por esto.
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [pathname]);

  const match = (href: string, ...aliases: string[]) =>
    [href, ...aliases].some((h) => pathname === h || pathname.startsWith(h + '/'));

  const hay = (m: AdminModule) => (novedades[m] ?? 0) > 0;

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
        { label: 'Reclutamiento', href: '/admin/recruiting', icon: Briefcase, active: match('/admin/recruiting', '/admin/jobs', '/admin/candidates'), badge: hay('reclutamiento'), badgeLabel: 'Tiene candidatos nuevos' },
        { label: 'Referidos', href: '/admin/referidos', icon: UserPlus, active: match('/admin/referidos'), badge: hay('referidos'), badgeLabel: 'Tiene referidos nuevos' },
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
        { label: 'Time Off', href: '/admin/time-off', icon: CalendarDays, active: match('/admin/time-off'), badge: hay('time-off'), badgeLabel: 'Tiene licencias nuevas para aprobar' },
        { label: 'Liquidaciones', href: '/admin/payroll', icon: Wallet, active: match('/admin/payroll') },
        { label: 'Adelantos', href: '/admin/salary-advances', icon: Banknote, active: match('/admin/salary-advances'), badge: hay('adelantos'), badgeLabel: 'Tiene adelantos nuevos para aprobar' },
        { label: 'Recepción de recibos', href: '/admin/recibos', icon: FileCheck, active: match('/admin/recibos'), badge: hay('recibos'), badgeLabel: 'Tiene confirmaciones nuevas' },
        { label: 'Capacitaciones', href: '/admin/training', icon: Award, active: match('/admin/training'), badge: hay('capacitaciones'), badgeLabel: 'Tiene pedidos nuevos' },
        { label: 'Reintegros', href: '/admin/reintegros', icon: Receipt, active: match('/admin/reintegros'), badge: hay('reintegros'), badgeLabel: 'Tiene reintegros nuevos' },
      ],
    },
    {
      label: 'Espacio de trabajo',
      items: [
        { label: 'Reserva de Salas', href: '/admin/room-booking', icon: DoorOpen, active: match('/admin/room-booking') },
        { label: 'Comunicaciones', href: '/admin/messages', icon: MessageSquare, active: match('/admin/messages') },
        { label: 'Consultas', href: '/admin/consultas', icon: MessagesSquare, active: match('/admin/consultas'), badge: hay('consultas'), badgeLabel: 'Tiene consultas nuevas' },
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
            { label: 'Adelantos', href: '/admin/salary-advances', icon: Banknote, active: match('/admin/salary-advances'), badge: hay('adelantos'), badgeLabel: 'Tiene adelantos nuevos para aprobar' },
            { label: 'Recepción de recibos', href: '/admin/recibos', icon: FileCheck, active: match('/admin/recibos'), badge: hay('recibos'), badgeLabel: 'Tiene confirmaciones nuevas' },
            // Administración valida los reintegros, así que entra a esta ruta.
            { label: 'Reintegros', href: '/admin/reintegros', icon: Receipt, active: match('/admin/reintegros'), badge: hay('reintegros'), badgeLabel: 'Tiene reintegros nuevos' },
            // El índice de Ayuda le muestra sólo los manuales de sus módulos.
            { label: 'Ayuda', href: '/admin/ayuda', icon: BookOpen, active: match('/admin/ayuda') },
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
        footer={
          <div className="space-y-1">
            {/* Cruce al portal: la misma persona usa los dos lados desde que
                People tiene rol admin sobre su cuenta de empleado. */}
            <ShellSwitch to="portal" />
            <NotificationBell direction="up" label="Notificaciones" detailBasePath="/admin/messages" />
            <AdminProfileDropdown direction="up" fullWidth />
          </div>
        }
      />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
