import { redirect } from 'next/navigation';
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
        <ManualStep image="/manual/capacitaciones-admin/02-cola.png" n={1} title="Dónde encontrarlo" imageAlt="Menú lateral del admin con 'Capacitaciones' resaltado en la sección Gestión.">
          <p>En el menú lateral, dentro de <b>Gestión → Capacitaciones</b>. Ahí ves todas las solicitudes del Fondo.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/02-cola.png" n={2} title="Solicitudes y Budget" imageAlt="Toggle 'Solicitudes / Budget' arriba, y la cola de solicitudes con Colaborador, Curso, Costo y Estado.">
          <p>Arriba tenés un toggle entre <b>Solicitudes</b> (la cola de aprobación/pagos) y <b>Budget</b> (el seguimiento del programa). La cola se puede filtrar por estado.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/04-gestionar.png" n={3} title="Gestionar una solicitud" imageAlt="Fila expandida mostrando el detalle del curso (proveedor, carga, link, objetivo) y las acciones.">
          <p>Tocá <b>Gestionar</b> para ver el detalle (proveedor, carga horaria, link, objetivo, relación con el rol) y las acciones disponibles según el estado.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/04-gestionar.png" n={4} title="Aprobación del líder" imageAlt="Panel de una solicitud en 'Solicitado' con el botón 'Aprobar (líder) → HR'.">
          <p>Con la solicitud en <b>Solicitado</b>, el líder la aprueba con <b>Aprobar (líder) → HR</b>. Pasa a la segunda instancia.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/05-aprobacion-hr.png" n={5} title="Aprobación de HR" imageAlt="Panel de una solicitud en 'Aprobado por líder': para cursos en ARS, el campo de MEP para fijar el USD, y el botón Aprobar (HR).">
          <p>En <b>Aprobado por líder</b>, HR valida contra el <b>budget en USD</b>. Si el curso está en <b>ARS</b>, ingresás el <b>MEP</b> para fijar el equivalente en USD (el sistema muestra la conversión). Al aprobar, el monto queda comprometido en el budget del colaborador.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/06-pago-inicial.png" n={6} title="Pago 50% inicial" imageAlt="Panel con la factura cargada, el campo de MEP del día y el botón 'Registrar pago 50% inicial'.">
          <p>Cuando el colaborador carga la <b>factura</b>, aparece <b>Registrar pago 50% inicial</b>: ingresás el <b>MEP del día</b> y el reintegro en ARS se imputa al <b>período de liquidación abierto</b> (concepto "reintegro extraordinario"). En monotributo se computa; en dependencia se informa.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/07-pago-final.png" n={7} title="Pago 50% final" imageAlt="Panel con el certificado cargado y el botón 'Registrar pago 50% final'.">
          <p>Al finalizar el curso, el colaborador carga el <b>certificado</b>; ahí registrás el <b>pago 50% final</b> (mismo mecanismo con el MEP del día). La solicitud queda <b>Finalizada</b>.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/04-gestionar.png" n={8} title="Rechazar" imageAlt="Panel con el campo de motivo y el botón 'Rechazar'.">
          <p>El líder o HR pueden <b>rechazar</b> con un <b>motivo obligatorio</b>; el colaborador recibe el aviso con la explicación.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/09-budget.png" n={9} title="Vista de Budget" imageAlt="Vista 'Budget' con el selector de año, el default anual, las cards global (total/comprometido/consumido/disponible) y las tablas por área y por persona.">
          <p>En el toggle <b>Budget</b> ves el consumo del programa: cards globales, y el detalle <b>por área</b> y <b>por persona</b> (total, comprometido, consumido y disponible en USD). Arriba elegís el <b>año</b>: cada año tiene su propio budget.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/10-budget-default.png" n={10} title="Cambiar el budget de todos" imageAlt="Campo 'Budget por persona (default)' con su botón Guardar, arriba de la vista de Budget.">
          <p>El campo <b>Budget por persona (default)</b> es el monto que le corresponde a todo el mundo. Cambiarlo aplica de inmediato a quienes no tengan un budget propio, y <b>no pisa</b> los budgets individuales que ya hayas asignado.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/11-budget-persona.png" n={11} title="Ajustar el budget de una persona" imageAlt="Tabla 'Por persona' con el monto de una fila convertido en campo editable y los botones Guardar y Cancelar.">
          <p>En la tabla <b>Por persona</b>, hacé clic sobre el <b>monto</b> de la fila y escribí el nuevo. Enter guarda, Escape cancela. La fila queda marcada como <b>propio</b> para distinguirla de las que siguen el default.</p>
          <p>Si el nuevo monto queda por <b>debajo de lo que la persona ya comprometió o gastó</b>, te avisa: su disponible pasa a cero, pero lo ya aprobado no se revierte.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-admin/12-budget-masivo.png" n={12} title="Asignar budget a varias personas" imageAlt="Varias filas tildadas y la barra de acciones con el monto, 'Asignar a N' y 'Volver al default'.">
          <p>Tildá las personas que quieras y aparece la barra de acciones: escribí un monto y <b>Asignar a N</b>, o <b>Volver al default</b> para quitarles el budget propio.</p>
          <p>Para un área entera, filtrá por <b>área</b> y usá el tilde del encabezado para seleccionarlas todas. Al cambiar de área la selección se limpia, para que no asignes sin querer a gente que dejaste de ver.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
