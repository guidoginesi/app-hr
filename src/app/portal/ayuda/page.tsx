import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalAyudaLayout } from './PortalAyudaLayout';

export const dynamic = 'force-dynamic';

const MANUALS = [
  {
    href: '/portal/ayuda/adelantos',
    emoji: '💸',
    title: 'Adelantos de sueldo',
    desc: 'Cómo pedir un adelanto, qué requisitos se validan y cómo seguir su estado hasta el descuento en tu liquidación.',
  },
  {
    href: '/portal/ayuda/capacitaciones',
    emoji: '🎓',
    title: 'Fondo de Capacitaciones',
    desc: 'Tu budget anual, cómo solicitar un curso, las aprobaciones, y las cargas de factura y certificado para el reintegro.',
  },
  {
    href: '/portal/ayuda/recibos',
    emoji: '🧾',
    title: 'Recibos de sueldo',
    desc: 'Dónde están tus recibos, cómo descargarlos y cómo confirmar que los recibiste.',
    /** Sólo relación de dependencia: quien factura no tiene recibos. */
    onlyDependency: true,
  },
  {
    href: '/portal/ayuda/consultas',
    emoji: '💬',
    title: 'Consultas',
    desc: 'Cómo hacerle una consulta al equipo de People, en cuánto te responden y cómo reabrirla si quedó algo pendiente.',
  },
  {
    href: '/portal/ayuda/mensajes',
    emoji: '📣',
    title: 'Mensajes',
    desc: 'Dónde ver los avisos de la empresa, cuáles te piden confirmación y cuáles te llegan también por mail.',
  },
];

export default async function PortalAyudaPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  const isRelDep = auth.employee.employment_type === 'dependency';
  const visible = MANUALS.filter((m) => !m.onlyDependency || isRelDep);

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      description="Manuales paso a paso de las funcionalidades del portal"
      showBack={false}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm transition-colors hover:border-[var(--gray-300)]"
          >
            <div className="text-2xl">{m.emoji}</div>
            <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-[var(--brand-strong)]">
              {m.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          </Link>
        ))}
      </div>
    </PortalAyudaLayout>
  );
}
