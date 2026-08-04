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
      title="Comunicaciones"
      description="Cómo ver, leer y confirmar los mensajes que te enviamos."
    >

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Recibís anuncios y avisos de People en <b>Comunicaciones</b> del portal (y un aviso por <b>mail</b> cuando corresponde).
          Los abrís, se marcan como <b>leídos</b>, y algunos te piden <b>confirmar la lectura</b>.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep image="/manual/mensajes-portal/01-inbox.png" n={1} title="Dónde verlos" imageAlt="Sección 'Comunicaciones' del portal con la lista de anuncios recibidos.">
          <p>En el menú del portal entrá a <b>Comunicaciones</b> (o tocá la <b>campanita</b> de notificaciones arriba). Ahí está todo lo que te enviamos, con los no leídos destacados.</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-portal/02-detalle.png" n={2} title="Leer y confirmar" imageAlt="Un mensaje abierto con la etiqueta 'Requiere confirmación' y el botón 'Confirmar lectura'.">
          <p>Tocá un mensaje para leerlo: se marca como <b>leído</b> automáticamente. Si el mensaje <b>requiere confirmación</b>, vas a ver un botón para <b>confirmar</b> que lo leíste (queda registrado).</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-portal/03-mail.png" n={3} title="Avisos por mail" imageAlt="Ejemplo del mail de aviso de un mensaje nuevo con un botón 'Ver en el portal'.">
          <p>Algunos mensajes también te llegan por <b>mail</b>, con un botón <b>Ver en el portal</b> para entrar y leerlo completo. Si el mensaje está personalizado, el mail ya trae <b>tus datos</b>.</p>
        </ManualStep>
      </div>
    </PortalAyudaLayout>
  );
}
