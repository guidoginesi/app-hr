import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { ManualStep } from '@/components/manual/ManualStep';
import { PortalAyudaLayout } from '../PortalAyudaLayout';
import { leaveCertRule } from '@/lib/leaveCertificates';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  const plazo = leaveCertRule('study')?.businessDays ?? 3;

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      title="Licencia por estudio"
      description="Cómo pedir días para rendir y cómo acreditar el examen."
    >
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Pedís los días desde el portal, los aprueba <b>tu líder</b> y después <b>People</b>. Cuando rendís, subís el{' '}
          <b>certificado del examen</b>: es lo que acredita que usaste los días para eso.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ManualStep
          n={1}
          title="Antes de empezar: que HR te habilite"
          imageAlt="Mensaje del formulario cuando la licencia por estudio no está habilitada."
        >
          <p>La licencia por estudio la tenés disponible sólo si <b>People te marcó como estudiante</b> en tu legajo. Si no, el formulario te lo dice al enviar y no te deja avanzar.</p>
          <p>Si estás cursando y no la ves, escribinos por <b>Consultas</b> y la habilitamos.</p>
        </ManualStep>

        <ManualStep
          n={2}
          title="Cuántos días tenés"
          imageAlt="Selector de tipo de licencia mostrando el saldo disponible de días de estudio."
        >
          <p>Son <b>10 días hábiles por año calendario</b>, y se usan de a <b>2 días hábiles por examen</b>.</p>
          <p>Se cuentan <b>hábiles</b>: los fines de semana no te consumen cupo. Si pedís de viernes a lunes, te descuentan 2 días, no 4.</p>
          <p>El saldo lo ves en el mismo selector al elegir el tipo, y no se acumula de un año al otro.</p>
        </ManualStep>

        <ManualStep
          n={3}
          title="Pedir los días"
          imageAlt="Formulario de nueva solicitud con Licencia por Estudio elegida y el campo del certificado."
        >
          <p>Entrá a <b>Time Off → Nueva solicitud</b>, elegí <b>Licencia por Estudio</b> y poné las fechas. Pedila con al menos <b>7 días de anticipación</b>: el formulario no te deja enviarla con menos.</p>
          <p>Si ya tenés el certificado del examen, podés <b>adjuntarlo ahí mismo</b>. Lo normal es que todavía no lo tengas —el certificado lo dan cuando rendís—, así que enviá igual y lo subís después.</p>
        </ManualStep>

        <ManualStep
          n={4}
          title="Las aprobaciones"
          imageAlt="Solicitud de estudio en el historial mostrando los tildes de Líder y HR."
        >
          <p>A diferencia de la licencia por enfermedad, ésta <b>sí se aprueba</b>: primero tu <b>líder</b>, después <b>People</b>. En el historial vas a ver los dos tildes, y te avisamos en cada paso por mail y en la campanita.</p>
          <p>Mientras está pendiente, los días quedan <b>reservados</b> de tu saldo. Si te la rechazan, vuelven.</p>
        </ManualStep>

        <ManualStep
          n={5}
          title="Subir el certificado del examen"
          imageAlt="Fila de la licencia con el chip 'Certificado pendiente' y el botón para subirlo."
        >
          <p>El certificado es <b>obligatorio</b>: es lo que acredita que rendiste. Lo subís desde <b>Time Off</b> —o desde <b>Historial de solicitudes</b>— con el botón <b>Subir certificado</b>. Aceptamos <b>PDF, JPG, PNG o WEBP</b>, hasta <b>10 MB</b>.</p>
          <p>Tenés <b>{plazo} días hábiles desde que termina la licencia</b>. Ojo con esta diferencia: el plazo corre desde el <b>fin</b>, no desde el inicio, justamente porque el certificado te lo dan cuando rendís.</p>
          <p>Si se pasa el plazo, el chip queda en <b>Certificado vencido</b> y te llega un <b>recordatorio automático</b>. No se anula la licencia: queda marcada hasta que lo subas.</p>
        </ManualStep>

        <ManualStep
          n={6}
          title="Dónde NO va el certificado"
          imageAlt="Panel de Certificados del portal, que ya no ofrece el tipo Certificado de exámen."
        >
          <p>En <b>Certificados</b> ya no vas a encontrar la opción <i>Certificado de exámen</i>. El certificado va <b>adjunto a la licencia</b>, no suelto: así queda asociado a los días que pediste y no hay que cruzarlo a mano.</p>
          <p>Los que hayas subido antes por ahí <b>siguen estando</b>, no se perdió nada.</p>
        </ManualStep>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Las capturas de esta guía se agregan en breve. Si algo no coincide con lo que ves en pantalla, escribinos por
        Consultas.
      </p>
    </PortalAyudaLayout>
  );
}
