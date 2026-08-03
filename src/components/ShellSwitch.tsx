'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';

type Access = { canAdmin: boolean; canPortal: boolean };

/**
 * Link para pasar del panel de administración al portal y al revés.
 *
 * Hace falta porque desde que People puede tener rol admin sobre su propia cuenta
 * de empleado (y no una cuenta compartida aparte), la misma persona usa los dos
 * lados y no tenía forma de cruzar sin editar la URL a mano.
 *
 * Sólo se muestra si el usuario realmente puede entrar al otro lado: un link que
 * después rebota contra el middleware es peor que no ofrecerlo. Por eso pregunta
 * a /api/me/access en vez de asumirlo — el shell es un componente de cliente y no
 * puede resolver roles por sí mismo.
 */
export function ShellSwitch({ to }: { to: 'admin' | 'portal' }) {
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/access')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setAccess(d);
      })
      .catch(() => {
        /* sin datos no se muestra el link */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allowed = to === 'admin' ? access?.canAdmin : access?.canPortal;
  if (!allowed) return null;

  return (
    <Link
      href={to === 'admin' ? '/admin' : '/portal'}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <ArrowLeftRight className="h-4 w-4 shrink-0" />
      <span className="truncate">{to === 'admin' ? 'Ir al panel de administración' : 'Ir al portal'}</span>
    </Link>
  );
}
