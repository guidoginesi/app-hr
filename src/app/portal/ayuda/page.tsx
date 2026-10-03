import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { hasReimbursementAccess } from '@/lib/reimbursementAccess';
import { PortalAyudaLayout } from './PortalAyudaLayout';
import type { ManualCard } from '@/components/manual/ManualIndex';
import { CentroDeAyuda } from '@/components/ayuda/CentroDeAyuda';
import { armarTemas, contenidosDeAyudaPara } from '@/lib/ayudaContenidosQuery';

export const dynamic = 'force-dynamic';

// `updated` es la fecha real de la última actualización del manual: ordena la
// lista y decide el distintivo "Nuevo". Al tocar un manual, actualizarla acá.
type PortalManual = ManualCard & { onlyDependency?: boolean; onlyReimbursement?: boolean };

const MANUALS: PortalManual[] = [
  {
    href: '/portal/ayuda/dia-cumpleanos',
    title: 'Día de cumpleaños',
    desc: 'Tenés un día libre por tu cumpleaños: cuándo se acredita, entre qué fechas podés tomarlo y qué pasa si no lo usás.',
    updated: '2026-08-10',
  },
  {
    href: '/portal/ayuda/licencia-estudio',
    title: 'Licencia por estudio',
    desc: 'Cuántos días tenés para rendir, cómo pedirlos y cómo acreditar el examen con el certificado.',
    updated: '2026-08-10',
  },
  {
    href: '/portal/ayuda/licencia-enfermedad',
    title: 'Licencia por enfermedad',
    desc: 'Cómo avisar que estás de licencia, qué ve tu líder y cómo subir el certificado médico.',
    updated: '2026-08-10',
  },
  {
    href: '/portal/ayuda/adelantos',
    title: 'Adelantos de sueldo',
    desc: 'Cómo pedir un adelanto, qué requisitos se validan y cómo seguir su estado hasta el descuento en tu liquidación.',
    updated: '2026-08-03',
  },
  {
    href: '/portal/ayuda/capacitaciones',
    title: 'Fondo de Capacitaciones',
    desc: 'Tu budget anual, cómo solicitar un curso, las aprobaciones, y las cargas de factura y certificado para el reintegro.',
    updated: '2026-08-03',
  },
  {
    href: '/portal/ayuda/recibos',
    title: 'Recibos de sueldo',
    desc: 'Dónde están tus recibos, cómo descargarlos y cómo confirmar que los recibiste.',
    updated: '2026-08-03',
    /** Sólo relación de dependencia: quien factura no tiene recibos. */
    onlyDependency: true,
  },
  {
    href: '/portal/ayuda/consultas',
    title: 'Consultas',
    desc: 'Cómo hacerle una consulta al equipo de People, en cuánto te responden y cómo reabrirla si quedó algo pendiente.',
    updated: '2026-08-03',
  },
  {
    href: '/portal/ayuda/mensajes',
    title: 'Comunicaciones',
    desc: 'Dónde ver los avisos de la empresa, cuáles te piden confirmación y cuáles te llegan también por mail.',
    updated: '2026-08-04',
  },
  {
    href: '/portal/ayuda/reintegros',
    title: 'Reintegros de gastos',
    desc: 'Cómo pedir que te devuelvan un gasto que pusiste de tu bolsillo, qué comprobante hace falta y cuándo se paga.',
    updated: '2026-08-04',
    /** Sólo quien tiene el módulo habilitado: al resto no le sirve de nada. */
    onlyReimbursement: true,
  },
];

export default async function PortalAyudaPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  const isRelDep = auth.employee.employment_type === 'dependency';
  const [puedeReintegros, contenidos] = await Promise.all([
    hasReimbursementAccess(auth.employee.id),
    // Lo que carga People desde el admin: beneficios, políticas, formularios.
    contenidosDeAyudaPara(auth.employee.employment_type),
  ]);
  const manuales = MANUALS.filter(
    (m) => (!m.onlyDependency || isRelDep) && (!m.onlyReimbursement || puedeReintegros),
  );
  // Los manuales del portal son un tema más, así el buscador encuentra todo junto.
  const temas = armarTemas(contenidos, manuales);

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      description="Beneficios, políticas y cómo usar el portal."
      showBack={false}
    >
      <CentroDeAyuda temas={temas} />
    </PortalAyudaLayout>
  );
}
