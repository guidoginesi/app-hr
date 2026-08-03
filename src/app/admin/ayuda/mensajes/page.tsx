import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaMensajesPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Mensajes"
      description="Cómo redactar, segmentar y enviar comunicaciones — y seguir lectura y entrega."
    >
      <div className="mb-2">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El flujo, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          Redactás un anuncio → elegís la <b>audiencia</b> (todos, un área, el equipo de un líder, o personas
          específicas) → opcionalmente usás una <b>plantilla con variables</b> y lo mandás también por <b>mail</b> o al
          <b> chat de Pow</b> → <b>publicás</b>. Después seguís <b>lectura</b>, <b>confirmación</b> y <b>estado de entrega</b>
          del mail en el detalle. El listado se puede <b>buscar</b>, <b>filtrar</b> y <b>exportar a CSV</b>.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep image="/manual/mensajes-admin/01-lista.png" n={1} title="Dónde encontrarlo" imageAlt="Menú lateral con 'Mensajes' resaltado en 'Espacio de trabajo', y el listado de mensajes.">
          <p>En el menú lateral, dentro de <b>Espacio de trabajo → Mensajes</b>. Ahí ves todos los anuncios enviados, con su estado, audiencia y métricas de lectura.</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/02-compose.png" n={2} title="Redactar un mensaje" imageAlt="Panel 'Nuevo mensaje' con los campos Título y Cuerpo (editor de texto).">
          <p>Tocá <b>Nuevo mensaje</b>. Completá el <b>título</b> y el <b>cuerpo</b> con el editor (negrita, listas, links, etc.).</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/02-compose.png" n={3} title="Elegir la audiencia" imageAlt="Selector de Audiencia con las opciones: todos, líderes, empleados, monotributo, dependencia, por área, por líder, personas específicas.">
          <p>En <b>Audiencia</b> elegís a quién le llega:</p>
          <ul>
            <li><b>Todos</b> los empleados, <b>solo líderes</b>, <b>solo empleados</b>, o por tipo (<b>monotributo</b> / <b>relación de dependencia</b>).</li>
            <li><b>Por área</b> (todos los de un departamento), <b>por líder</b> (el equipo directo de un manager) o <b>personas específicas</b> (buscás y seleccionás una por una).</li>
          </ul>
          <p>El envío a audiencias amplias (todos / roles / tipo) requiere el permiso de <b>envío masivo</b>.</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/02-compose.png" n={4} title="Plantillas y variables" imageAlt="Bloque 'Plantilla' con selector y 'Guardar como plantilla', y botones para insertar variables {{nombre}} {{apellido}} {{dni}} {{cuil}} {{periodo}}.">
          <p>Podés elegir una <b>plantilla</b> guardada (rellena título y cuerpo) o <b>guardar</b> el mensaje actual como plantilla para reusarlo.</p>
          <p>Con <b>Insertar variable</b> agregás <code>{'{{nombre}}'}</code>, <code>{'{{apellido}}'}</code>, <code>{'{{dni}}'}</code>, <code>{'{{cuil}}'}</code> o <code>{'{{periodo}}'}</code>. Se <b>personalizan por destinatario</b> al enviar (cada persona recibe su dato). Si usás variables, aparece el campo <b>Período</b> para completar ese contexto.</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/02-compose.png" n={5} title="Canales, opciones y publicar" imageAlt="Prioridad, 'Requiere confirmación de lectura', 'Enviar también al chat de Pow', 'Enviar también por mail', y botones Guardar borrador / Publicar ahora.">
          <p>Antes de enviar podés setear la <b>prioridad</b>, pedir <b>confirmación de lectura</b>, y elegir canales extra: <b>chat grupal de Pow</b> (Google Chat) y/o <b>mail a los destinatarios</b>.</p>
          <p><b>Publicar ahora</b> lo envía y crea los destinatarios; <b>Guardar borrador</b> lo deja para después (lo publicás desde la lista cuando quieras).</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/02-compose.png" n={6} title="Programar el envío" imageAlt="Campo 'Programar el envío (opcional)' con un selector de fecha, arriba de 'Expira el'.">
          <p>En <b>Programar el envío</b> elegís una <b>fecha</b> y el mensaje se publica solo esa mañana, sin que tengas que entrar. Queda como borrador hasta entonces, así que lo podés seguir editando.</p>
          <p>La programación es <b>por día, no por hora</b>: sale en el mismo envío de la mañana en que ya salen los cumpleaños, el resumen de aprobaciones y los recordatorios de recibos.</p>
          <p>En la lista se ve como <b>Programado</b> con la fecha. Desde ahí podés <b>Publicar ahora</b> sin esperar, o <b>Cancelar envío</b> para que vuelva a ser un borrador común.</p>
          <p>Si llegada la fecha el envío no se puede hacer —por ejemplo si perdiste el permiso de envío masivo—, el mensaje no sale, queda como borrador y te llega un aviso con el motivo.</p>
          <p>Y si cambia algo del contenido, <b>Editar</b> te abre el borrador con todo cargado: texto, audiencia, canales y la fecha. No hace falta cancelar y volver a escribirlo.</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/01-lista.png" n={7} title="Buscar, filtrar y exportar" imageAlt="Barra con buscador, filtro de origen (Todos/Manuales/Automáticos), prioridad, estado, rango de fechas, estado de lectura, 'Recibido por' y botón Exportar CSV.">
          <p>Sobre el listado podés <b>buscar por palabra clave</b> y <b>filtrar</b> por <b>origen</b> (manual vs. automático del sistema), prioridad, estado, <b>rango de fechas</b>, <b>estado de lectura</b> y <b>destinatario</b> (recibido por…).</p>
          <p>Con <b>Exportar CSV</b> bajás el resultado filtrado: un <b>resumen por mensaje</b> o el <b>detalle por destinatario</b> (para auditar quién leyó/confirmó).</p>
        </ManualStep>

        <ManualStep image="/manual/mensajes-admin/03-detalle.png" n={8} title="Seguir lectura y entrega" imageAlt="Detalle del mensaje: métricas de enviados/leídos/confirmados y tabla de destinatarios con estado de mail (Entregado), leído y confirmado.">
          <p>Entrá a <b>Ver detalle</b> de un mensaje para ver las métricas (<b>enviados / leídos / confirmados</b>) y la tabla de destinatarios. Ahí ves, por persona, el <b>estado del mail</b> (<b>enviado / entregado / rebotado / spam</b>), si lo <b>leyó</b> y si <b>confirmó</b> (cuando el mensaje lo pide).</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
