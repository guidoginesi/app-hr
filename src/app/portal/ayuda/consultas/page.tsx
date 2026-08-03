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
      title="Consultas"
      description="Cómo hacerle una consulta a People y seguir la respuesta."
    >

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
    </PortalAyudaLayout>
  );
}
