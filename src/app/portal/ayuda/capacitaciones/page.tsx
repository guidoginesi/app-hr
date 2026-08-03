import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { ManualStep } from '@/components/manual/ManualStep';
import { PortalAyudaLayout } from '../PortalAyudaLayout';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      title="Fondo de Capacitaciones"
      description="Cómo pedir una capacitación y seguir tu reintegro."
    >

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Tenés un budget anual en <b>USD</b> para capacitarte. Pedís el curso → lo aprueban tu <b>líder</b> y <b>People</b> →
          subís la <b>factura</b> y cobrás el <b>50%</b> con tu sueldo → al terminar subís el <b>certificado</b> y cobrás el <b>50%</b> restante.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep image="/manual/capacitaciones-portal/01-budget.png" n={1} title="Dónde pedirlo" imageAlt="Menú del portal con 'Capacitaciones' resaltado en Gestión.">
          <p>En el menú del portal, entrá a <b>Capacitaciones</b>. Ahí ves tu budget y solicitás.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-portal/01-budget.png" n={2} title="Tu budget" imageAlt="Las tres cards: Budget anual (USD 500), Consumido/comprometido y Disponible.">
          <p>Arriba ves tu <b>budget anual</b>, lo <b>consumido/comprometido</b> y lo <b>disponible</b>. El saldo se reinicia cada año calendario (lo no usado se pierde).</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-portal/03-form.png" n={3} title="Solicitar" imageAlt="Formulario 'Nueva solicitud' con datos del curso, costo y moneda (USD/ARS).">
          <p>Tocá <b>Solicitar capacitación</b> y completá los datos (curso, proveedor, fechas, <b>costo</b> y <b>moneda</b>). Podés cargarlo en USD o ARS. Necesitás <b>6 meses</b> de antigüedad y saldo disponible.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-portal/04-stepper.png" n={4} title="Seguir el estado" imageAlt="Una solicitud con el stepper: Solicitado → Aprob. líder → Aprob. HR → Factura → Pago 50% → Certificado → Pago final.">
          <p>Cada solicitud muestra un <b>stepper</b> con el avance. Podés <b>cancelar</b> mientras no se haya ejecutado (se libera el saldo reservado).</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-portal/05-upload.png" n={5} title="Cargar factura y certificado" imageAlt="Dropzone para subir la factura (tras la aprobación de HR) y luego el certificado.">
          <p>Cuando People aprueba, subís la <b>factura</b> para cobrar el 50% inicial. Al terminar el curso, subís el <b>certificado</b> para el 50% final.</p>
        </ManualStep>

        <ManualStep image="/manual/capacitaciones-portal/06-done.png" n={6} title="Qué pasa después" imageAlt="La solicitud en estado 'Finalizado' con el stepper completo.">
          <p>Te llega un <b>email</b> en cada paso. El reintegro se paga en <b>pesos</b> (al MEP del día) <b>junto con tu sueldo</b>. Si dejás Pow antes de terminar, no se paga el 50% final.</p>
        </ManualStep>
      </div>
    </PortalAyudaLayout>
  );
}
