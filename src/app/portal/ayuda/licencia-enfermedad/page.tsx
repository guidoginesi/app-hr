import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { ManualStep } from '@/components/manual/ManualStep';
import { PortalAyudaLayout } from '../PortalAyudaLayout';
import { SICK_CERT_DEADLINE_BUSINESS_DAYS } from '@/lib/sickLeave';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      title="Licencia por enfermedad"
      description="Cómo avisar que estás de licencia por enfermedad y cargar el certificado."
    >
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          La cargás vos desde el portal y <b>queda registrada al instante</b>: no espera la aprobación de nadie. A tu
          líder le llega un aviso de que vas a estar ausente, <b>sin el motivo ni el certificado</b>. El certificado
          médico es obligatorio: lo adjuntás al cargarla si ya lo tenés, o lo subís después.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ManualStep
          n={1}
          title="Cargar la licencia"
          image="/manual/licencia-enfermedad-portal/01-form.png"
          imageAlt="Formulario de nueva solicitud con el tipo Licencia por enfermedad elegido."
        >
          <p>Entrá a <b>Time Off → Nueva solicitud</b> y elegí <b>Licencia por enfermedad</b> en el tipo. Vas a ver que figura como <b>Ilimitada</b>: no descuenta días de ningún saldo, así que no te “gastás” vacaciones ni Días Pow.</p>
          <p>Completá la <b>fecha de inicio</b> y la <b>fecha de fin</b>. Podés poner <b>fechas que ya pasaron</b> —lo normal es avisar cuando ya estás enfermo, o al volver—, no hace falta anticipación. Los días se cuentan <b>hábiles</b>: un cuadro te muestra cuántos quedaron.</p>
          <p>Las <b>notas son opcionales</b>. No hace falta que cuentes qué tenés: el detalle médico va en el certificado, que sólo ve People.</p>
        </ManualStep>

        <ManualStep
          n={2}
          title="Qué pasa cuando la enviás"
          image="/manual/licencia-enfermedad-portal/02-registrada.png"
          imageAlt="Licencia por enfermedad en el historial con el estado Registrada."
        >
          <p>Queda en estado <b>Registrada</b>. No hay aprobación del líder ni de People: por eso, a diferencia de las vacaciones, no vas a ver los tildes de <i>Líder</i> y <i>HR</i> — no hay nada esperando.</p>
          <p>A tu <b>líder</b> le llega un mail y un aviso en la campanita contándole que estás de licencia y por cuántos días, <b>para que pueda organizar la cobertura</b>. No ve el motivo ni el certificado.</p>
          <p>A vos te llega la confirmación con el recordatorio de subir el certificado.</p>
        </ManualStep>

        <ManualStep
          n={3}
          title="Subir el certificado médico"
          image="/manual/licencia-enfermedad-portal/02-registrada.png"
          imageAlt="Fila de la licencia con el chip 'Certificado pendiente' y el botón 'Subir certificado'."
        >
          <p>El certificado es <b>obligatorio</b>, y hay dos momentos para cargarlo:</p>
          <p><b>Al cargar la licencia</b>, si ya lo tenés a mano —por ejemplo si hiciste teleconsulta y te lo mandaron en el momento—: el formulario tiene el campo <b>Certificado médico</b> y lo adjuntás ahí mismo.</p>
          <p><b>Después</b>, si el papel todavía no llegó. Enviá la licencia igual: lo importante es que quede registrada el día que faltás, para que tu líder pueda cubrir. En <b>Time Off</b> —o en <b>Historial de solicitudes</b>— vas a ver el chip <b>Certificado pendiente</b> y el botón <b>Subir certificado</b>.</p>
          <p>Aceptamos <b>PDF, JPG, PNG o WEBP</b>, hasta <b>10 MB</b>: una foto legible alcanza.</p>
          <p>Tenés <b>{SICK_CERT_DEADLINE_BUSINESS_DAYS} días hábiles</b> desde el inicio de la licencia. Si se pasa el plazo, el chip queda en <b>Certificado vencido</b> y te llega un <b>recordatorio automático</b>. No se anula la licencia: sólo queda marcada hasta que lo subas.</p>
          <p>Si te equivocaste de archivo, el botón pasa a decir <b>Reemplazar</b> y podés subir otro.</p>
        </ManualStep>

        <ManualStep
          n={4}
          title="Quién ve qué"
          imageAlt="Chip 'Certificado presentado' en la fila de la licencia."
        >
          <p>Una vez cargado, el chip pasa a <b>Certificado presentado</b> y podés volver a verlo cuando quieras con el botón <b>Ver</b>.</p>
          <p>El certificado es <b>información de salud</b>, así que el acceso está limitado: lo ven <b>vos</b> y el <b>equipo de People</b>. <b>Tu líder no puede abrirlo</b> — a él sólo le llega el aviso de la ausencia.</p>
        </ManualStep>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Las capturas de esta guía se agregan en breve. Si algo no coincide con lo que ves en pantalla, escribinos por
        Consultas.
      </p>
    </PortalAyudaLayout>
  );
}
