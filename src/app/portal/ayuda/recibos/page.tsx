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
      title="Recibos de sueldo"
      description="Cómo descargar tu recibo y confirmar que lo recibiste."
    >

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Cuando publicamos tu recibo te avisamos por <b>mail</b> y en el portal. Entrás a <b>Recibos de sueldo</b>,
          lo <b>descargás</b> y marcás la casilla <b>“Recibido”</b>. Eso deja constancia de que accediste al
          documento — <b>no</b> significa que estés de acuerdo con lo liquidado.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde están tus recibos" imageAlt="Menú del portal con 'Recibos de sueldo' resaltado y la lista de recibos por mes.">
          <p>En el menú del portal, entrá a <b>Recibos de sueldo</b>. Vas a ver todos tus recibos por mes, del más nuevo al más viejo, con la fecha en que se publicaron.</p>
        </ManualStep>

        <ManualStep n={2} title="Descargar y confirmar" imageAlt="Una fila con la casilla 'Recibido' sin tildar y el botón 'Descargar PDF'.">
          <p>Tocá <b>Descargar PDF</b> para bajarlo (si tu recibo tiene dos archivos vas a ver <b>PDF 1</b> y <b>PDF 2</b>). Después marcá la casilla <b>Recibido</b>: queda registrada la fecha y la hora, y vas a ver la leyenda <i>“Confirmaste la recepción el …”</i>.</p>
          <p>Si no la marcás, te vamos a mandar un <b>recordatorio</b> hasta que lo hagas.</p>
        </ManualStep>

        <ManualStep n={3} title="Si tu recibo se corrige" imageAlt="Aviso en la fila: 'Este recibo fue actualizado el X, volvé a confirmar la recepción'.">
          <p>Si People publica una <b>versión corregida</b> de tu recibo, te avisamos y vas a ver el mensaje <b>“Este recibo fue actualizado…”</b>. Descargá la versión nueva y volvé a marcar <b>Recibido</b>.</p>
        </ManualStep>

        <ManualStep n={4} title="Tus recibos anteriores" imageAlt="Lista con varios meses, algunos con la casilla ya tildada.">
          <p>Tus recibos anteriores quedan siempre disponibles en esa misma pantalla, junto con tus constancias de recepción.</p>
          <p>¿Dudas con lo liquidado? Escribinos por el <b>chat del portal</b> — la casilla “Recibido” es solo constancia de que recibiste el documento.</p>
        </ManualStep>
      </div>
    </PortalAyudaLayout>
  );
}
