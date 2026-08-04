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
      title="Reintegros"
      description="Cómo pedir que te devuelvan un gasto que pusiste de tu bolsillo."
    >
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Cargás el gasto con la foto del comprobante, lo aprueba <b>tu líder</b>, lo valida <b>Administración</b> y
          después se paga. Te avisamos por mail y en el portal en cada paso, y podés seguir el estado desde{' '}
          <b>Reintegros</b>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Si no ves Reintegros en el menú, el módulo todavía no está habilitado para tu cuenta: escribile a People por
          Consultas.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ManualStep
          n={1}
          title="Cargar el gasto"
          image="/manual/reintegros-portal/02-form.png"
          imageAlt="Formulario de nuevo reintegro con los campos del gasto, los datos del comprobante y el archivo."
        >
          <p>En <b>Reintegros → Nuevo reintegro</b> completás la <b>fecha</b> del gasto, el <b>motivo</b> (viáticos, movilidad, comidas de trabajo, insumos, suscripciones…), una <b>descripción</b> corta de qué fue y el <b>monto</b> con su moneda.</p>
          <p>Después van los datos del comprobante: <b>tipo</b> (factura A, B, C, ticket…), <b>número</b> y el <b>CUIT</b> de quien te lo emitió.</p>
          <p>El <b>archivo del comprobante es obligatorio</b> — PDF o foto, hasta 10 MB. Sin comprobante no se puede enviar, porque es lo que Administración tiene que validar. Una foto legible del ticket alcanza.</p>
        </ManualStep>

        <ManualStep
          n={2}
          title="Si el gasto está fuera de lo habitual"
          image="/manual/reintegros-portal/03-fuera-de-plazo.png"
          imageAlt="Bloque 'Revisá antes de enviar' marcando el gasto de hace 124 días y el monto sobre el tope, con el campo Motivo debajo."
        >
          <p>El formulario te avisa si el gasto es de hace <b>más de 60 días</b>, si pusiste una fecha futura o si el monto es alto (más de ARS 300.000 o USD 300). Te lo muestra en el bloque <b>Revisá antes de enviar</b>, con un <b>!</b> en lo que no cumple, y aparece el campo <b>Motivo</b> para que expliques por qué.</p>
          <p><b>No es un rechazo</b>: podés enviarlo igual, sólo tenés que contar el contexto. Esa explicación la ven tu líder y Administración junto con la solicitud, así no tienen que preguntártelo por otro canal.</p>
        </ManualStep>

        <ManualStep n={3} title="Seguir el estado" imageAlt="Lista de reintegros con los estados y el historial de uno abierto.">
          <p>Cada reintegro te muestra en qué paso está: <b>esperando a tu líder</b> → <b>en validación de Administración</b> → <b>a pagar</b> → <b>pagado</b>. Te llega un mail y una notificación en la campanita en cada cambio.</p>
          <p>Abajo de cada uno está el <b>historial</b>: qué pasó, cuándo y quién lo hizo. Si alguien dejó un comentario al aprobar o al validar, lo ves ahí.</p>
        </ManualStep>

        <ManualStep n={4} title="Cuándo te lo pagan" imageAlt="Detalle de un reintegro mostrando el método de pago y la fecha estimada.">
          <p>Cuando Administración agenda el pago aparecen el <b>método</b> (transferencia o con la liquidación) y una <b>fecha estimada</b>.</p>
          <p>El corte es el día <b>20</b>: si el pago se agenda hasta el 20, se paga dentro de ese mes; del 21 en adelante, pasa al mes siguiente. La fecha estimada es el <b>último día</b> del mes que corresponda, y una vez asignada <b>no se mueve</b>.</p>
        </ManualStep>

        <ManualStep n={5} title="Si te lo validan por menos" imageAlt="Reintegro validado por un monto menor, con el motivo a la vista.">
          <p>Administración puede validar el reintegro por un <b>monto menor</b> al que pediste —por ejemplo si el comprobante dice menos que lo cargado—. Cuando pasa, está <b>obligada a explicar por qué</b>, y ves el monto nuevo y el motivo en el mail y en el historial.</p>
          <p>Si el gasto fue en <b>dólares</b>, en ese paso se carga el <b>tipo de cambio</b> con el que se convierte a pesos. Queda fijo: lo que vas a cobrar no cambia si después se mueve el dólar.</p>
        </ManualStep>

        <ManualStep n={6} title="Cancelar o si te lo rechazan" imageAlt="Botón de cancelar en un reintegro pendiente y un reintegro rechazado con su motivo.">
          <p>Podés <b>cancelar</b> un reintegro tuyo mientras esté esperando a tu líder o recién aprobado. Una vez que Administración lo validó ya está imputado a un período de pago y no se puede cancelar solo: escribile a People por Consultas.</p>
          <p>Si te lo <b>rechazan</b>, el motivo es obligatorio y lo vas a ver en el mail y en la pantalla. Si el rechazo fue por algo corregible —faltaba el comprobante, estaba ilegible, el número no coincidía— podés <b>cargarlo de nuevo</b> con el dato corregido.</p>
        </ManualStep>

        <p className="text-sm text-muted-foreground">
          Los pasos 3 a 6 dicen &quot;captura pendiente&quot;: esas pantallas sólo existen cuando hay un reintegro en
          curso. Se agregan con el primero real.
        </p>
      </div>
    </PortalAyudaLayout>
  );
}
