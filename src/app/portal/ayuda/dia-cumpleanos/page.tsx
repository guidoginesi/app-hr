import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { ManualStep } from '@/components/manual/ManualStep';
import { PortalAyudaLayout } from '../PortalAyudaLayout';
import { BIRTHDAY_WINDOW_DAYS } from '@/lib/birthdayLeave';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalAyudaLayout
      employee={auth.employee}
      isLeader={auth.isLeader}
      title="Día de cumpleaños"
      description="Tenés un día libre por tu cumpleaños. Cómo se acredita y cómo tomarlo."
    >
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En resumen</p>
        <p className="mt-2 text-sm text-foreground">
          Es <b>un día libre por año</b>, que se te acredita solo en el mes de tu cumpleaños. Lo tomás{' '}
          <b>desde el día de tu cumple y hasta {BIRTHDAY_WINDOW_DAYS} días después</b>. No hace falta que lo pidas a
          People: te avisamos cuando esté disponible.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ManualStep
          n={1}
          title="Se acredita solo"
          imageAlt="Aviso en el portal informando que el día de cumpleaños está disponible."
        >
          <p>Cuando llega el mes de tu cumpleaños, la app te acredita el día <b>automáticamente</b>. No hay que pedírselo a nadie ni acordarse.</p>
          <p>Te avisamos por <b>mail</b> y en la <b>campanita</b>, con las fechas exactas entre las que podés tomarlo.</p>
          <p>Aparece en tu saldo como <b>Día de cumpleaños</b>, separado de los Días Pow y de las vacaciones: es un día extra, no sale de ningún otro cupo.</p>
        </ManualStep>

        <ManualStep
          n={2}
          title="Cuándo podés tomarlo"
          imageAlt="Formulario de nueva solicitud con el tipo Día de cumpleaños elegido y su nota de ventana."
        >
          <p>La ventana va <b>desde el día de tu cumpleaños hasta {BIRTHDAY_WINDOW_DAYS} días corridos después</b>. No antes: es el día de tu cumple, no un día suelto para cualquier momento del año.</p>
          <p>Si tu cumpleaños cae un <b>fin de semana</b>, o justo estás de <b>licencia o vacaciones</b>, la ventana no se te consume: arranca el <b>próximo día hábil</b> en el que estés trabajando, y desde ahí corren los {BIRTHDAY_WINDOW_DAYS} días.</p>
          <p>Es <b>un solo día</b>. No se puede partir ni estirar a dos.</p>
        </ManualStep>

        <ManualStep
          n={3}
          title="Cómo pedirlo"
          imageAlt="Selector de tipo de licencia con la opción Día de cumpleaños."
        >
          <p>Entrá a <b>Time Off → Nueva solicitud</b> y elegí el tipo <b>Día de cumpleaños</b>. Ponés la fecha y listo: no hace falta que aclares nada en Observaciones, ya viene identificado.</p>
          <p>Si elegís una fecha fuera de tu ventana, el formulario te lo avisa y te dice entre qué fechas podés tomarlo.</p>
        </ManualStep>

        <ManualStep
          n={4}
          title="Lo aprueba tu líder y People"
          imageAlt="Solicitud de día de cumpleaños en el historial, con los tildes de Líder y HR."
        >
          <p>Sigue el mismo circuito que el resto de las licencias: primero lo aprueba tu <b>líder</b> y después <b>People</b>. Así tu equipo sabe que ese día no vas a estar.</p>
          <p>Te avisamos en cada paso por mail y en la campanita.</p>
        </ManualStep>

        <ManualStep
          n={5}
          title="Si no lo usás, se pierde"
          imageAlt="Saldo del día de cumpleaños ya vencido."
        >
          <p>Pasada la ventana, el día <b>vence</b>: no se acumula ni pasa al año siguiente. Si sabés que esa semana la tenés complicada, conviene coordinarlo con tu líder apenas te llega el aviso.</p>
          <p>Si te lo aprobaron y después te lo cancelan por una razón de la operación, escribinos por <b>Consultas</b> y lo vemos.</p>
        </ManualStep>

        <ManualStep
          n={6}
          title="Casos particulares"
          imageAlt="Saldo de día de cumpleaños en el portal."
        >
          <p>El beneficio es para <b>todo el equipo</b>, sin importar la modalidad de contratación.</p>
          <p>Si <b>entraste a Pow después</b> de tu cumpleaños de este año, el beneficio te arranca en tu <b>primer cumpleaños dentro de Pow</b>.</p>
          <p>Si cumplís el <b>29 de febrero</b>, en los años que no son bisiestos lo tomamos como el 28.</p>
        </ManualStep>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Las capturas de esta guía se agregan en breve. Si algo no coincide con lo que ves en pantalla, escribinos por
        Consultas.
      </p>
    </PortalAyudaLayout>
  );
}
