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
            <ManualStep image="/manual/adelantos-portal/01-inicio.png" n={1} title="Dónde pedirlo" imageAlt="Menú del portal con 'Adelantos' resaltado en Gestión y el botón 'Solicitar adelanto'.">
              <p>En el menú del portal, entrá a <b>Adelantos</b>. Ahí solicitás y ves el estado de tus adelantos.</p>
            </ManualStep>

            <ManualStep image="/manual/adelantos-portal/02-form.png" n={2} title="Cargar la solicitud" imageAlt="Formulario 'Nueva solicitud' con el campo 'Monto solicitado' y el toggle '¿Es una emergencia?'.">
              <p>Tocá <b>Solicitar adelanto</b> y completá el <b>monto</b> que necesitás. Si es una <b>emergencia</b>, activá el toggle: se trata como extraordinaria y te va a pedir un motivo.</p>
            </ManualStep>

            <ManualStep image="/manual/adelantos-portal/02-form.png" n={3} title="Mirá los requisitos" imageAlt="Panel 'Requisitos' con las reglas: antigüedad, fecha límite, monto, sin adelanto vigente, máximo por año, etc.">
              <p>En el mismo panel, debajo de los campos, ves los <b>requisitos</b> (antigüedad, fecha, sin adelanto vigente, etc.) con un ✓ si los cumplís. Si te falta alguno, la solicitud igual avanza como <b>excepción</b> pero te pide un <b>motivo</b>.</p>
              <p>Dos cosas las revisa el equipo a mano: que el monto no supere el 50% de tu neto, y que no haya una renuncia comunicada.</p>
            </ManualStep>

            <ManualStep image="/manual/adelantos-portal/04-estado.png" n={4} title="Enviar y seguir el estado" imageAlt="Lista 'Mis adelantos' con las columnas Fecha, Monto, Mes de descuento, Tipo y Estado (los datos personales están difuminados).">
              <p>Al enviar, tu solicitud queda en <b>Pendiente RRHH</b>. En <b>Mis adelantos</b> seguís el avance: Pendiente RRHH → Pendiente Administración → <b>Aprobado</b> → <b>Transferido</b> → <b>Saldado</b>.</p>
              <p>No podés tener dos adelantos vigentes a la vez: vas a poder pedir otro una vez que el actual se salde (mientras tanto, el botón de solicitar queda deshabilitado).</p>
            </ManualStep>

            <ManualStep image="/manual/adelantos-portal/05-mail.png" n={5} title="Qué pasa después" imageAlt="Ejemplo del email de aprobación del adelanto, con el monto, el mes de descuento y el botón 'Ver mis adelantos'.">
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
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground">Consultas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cómo hacerle una consulta a People y seguir la respuesta.</p>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
            <p className="mt-2 text-sm text-foreground">
              Abrís una consulta desde el portal, la gestiona el equipo de <b>People</b> y te responde en el mismo hilo.
              El objetivo es darte una <b>primera respuesta dentro de 3 días hábiles</b>. Te avisamos por mail y en el
              portal cada vez que hay novedades.
            </p>
          </div>

          <div className="mt-8 space-y-10">
            <ManualStep image="/manual/consultas-portal/01-lista.png" n={1} title="Dónde hacerla" imageAlt="Menú del portal con 'Consultas' resaltado en Espacio de trabajo y el botón 'Nueva consulta'.">
              <p>En el menú del portal, entrá a <b>Consultas</b> y tocá <b>Nueva consulta</b>. Antes de escribir, fijate en la sección de <b>Ayuda</b>: quizás lo que buscás ya esté respondido.</p>
            </ManualStep>

            <ManualStep image="/manual/consultas-portal/02-form.png" n={2} title="Escribirla" imageAlt="Formulario con Categoría, Asunto y el cuadro de la consulta.">
              <p>Elegí la <b>categoría</b> (sueldo, licencias, beneficios, adelantos, capacitaciones, certificados u otros), poné un <b>asunto</b> corto y contanos el detalle. Cuanto más claro, más rápido te podemos responder.</p>
              <p>Después de crearla podés <b>adjuntar archivos</b> (PDF, JPG o PNG, hasta 4 MB) si ayudan a explicar el caso.</p>
            </ManualStep>

            <ManualStep image="/manual/consultas-portal/01-lista.png" n={3} title="Seguir el estado" imageAlt="Lista de consultas con los estados Nueva, En curso, Esperando tu respuesta, Resuelta y Cerrada.">
              <p>Cada consulta muestra en qué anda: <b>Nueva</b>, <b>En curso</b>, <b>Esperando tu respuesta</b> (te toca a vos), <b>Resuelta</b> o <b>Cerrada</b>. Mientras no te hayamos respondido, vas a ver la fecha en la que te vamos a contestar.</p>
            </ManualStep>

            <ManualStep image="/manual/consultas-portal/04-hilo.png" n={4} title="La conversación" imageAlt="Detalle de una consulta con el ida y vuelta entre el colaborador y People.">
              <p>Entrá a la consulta para leer el ida y vuelta completo y seguir respondiendo. Todo queda en el mismo hilo.</p>
              <p>Cuando el tema se resuelve, la consulta se cierra sola a los pocos días. Si necesitás retomarla, <b>tenés 7 días</b> para responder ahí mismo y se reabre; pasado ese plazo, abrí una consulta nueva.</p>
            </ManualStep>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground">Recibos de sueldo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cómo descargar tu recibo y confirmar que lo recibiste.</p>

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
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground">Mensajes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cómo ver, leer y confirmar los mensajes que te enviamos.</p>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
            <p className="mt-2 text-sm text-foreground">
              Recibís anuncios y avisos de People en <b>Mensajes</b> del portal (y un aviso por <b>mail</b> cuando corresponde).
              Los abrís, se marcan como <b>leídos</b>, y algunos te piden <b>confirmar la lectura</b>.
            </p>
          </div>

          <div className="mt-8 space-y-10">
            <ManualStep image="/manual/mensajes-portal/01-inbox.png" n={1} title="Dónde verlos" imageAlt="Sección 'Mensajes' del portal con la lista de anuncios recibidos.">
              <p>En el menú del portal entrá a <b>Mensajes</b> (o tocá la <b>campanita</b> de notificaciones arriba). Ahí está todo lo que te enviamos, con los no leídos destacados.</p>
            </ManualStep>

            <ManualStep image="/manual/mensajes-portal/02-detalle.png" n={2} title="Leer y confirmar" imageAlt="Un mensaje abierto con la etiqueta 'Requiere confirmación' y el botón 'Confirmar lectura'.">
              <p>Tocá un mensaje para leerlo: se marca como <b>leído</b> automáticamente. Si el mensaje <b>requiere confirmación</b>, vas a ver un botón para <b>confirmar</b> que lo leíste (queda registrado).</p>
            </ManualStep>

            <ManualStep image="/manual/mensajes-portal/03-mail.png" n={3} title="Avisos por mail" imageAlt="Ejemplo del mail de aviso de un mensaje nuevo con un botón 'Ver en el portal'.">
              <p>Algunos mensajes también te llegan por <b>mail</b>, con un botón <b>Ver en el portal</b> para entrar y leerlo completo. Si el mensaje está personalizado, el mail ya trae <b>tus datos</b>.</p>
            </ManualStep>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
