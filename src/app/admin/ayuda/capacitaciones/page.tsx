import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaCapacitacionesPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Fondo de Capacitaciones"
      description="Cómo gestionar las solicitudes de capacitación: de la aprobación al reintegro por liquidación."
    >
      <div className="mb-2">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El flujo, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          El colaborador solicita → <b>líder</b> aprueba → <b>HR</b> aprueba (valida budget en USD) → carga <b>factura</b> →
          <b> pago 50% inicial</b> → carga <b>certificado</b> → <b>pago 50% final</b> → finalizado. Los pagos son un reintegro
          en ARS (al MEP del día) que se imputa a la liquidación del colaborador.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde encontrarlo" imageAlt="Menú lateral del admin con 'Capacitaciones' resaltado en la sección Gestión.">
          <p>En el menú lateral, dentro de <b>Gestión → Capacitaciones</b>. Ahí ves todas las solicitudes del Fondo.</p>
        </ManualStep>

        <ManualStep n={2} title="Solicitudes y Budget" imageAlt="Toggle 'Solicitudes / Budget' arriba, y la cola de solicitudes con Colaborador, Curso, Costo y Estado.">
          <p>Arriba tenés un toggle entre <b>Solicitudes</b> (la cola de aprobación/pagos) y <b>Budget</b> (el seguimiento del programa). La cola se puede filtrar por estado.</p>
        </ManualStep>

        <ManualStep n={3} title="Gestionar una solicitud" imageAlt="Fila expandida mostrando el detalle del curso (proveedor, carga, link, objetivo) y las acciones.">
          <p>Tocá <b>Gestionar</b> para ver el detalle (proveedor, carga horaria, link, objetivo, relación con el rol) y las acciones disponibles según el estado.</p>
        </ManualStep>

        <ManualStep n={4} title="Aprobación del líder" imageAlt="Panel de una solicitud en 'Solicitado' con el botón 'Aprobar (líder) → HR'.">
          <p>Con la solicitud en <b>Solicitado</b>, el líder la aprueba con <b>Aprobar (líder) → HR</b>. Pasa a la segunda instancia.</p>
        </ManualStep>

        <ManualStep n={5} title="Aprobación de HR" imageAlt="Panel de una solicitud en 'Aprobado por líder': para cursos en ARS, el campo de MEP para fijar el USD, y el botón Aprobar (HR).">
          <p>En <b>Aprobado por líder</b>, HR valida contra el <b>budget en USD</b>. Si el curso está en <b>ARS</b>, ingresás el <b>MEP</b> para fijar el equivalente en USD (el sistema muestra la conversión). Al aprobar, el monto queda comprometido en el budget del colaborador.</p>
        </ManualStep>

        <ManualStep n={6} title="Pago 50% inicial" imageAlt="Panel con la factura cargada, el campo de MEP del día y el botón 'Registrar pago 50% inicial'.">
          <p>Cuando el colaborador carga la <b>factura</b>, aparece <b>Registrar pago 50% inicial</b>: ingresás el <b>MEP del día</b> y el reintegro en ARS se imputa al <b>período de liquidación abierto</b> (concepto "reintegro extraordinario"). En monotributo se computa; en dependencia se informa.</p>
        </ManualStep>

        <ManualStep n={7} title="Pago 50% final" imageAlt="Panel con el certificado cargado y el botón 'Registrar pago 50% final'.">
          <p>Al finalizar el curso, el colaborador carga el <b>certificado</b>; ahí registrás el <b>pago 50% final</b> (mismo mecanismo con el MEP del día). La solicitud queda <b>Finalizada</b>.</p>
        </ManualStep>

        <ManualStep n={8} title="Rechazar" imageAlt="Panel con el campo de motivo y el botón 'Rechazar'.">
          <p>El líder o HR pueden <b>rechazar</b> con un <b>motivo obligatorio</b>; el colaborador recibe el aviso con la explicación.</p>
        </ManualStep>

        <ManualStep n={9} title="Vista de Budget" imageAlt="Vista 'Budget' con las cards global (total/comprometido/consumido/disponible) y las tablas por área y por persona.">
          <p>En el toggle <b>Budget</b> ves el consumo del programa: cards globales, y el detalle <b>por área</b> y <b>por persona</b> (total, comprometido, consumido y disponible en USD). Útil para el seguimiento anual.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
