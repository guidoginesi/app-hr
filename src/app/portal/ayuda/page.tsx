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
      </div>
    </PortalShell>
  );
}
