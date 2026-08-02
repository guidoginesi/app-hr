import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaConsultasPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Consultas"
      description="Cómo atender las consultas que hacen los colaboradores desde el portal."
    >
      <div className="mb-2">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El circuito, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          El colaborador abre una consulta desde el portal → entra a la <b>bandeja única de People</b> y les llega un
          aviso → ustedes responden en el hilo → el objetivo es dar la <b>primera respuesta en 3 días hábiles</b> →
          cuando se resuelve, se cierra sola a los 3 días hábiles si nadie la retoma.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep image="/manual/consultas-admin/01-bandeja.png" n={1} title="Dónde encontrarlo" imageAlt="Menú lateral con 'Consultas' en la sección Espacio de trabajo.">
          <p>En el menú lateral, <b>Espacio de trabajo → Consultas</b>. Todas las consultas caen en una <b>única bandeja</b>: no hay ruteo automático por categoría.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/01-bandeja.png" n={2} title="Leer la bandeja" imageAlt="Tarjetas de Abiertas, Nuevas, Vencidas y Total, con los filtros debajo.">
          <p>Arriba ves <b>Abiertas</b>, <b>Nuevas</b>, <b>Vencidas</b> y el total. <b>Vencidas</b> son las que todavía no tienen primera respuesta y pasaron los 3 días hábiles — son las que hay que mirar primero.</p>
          <p>Podés filtrar por estado, categoría y buscar por asunto. Por defecto se muestran solo las abiertas.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/03-detalle.png" n={3} title="Responder" imageAlt="Detalle de una consulta con el hilo y el cuadro de respuesta.">
          <p>Entrá a la consulta y escribí la respuesta. Al enviarla, la consulta pasa a <b>Esperando al colaborador</b>, se registra el cumplimiento del objetivo y queda <b>asignada a vos</b> automáticamente.</p>
          <p>Al colaborador le llega un aviso en el portal y por mail.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/03-detalle.png" n={4} title="Notas internas" imageAlt="Casilla 'Nota interna' debajo del cuadro de respuesta, y una nota destacada en el hilo.">
          <p>Si tildás <b>Nota interna</b>, lo que escribas queda en el hilo pero <b>el colaborador no lo ve</b> (se muestra con borde punteado). Sirve para coordinar entre ustedes sin sacar la conversación de la app.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/03-detalle.png" n={5} title="Compartir con el líder" imageAlt="Bloque 'Compartir con el líder' con el botón Compartir.">
          <p>Si necesitás la mirada del líder, tocá <b>Compartir</b>. Le da acceso <b>solo a esa consulta</b> — nunca a las del resto del equipo — y la ve en su portal, donde puede responder. <b>No ve las notas internas.</b></p>
          <p>Es reversible: <b>Dejar de compartir</b> le quita el acceso. Queda registrado quién compartió y cuándo.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/03-detalle.png" n={6} title="Estados y cierre" imageAlt="Selector de estado con las opciones En curso, Esperando al colaborador, Resuelta y Cerrada.">
          <p>Cuando terminás, marcá la consulta como <b>Resuelta</b>. Si el colaborador no dice nada, <b>se cierra sola a los 3 días hábiles</b>. Después del cierre tiene <b>7 días</b> para reabrirla respondiendo en el hilo; pasado ese plazo, abre una nueva.</p>
        </ManualStep>

        <ManualStep image="/manual/consultas-admin/07-reportes.png" n={7} title="Reportes" imageAlt="Pestaña Reportes con el volumen por categoría y el bloque de consultas recurrentes.">
          <p>En la pestaña <b>Reportes</b> ves el volumen por categoría, el <b>tiempo de primera respuesta</b> (mediana y p90) y el cumplimiento del objetivo.</p>
          <p>Lo más útil es <b>Consultas recurrentes</b>: reabiertas, continuaciones y quién pregunta lo mismo tres o más veces. Cuando algo se repite, casi siempre es un problema de comunicación o de proceso, no una duda individual.</p>
        </ManualStep>

        <ManualStep n={8} title="Qué pasa automáticamente" imageAlt="Ejemplo del mail diario con las consultas sin responder.">
          <p>Cada mañana llega un <b>resumen por mail</b> con las consultas sin responder, marcando las vencidas. Se repite todos los días hasta que la cola queda vacía.</p>
          <p>Y las consultas resueltas se cierran solas a los 3 días hábiles, para que la bandeja no se llene de casos terminados.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
