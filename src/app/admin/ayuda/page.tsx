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
  {
    href: '/admin/ayuda/capacitaciones',
    emoji: '🎓',
    title: 'Fondo de Capacitaciones',
    desc: 'Solicitud, aprobación (líder → HR), cargas de factura/certificado, pagos con MEP y reintegro por liquidación, y vista de budget.',
  },
  {
    href: '/admin/ayuda/recibos',
    emoji: '🧾',
    title: 'Recepción de recibos',
    desc: 'Estado por período (publicados, confirmados y pendientes), recordatorios manuales y automáticos, export de constancias y recibos corregidos.',
  },
  {
    href: '/admin/ayuda/mensajes',
    emoji: '📣',
    title: 'Mensajes',
    desc: 'Redactar y segmentar comunicaciones (por área/líder/personas), plantillas con variables, envío por mail/Chat, filtros + export, y seguimiento de lectura y entrega.',
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
