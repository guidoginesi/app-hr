import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthResult } from '@/lib/checkAuth';
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
    href: '/admin/ayuda/consultas',
    emoji: '💬',
    title: 'Consultas',
    desc: 'Bandeja única de People: responder, notas internas, compartir con el líder, estados y cierre, reportes y recurrentes.',
  },
  {
    href: '/admin/ayuda/mensajes',
    emoji: '📣',
    title: 'Comunicaciones',
    desc: 'Redactar y segmentar comunicaciones (por área/líder/personas), plantillas con variables, envío por mail/Chat, filtros + export, y seguimiento de lectura y entrega.',
  },
  {
    href: '/admin/ayuda/reintegros',
    emoji: '🧮',
    title: 'Reintegros de gastos',
    desc: 'Habilitados y motivos, aprobación del líder, validación de comprobante e imputación, monto parcial y tipo de cambio, agenda de pago y comprobante de pago.',
    /** Administración valida y paga reintegros, así que también lee este manual. */
    administracion: true,
  },
];

export default async function AyudaPage() {
  const auth = await getAuthResult();
  if (!auth.isAdmin && !auth.isAdministracion) redirect('/admin/login');

  // Administración sólo ve los manuales de los módulos a los que entra.
  const visible = auth.isAdmin ? MANUALS : MANUALS.filter((m) => m.administracion);

  return (
    <AyudaLayout
      description="Manuales paso a paso de las funcionalidades de la plataforma"
      advancesOnly={!auth.isAdmin && auth.isAdministracion}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
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
