'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useTransition } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

type AdminShellProps = {
  children: ReactNode;
  active: 'dashboard' | 'busquedas' | 'candidatos' | 'configuracion';
};

const navItems: { key: AdminShellProps['active']; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'busquedas', label: 'Búsquedas' },
  { key: 'candidatos', label: 'Candidatos' },
  { key: 'configuracion', label: 'Configuración' },
];

export function AdminShell({ children, active }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/admin/login');
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <span className="rounded-md bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Gestión de CV
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'dashboard'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Dashboard</span>
            {active === 'dashboard' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/jobs"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'busquedas'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Búsquedas</span>
            {active === 'busquedas' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/candidates"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'candidatos'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Candidatos</span>
            {active === 'candidatos' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
          <Link
            href="/admin/configuracion"
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active === 'configuracion'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            <span>Configuración</span>
            {active === 'configuracion' && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </Link>
        </nav>
        <div className="border-t border-zinc-200 px-3 py-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-all duration-150 hover:bg-zinc-100 hover:text-black disabled:opacity-50"
          >
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Sistema de Gestión de CV</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">
              Resumen general del sistema de selección
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {pathname}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-zinc-50 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}


