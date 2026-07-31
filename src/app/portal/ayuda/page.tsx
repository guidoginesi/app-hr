import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function PortalAyudaPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="ayuda">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ayuda</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cómo usar las funcionalidades del portal.</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground">Adelantos de sueldo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cómo pedir un adelanto y seguir su estado.</p>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
            <p className="mt-2 text-sm text-foreground">
              Pedís el adelanto desde el portal → lo revisan <b>People</b> y <b>Administración</b> → si se aprueba, te lo <b>transfieren</b> →
              se <b>descuenta</b> de tu próxima liquidación. Te avisamos por email en cada paso.
            </p>
          </div>

          <div className="mt-8 space-y-10">
            <ManualStep n={1} title="Dónde pedirlo" imageAlt="Menú del portal con 'Adelantos' resaltado en 'Mi trabajo'.">
              <p>En el menú del portal, entrá a <b>Adelantos</b>. Ahí solicitás y ves el estado de tus adelantos.</p>
            </ManualStep>

            <ManualStep n={2} title="Cargar la solicitud" imageAlt="Formulario 'Nueva solicitud' con el campo de monto y el toggle de emergencia.">
              <p>Tocá <b>Solicitar adelanto</b> y completá el <b>monto</b> que necesitás. Si es una <b>emergencia</b>, activá el toggle: se trata como extraordinaria y te va a pedir un motivo.</p>
            </ManualStep>

            <ManualStep n={3} title="Mirá los requisitos" imageAlt="Panel de 'Requisitos' mostrando cada regla con tilde verde o cruz roja.">
              <p>Debajo del formulario ves los <b>requisitos</b> (antigüedad, fecha, sin adelanto vigente, etc.) con un ✓ si los cumplís. Si te falta alguno, la solicitud igual avanza como <b>excepción</b> pero te pide un <b>motivo</b>.</p>
              <p>Dos cosas las revisa el equipo a mano: que el monto no supere el 50% de tu neto, y que no haya una renuncia comunicada.</p>
            </ManualStep>

            <ManualStep n={4} title="Enviar y seguir el estado" imageAlt="Lista 'Mis adelantos' con la columna Estado (Pendiente RRHH, Aprobado, etc.).">
              <p>Al enviar, tu solicitud queda en <b>Pendiente RRHH</b>. En <b>Mis adelantos</b> seguís el avance: Pendiente RRHH → Pendiente Administración → <b>Aprobado</b> → <b>Transferido</b> → <b>Saldado</b>.</p>
              <p>No podés tener dos adelantos vigentes a la vez: vas a poder pedir otro una vez que el actual se salde.</p>
            </ManualStep>

            <ManualStep n={5} title="Qué pasa después" imageAlt="Ejemplo de email de confirmación / aprobación del adelanto.">
              <p>Te llega un <b>email</b> en cada cambio importante (recibido, aprobado o rechazado con el motivo, transferido). Cuando se aprueba, Administración transfiere dentro de los 5 días hábiles.</p>
              <p>El adelanto se <b>descuenta de tu liquidación</b> del mes que corresponde. Ahí queda saldado.</p>
            </ManualStep>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground">Fondo de Capacitaciones</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cómo pedir una capacitación y seguir tu reintegro.</p>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
            <p className="mt-2 text-sm text-foreground">
              Tenés un budget anual en <b>USD</b> para capacitarte. Pedís el curso → lo aprueban tu <b>líder</b> y <b>People</b> →
              subís la <b>factura</b> y cobrás el <b>50%</b> con tu sueldo → al terminar subís el <b>certificado</b> y cobrás el <b>50%</b> restante.
            </p>
          </div>

          <div className="mt-8 space-y-10">
            <ManualStep image="/manual/capacitaciones-portal/01-budget.png" n={1} title="Dónde pedirlo" imageAlt="Menú del portal con 'Capacitaciones' resaltado en Recursos.">
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
        </div>
      </div>
    </PortalShell>
  );
}
