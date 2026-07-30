import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from './AyudaLayout';

export const dynamic = 'force-dynamic';

const MANUALS = [
  {
    href: '/admin/ayuda/adelantos',
    emoji: '💸',
    title: 'Adelantos de sueldo',
    desc: 'Solicitud, validación automática, aprobación (RRHH → Administración), transferencia y descuento en la liquidación.',
  },
];

export default async function AyudaPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout description="Manuales paso a paso de las funcionalidades de la plataforma">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MANUALS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm transition-colors hover:border-[var(--gray-300)]"
          >
            <div className="text-2xl">{m.emoji}</div>
            <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-[var(--brand-strong)]">{m.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          </Link>
        ))}
      </div>
    </AyudaLayout>
  );
}
