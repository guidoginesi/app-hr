import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaAgenteDeRespuestasPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Agente de respuestas"
      description="El Manual RRHH adentro de la app: qué se le puede citar a un colaborador, cómo el agente propone una respuesta y cómo se captura lo que el manual no dice."
    >
      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El circuito, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          Sincronizás el Google Doc con la app → revisás <b>qué secciones se le pueden citar a un colaborador</b> → en
          cada consulta pedís una propuesta de respuesta → la usás, la editás o la descartás → lo que el manual no cubría
          queda anotado como <b>agujero</b> → lo tapás con una <b>FAQ</b> → y esa FAQ termina subiendo al Doc.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-warning-subtle p-5">
        <p className="text-sm text-[var(--amber-600)]">
          <b>El agente nunca le escribe a nadie.</b> Todo lo de esta pantalla es interno: propone un borrador, lo revisás
          vos y lo enviás vos. El colaborador no ve el agente, no ve las citas y no sabe que hubo una propuesta.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde encontrarlo" imageAlt="Configuración con las tarjetas 'Manual de RRHH' y 'Agujeros del manual'.">
          <p>Son tres lugares:</p>
          <p>
            · <b>Configuración → Manual de RRHH</b>: el manual importado y la revisión de audiencias.<br />
            · <b>Configuración → Agujeros del manual</b>: lo que el manual no cubre, y las FAQ que salen de taparlo.<br />
            · <b>Adentro de cada consulta</b>, arriba del cuadro de respuesta: el bloque <b>Propuesta desde el manual</b>.
          </p>
        </ManualStep>

        <ManualStep n={2} title="Traer el manual desde el Google Doc" imageAlt="Menú 'Pow RRHH → Sincronizar con app-hr' dentro del Google Doc.">
          <p>
            El manual sigue viviendo en el Doc: ahí se escribe y ahí se discute. La app guarda una <b>copia</b> para
            poder citarla.
          </p>
          <p>
            <b>La app no puede ir a buscarlo sola</b>, el Doc es privado. Lo empuja un complemento pegado al documento:
            menú <b>Pow RRHH → Sincronizar con app-hr</b>. Hay que correrlo cada vez que el manual cambia.
          </p>
          <p>
            Al terminar, en la pantalla de Configuración queda la fecha de la última sincronización y qué pasó:
            cuántas secciones llegaron <b>nuevas</b>, cuántas <b>modificadas</b> y cuántas <b>jubiladas</b>. Una sección
            que desaparece del Doc se jubila: deja de citarse, pero no se borra, así una consulta vieja se puede seguir
            explicando.
          </p>
        </ManualStep>

        <ManualStep n={3} title="Decidir qué se le puede citar a un colaborador" imageAlt="Lista de secciones agrupadas por capítulo, con los botones Colaborador / Solo HR / Sin revisar.">
          <p>Cada sección tiene una de tres etiquetas:</p>
          <p>
            · <b>Colaborador</b> — el agente la puede usar para escribir una respuesta.<br />
            · <b>Solo HR</b> — la ven ustedes, el agente no la toca.<br />
            · <b>Sin revisar</b> — todavía nadie decidió, y por lo tanto <b>tampoco se cita</b>.
          </p>
          <p>
            Ese último punto es el que sostiene todo lo demás: lo que nadie revisó no sale. Si mañana alguien pega un
            capítulo nuevo en el Doc, entra como <b>Sin revisar</b> y el agente no lo usa hasta que alguien lo mire. El
            costo de olvidarse es que el agente sepa de menos, nunca que cuente de más.
          </p>
          <p>
            La app <b>propone</b> una audiencia para cada sección y explica por qué, pero no la aplica sola. La forma
            rápida de revisar es por capítulo: <b>Aceptar la propuesta</b> resuelve el capítulo entero y después
            corregís las excepciones sueltas — que son pocas y casi siempre las mismas (una baja voluntaria le
            corresponde al colaborador; un despido, no).
          </p>
          <p>
            <b>Todo solo HR</b> es la salida de emergencia para un capítulo que preferís mirar con calma.
          </p>
        </ManualStep>

        <ManualStep n={4} title="Cuando el Doc cambia después de revisado" imageAlt="Sección con el distintivo 'Cambió tras revisarse'.">
          <p>
            Si una sección ya revisada cambia en el Doc, aparece marcada como <b>Cambió tras revisarse</b>, y arriba se
            cuentan todas juntas.
          </p>
          <p>
            <b>Sigue citándose con la audiencia que le habías puesto.</b> La marca es un pedido de tu ojo, no un
            bloqueo: revertir la audiencia sola dejaría al agente mudo cada vez que alguien corrige una coma. Vale la
            pena mirarlas cuando el cambio fue grande — si un capítulo de <i>Colaborador</i> ahora incluye algo que no
            debería salir de HR, esa marca es el único aviso.
          </p>
          <p>Tocar la etiqueta (aunque la dejes igual) limpia la marca.</p>
        </ManualStep>

        <ManualStep n={5} title="Pedir una propuesta en una consulta" imageAlt="Bloque 'Propuesta desde el manual' con el botón 'Proponer una respuesta'.">
          <p>
            En cualquier consulta abierta, tocá <b>Proponer una respuesta</b>. Tarda unos segundos porque lee el manual
            entero, no un resumen.
          </p>
          <p>Lo que el agente ve:</p>
          <p>
            · Las secciones marcadas <b>Colaborador</b>, completas.<br />
            · Las <b>FAQ aprobadas</b>, con la misma autoridad que el manual.<br />
            · De la persona que consulta: <b>fecha de ingreso y antigüedad, sus últimas licencias y sus saldos del año</b>.
          </p>
          <p>
            Lo que <b>no</b> ve: nada de compensación. Ni sueldo, ni adelantos, ni montos. Es el dato más sensible del
            sistema y no tiene por qué entrar acá para responder una consulta de licencias.
          </p>
          <p>
            Podés pedirla de nuevo después de calificarla — por ejemplo, si sincronizaste el manual o aprobaste una FAQ
            en el medio.
          </p>
        </ManualStep>

        <ManualStep n={6} title="Leer la propuesta" imageAlt="Propuesta con el borrador, el bloque 'Antes de mandarlo' y la lista 'Salió de'.">
          <p>Vienen tres cosas separadas a propósito:</p>
          <p>
            · <b>El borrador</b> — el mensaje tal como lo leería el colaborador. No dice &quot;según el manual&quot; ni explica de
            dónde salió: eso suena a formulario y al colaborador no le sirve. Si falta un dato de la persona, deja un{' '}
            <b>hueco entre corchetes</b> para que lo completes.<br />
            · <b>Antes de mandarlo</b> — la nota para vos: qué parte respalda el manual, qué parte hay que decidir o
            chequear, qué dato falta. Va con otro fondo para que no se confunda con el mensaje.<br />
            · <b>Salió de</b> — las secciones que usó, para poder verificarlo sin leer el manual entero.
          </p>
          <p>Y dos avisos que conviene leer antes que el borrador:</p>
          <p>
            · <b>&quot;El manual no cubre esta consulta&quot;</b> — prefiere decirlo antes que inventar. Esa consulta va a
            aparecer después en Agujeros del manual.<br />
            · <b>&quot;Pide un dato de la persona&quot;</b> — el agente conoce la política, no el caso puntual. El dato lo
            mirás y lo completás vos.
          </p>
        </ManualStep>

        <ManualStep n={7} title="Usarla, editarla o descartarla" imageAlt="Botones 'Usar este borrador' y 'Descartar' debajo de la propuesta.">
          <p>
            <b>Usar este borrador</b> lo copia al cuadro de respuesta. Ahí lo editás como cualquier respuesta tuya y lo
            enviás vos. <b>Nunca se manda solo</b>, ni siquiera si está perfecto.
          </p>
          <p>
            <b>Descartar</b> lo saca de en medio cuando no sirve. No es un botón perdido: descartar también es
            información sobre el agente.
          </p>
        </ManualStep>

        <ManualStep n={8} title="Cómo aprende" imageAlt="Propuesta ya calificada, con la leyenda 'Se usó editada' y la fecha.">
          <p>
            No hay que calificar nada a mano. Cuando enviás la respuesta, la app compara <b>lo que mandaste</b> contra{' '}
            <b>lo que se había propuesto</b> y la marca sola:
          </p>
          <p>
            · <b>Se usó tal cual</b> — el borrador estaba bien.<br />
            · <b>Se usó editada</b> — le faltaba algo, y lo que le faltaba está en la diferencia entre los dos textos.<br />
            · <b>Se descartó</b> — no servía.
          </p>
          <p>
            Es a propósito que no haya estrellitas: una calificación que hay que acordarse de poner se deja de poner a
            la semana. Esta sale de trabajar normal.
          </p>
          <p>
            Lo importante es lo que se hace con eso: <b>toda consulta donde el manual no alcanzó o donde editaste el
            borrador cae en Agujeros del manual</b>. Ahí es donde el agente mejora — no aprende solo, aprende cuando
            ustedes escriben lo que faltaba.
          </p>
        </ManualStep>

        <ManualStep n={9} title="Agujeros del manual" imageAlt="Lista de agujeros con el motivo, la respuesta que dio People y el botón 'Proponer FAQ'.">
          <p>
            En <b>Configuración → Agujeros del manual</b> se juntan esas consultas, cada una con el motivo (<i>el manual
            no cubría la consulta</i> o <i>HR editó el borrador</i>) y con la respuesta que ustedes terminaron dando.
          </p>
          <p>
            Esa respuesta es conocimiento de la empresa que no está escrito en ningún lado, y se pierde cuando la persona
            que la sabía se va o simplemente se olvida.
          </p>
          <p>
            <b>Proponer FAQ</b> redacta una pregunta y una respuesta a partir de ese intercambio. Si de ahí no sale nada
            general —era un caso único—, lo dice y no crea nada.
          </p>
          <p>
            La FAQ nace <b>Sin aprobar</b> y no se cita hasta que alguien la lea, la corrija y toque <b>Aprobar</b>. Una
            FAQ mal cargada no le contesta mal a una persona: le contesta mal a todas las que pregunten lo mismo.
          </p>
        </ManualStep>

        <ManualStep n={10} title="El destino de una FAQ es dejar de ser FAQ" imageAlt="Aviso 'Faltan en el Doc' con el botón 'Ya la subí al Doc'.">
          <p>
            Una FAQ aprobada queda marcada como <b>Falta en el Doc</b> hasta que la subas al manual de verdad. La app
            avisa cuántas hay pendientes.
          </p>
          <p>
            Vale la pena hacerlo: mientras vive sólo acá, esa respuesta la sabe el agente. En el Doc la sabe cualquiera
            que lo lea. Cuando la subiste, tocá <b>Ya la subí al Doc</b>, sincronizá, y revisá la audiencia de la sección
            nueva (entra como <b>Sin revisar</b>, como todas).
          </p>
          <p>
            <b>Archivar</b> es para las que dejaron de valer. No se borran: una respuesta que dimos el año pasado explica
            por qué contestamos lo que contestamos.
          </p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
