import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthResult } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaReintegrosPage() {
  const auth = await getAuthResult();
  // Administración también valida reintegros, así que también lee este manual.
  if (!auth.isAdmin && !auth.isAdministracion) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Reintegros"
      description="Cómo se aprueba, valida y paga un reintegro de gastos"
      advancesOnly={!auth.isAdmin && auth.isAdministracion}
    >
      <div className="space-y-8">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>

        <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El circuito, en una línea</p>
          <p className="mt-2 text-sm text-foreground">
            El colaborador carga el gasto <b>con comprobante</b> → lo aprueba <b>su líder</b> → <b>Administración</b>{' '}
            valida el comprobante fiscal y la imputación → se <b>agenda el pago</b> → se marca <b>pagado</b> con su
            comprobante. En cada paso quedan registrados la fecha y quién lo hizo.
          </p>
        </div>

        <ManualStep n={1} title="Quién puede pedir reintegros" imageAlt="Pestaña 'Habilitados' con la lista de personas y un tilde por fila.">
          <p>El módulo <b>no es para todo el equipo</b>. En <b>Reintegros → Habilitados</b> tildás persona por persona. Quien no está habilitado no ve el ítem en su portal y tampoco puede cargar gastos entrando por la URL.</p>
          <p>Para habilitar un área completa, filtrá por área y usá el tilde del encabezado. Al cambiar de área la selección se limpia, para que no habilites sin querer a gente que dejaste de ver.</p>
          <p><b>Quitarle el acceso a alguien no cancela sus reintegros en curso</b>: el gasto existió y hay que terminar de pagarlo. Sólo deja de poder cargar nuevos.</p>
          <p>Las pestañas <b>Habilitados</b> y <b>Motivos</b> las ve sólo el perfil admin. El perfil Administración entra a Reintegros —tiene que validar y pagar— pero ve únicamente la <b>Cola</b>: quién puede pedir reintegros y con qué motivos es una decisión de People, no de quien después los paga.</p>
        </ManualStep>

        <ManualStep n={2} title="Los motivos son configurables" imageAlt="Pestaña 'Motivos' con la lista y el campo para agregar uno nuevo.">
          <p>En <b>Reintegros → Motivos</b> están los motivos que el colaborador elige al cargar un gasto. Vienen seis cargados (Viáticos, Movilidad, Comidas de trabajo, Insumos, Suscripciones y Otros) y podés agregar los que quieras sin esperar un deploy.</p>
          <p>Un motivo <b>no se borra, se desactiva</b>: deja de ofrecerse en el formulario pero los reintegros que ya lo usaron siguen mostrándolo. La lista te dice en cuántos se usó cada uno.</p>
          <p>Renombrar un motivo <b>no reescribe el histórico</b>: cada reintegro guarda el nombre con el que se pidió.</p>
        </ManualStep>

        <ManualStep n={3} title="Qué carga el colaborador" imageAlt="Formulario 'Nuevo reintegro' con fecha, motivo, descripción, monto, moneda, comprobante y el archivo.">
          <p>Fecha del gasto, <b>motivo</b>, <b>descripción</b> libre, monto y moneda, el tipo y número de comprobante, el CUIT del proveedor y —obligatorio— el <b>archivo del comprobante</b>. Sin comprobante no se puede enviar: Administración no tendría con qué validarlo.</p>
          <p>Si el gasto es de hace más de <b>60 días</b>, si la fecha es futura o si el monto supera <b>ARS 300.000</b> / <b>USD 300</b>, el formulario se lo marca y le <b>exige explicar por qué</b>. Sin esa explicación no puede enviarlo; con ella, sí: un gasto real no debería quedar sin reintegrar por estar fuera de plazo.</p>
          <p>Esa explicación la ves en la solicitud —tanto vos como el líder— y queda en el historial. <b>No viaja en el mail de aviso</b>, que lleva sólo concepto, motivo y monto.</p>
          <p>Si hay clientes o proyectos cargados, aparece el selector para imputar el gasto. Es opcional.</p>
        </ManualStep>

        <ManualStep n={4} title="La aprobación del líder" imageAlt="Vista 'Reintegros del equipo' en el portal, con el botón Revisar y las acciones Aprobar y Rechazar.">
          <p>Le llega un aviso al <b>líder directo</b> por mail y en la campanita. Lo aprueba desde su portal, en <b>Reintegros del equipo</b>, con un comentario opcional; o lo rechaza, y ahí el motivo es obligatorio.</p>
          <p>El líder que decide es el que la persona tenía <b>cuando pidió el reintegro</b>, no el que tenga después: si cambia de líder a mitad del circuito, el aprobador no se muda.</p>
          <p>Desde la cola de People podés <b>aprobar en nombre del líder</b> en cualquier solicitud pendiente, con el botón <b>Aprobar como líder</b> — sirve para desatascar cuando el líder está de vacaciones. Y si la persona <b>no tiene líder cargado</b>, el aviso va directo a People y ésa es la única vía: si no, quedaría esperando a nadie.</p>
        </ManualStep>

        <ManualStep n={5} title="La validación de Administración" imageAlt="Panel de gestión con los dos tildes de validación, el monto y el tipo de cambio.">
          <p>Este es el paso de Administración. Hay que confirmar <b>dos cosas</b> con un tilde cada una, y sin las dos no se puede avanzar: que el <b>comprobante fiscal</b> está correcto y que la <b>imputación contable</b> está correcta.</p>
          <p><b>Se puede validar por un monto menor</b> al que se pidió — por ejemplo si el comprobante dice menos. En ese caso el comentario es obligatorio, y el colaborador ve el monto nuevo y el motivo en el mail y en el historial. No hace falta rechazar y pedir de nuevo.</p>
          <p>Si el gasto está en <b>USD</b>, acá se carga el <b>tipo de cambio</b>. La conversión a pesos se hace <b>una sola vez</b>, en este paso, y queda fija: los totales y los reportes suman ese importe, así que no cambian si mañana cambia el dólar.</p>
        </ManualStep>

        <ManualStep n={6} title="Agendar el pago" imageAlt="Selector de método de pago con las opciones Transferencia y Con la liquidación.">
          <p>Elegís el <b>método</b>: transferencia, o con la liquidación. Los dos están disponibles para cualquier persona; el sistema no restringe uno según la modalidad de contratación.</p>
          <p>El <b>período de pago</b> se define por el día en que <b>agendás el pago</b> —no por la fecha del gasto ni por la de validación— con el corte del día <b>20</b>: si agendás hasta el 20, el pago queda en ese mes; del 21 en adelante, en el mes siguiente. La fecha estimada es el <b>último día</b> de ese mes.</p>
          <p>Se calcula <b>una sola vez</b> y queda guardada, así la fecha que ve el colaborador no se mueve sola al pasar el corte. Ojo con esto: si validás el día 19 pero agendás el 21, el pago cae al mes siguiente.</p>
          <p className="text-muted-foreground">El pago por liquidación hoy se registra a mano. La imputación automática al período está prevista para una etapa siguiente.</p>
        </ManualStep>

        <ManualStep n={7} title="Marcar pagado" imageAlt="Botón para subir el comprobante de pago y, una vez cargado, el botón Marcar como pagado.">
          <p>Primero <b>subís el comprobante de pago</b> y después aparece <b>Marcar como pagado</b>. En ese orden a propósito: sin comprobante no se puede cerrar, así que nunca queda un reintegro dado por pagado sin evidencia.</p>
          <p>Si reemplazás el comprobante, el anterior <b>se conserva</b>: es documentación de pago y borrarla perdería trazabilidad.</p>
        </ManualStep>

        <ManualStep n={8} title="Rechazar, cancelar y el historial" imageAlt="Bloque de rechazo con el motivo obligatorio y el historial del reintegro debajo.">
          <p><b>Rechazar</b> está disponible mientras el reintegro esté abierto —esperando al líder, a validar o validado— y el motivo es siempre obligatorio. El colaborador lo ve en el mail y en su pantalla.</p>
          <p><b>El colaborador puede cancelar</b> su propio reintegro, pero sólo hasta que Administración lo valide. Después ya está imputado a un período de pago y cancelarlo dejaría la cuenta inconsistente.</p>
          <p>Abajo de cada reintegro está el <b>historial</b>: cada cambio de estado con su fecha y quién lo hizo. Lo ve también el colaborador, porque es su gasto.</p>
        </ManualStep>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Todavía no está</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Los reportes por período, persona, motivo y cliente con exportación para cashflow y E/R, y el pago
            automático por liquidación. El circuito completo sí funciona: se pide, se aprueba, se valida y se paga
            registrando el comprobante.
          </p>
        </div>
      </div>
    </AyudaLayout>
  );
}
