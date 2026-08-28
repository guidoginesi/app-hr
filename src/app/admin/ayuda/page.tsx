import { redirect } from 'next/navigation';
import { getAuthResult } from '@/lib/checkAuth';
import { AyudaLayout } from './AyudaLayout';
import { ManualIndex, type ManualCard } from '@/components/manual/ManualIndex';

export const dynamic = 'force-dynamic';

// `updated` es la fecha real de la última actualización del manual: ordena la
// lista y decide el distintivo "Nuevo". Al tocar un manual, actualizarla acá.
type AdminManual = ManualCard & { administracion?: boolean };

const MANUALS: AdminManual[] = [
  {
    href: '/admin/ayuda/agente-de-respuestas',
    title: 'Agente de respuestas',
    desc: 'El Manual RRHH adentro de la app: qué se le puede citar a un colaborador, cómo el agente propone una respuesta a una consulta, y cómo se captura lo que el manual no dice.',
    updated: '2026-08-16',
  },
  {
    href: '/admin/ayuda/banco-de-talentos',
    title: 'Banco de Talentos',
    desc: 'Postulaciones espontáneas desde el portal público: los cuatro estados, asignar a una búsqueda abierta, qué pasa cuando alguien vuelve a anotarse y cómo se editan las áreas.',
    updated: '2026-08-11',
  },
  {
    href: '/admin/ayuda/licencia-enfermedad',
    title: 'Licencia por enfermedad',
    desc: 'Circuito sin aprobación, aviso al líder sin datos de salud, certificado médico con plazo, y el KPI de ausentismo (tasa, frecuencia, duración, ranking).',
    updated: '2026-08-10',
  },
  {
    href: '/admin/ayuda/adelantos',
    title: 'Adelantos de sueldo',
    desc: 'Solicitud, validación automática, aprobación (RRHH → Administración), transferencia y descuento en la liquidación.',
    updated: '2026-07-30',
  },
  {
    href: '/admin/ayuda/capacitaciones',
    title: 'Fondo de Capacitaciones',
    desc: 'Solicitud, aprobación (líder → HR), cargas de factura/certificado, pagos con MEP y reintegro por liquidación, y vista de budget.',
    updated: '2026-08-02',
  },
  {
    href: '/admin/ayuda/recibos',
    title: 'Recepción de recibos',
    desc: 'Estado por período (publicados, confirmados y pendientes), recordatorios manuales y automáticos, export de constancias y recibos corregidos.',
    updated: '2026-08-01',
  },
  {
    href: '/admin/ayuda/consultas',
    title: 'Consultas',
    desc: 'Bandeja única de People: responder, editar una respuesta ya enviada, notas internas, compartir con el líder, estados y cierre, reportes y recurrentes.',
    updated: '2026-08-16',
  },
  {
    href: '/admin/ayuda/mensajes',
    title: 'Comunicaciones',
    desc: 'Redactar y segmentar comunicaciones (por área/líder/personas), plantillas con variables, envío por mail/Chat, filtros + export, y seguimiento de lectura y entrega.',
    updated: '2026-08-04',
  },
  {
    href: '/admin/ayuda/reintegros',
    title: 'Reintegros de gastos',
    desc: 'Habilitados y motivos, hasta 5 comprobantes por gasto, aprobación del líder, validación e imputación, monto parcial y tipo de cambio, agenda de pago y comprobante de pago.',
    updated: '2026-08-28',
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
      description="Cómo funciona cada módulo de la plataforma, paso a paso."
      advancesOnly={!auth.isAdmin && auth.isAdministracion}
      showBack={false}
    >
      <ManualIndex manuals={visible} />
    </AyudaLayout>
  );
}
