import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';
import { leaveCertRule } from '@/lib/leaveCertificates';

export const dynamic = 'force-dynamic';

export default async function AyudaLicenciaEnfermedadPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Licencia por enfermedad"
      description="El circuito sin aprobación, el certificado médico y el KPI de ausentismo"
    >
      <div className="space-y-8">

        <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El circuito, en una línea</p>
          <p className="mt-2 text-sm text-foreground">
            El colaborador <b>registra</b> la licencia y queda vigente en el acto —<b>no la aprueba nadie</b>— → al{' '}
            <b>líder</b> se le avisa para que cubra la operación, sin motivo ni certificado → el colaborador sube el{' '}
            <b>certificado médico</b> dentro de {leaveCertRule('sick')?.businessDays} días hábiles → el <b>KPI</b> se
            alimenta solo de ese registro.
          </p>
        </div>

        <ManualStep
          n={1}
          title="Por qué no hay aprobación"
          image="/manual/licencia-enfermedad-admin/01-solicitudes.png"
          imageAlt="Licencia por enfermedad en el listado de solicitudes, en estado Registrada."
        >
          <p>A diferencia del resto de las licencias, la de enfermedad <b>no pasa por el circuito líder → HR</b>. El colaborador la reporta y queda vigente. Es un tercer circuito, distinto del de dos niveles y del de “directo a HR”.</p>
          <p>En el listado la vas a ver como <b>Registrada</b>. Aparece bajo “Aprobadas” porque técnicamente está vigente, pero no la aprobó nadie: por eso la etiqueta dice Registrada y no Aprobada.</p>
          <p>Tampoco <b>consume saldo</b>: es ilimitada y no toca los balances de vacaciones ni Días Pow.</p>
        </ManualStep>

        <ManualStep
          n={2}
          title="Qué ve el líder"
          imageAlt="Mail de aviso al líder informando la ausencia por enfermedad."
        >
          <p>Al líder le llega un <b>mail</b> y un aviso en la campanita con la persona, el período y la cantidad de días. Es una <b>notificación de cobertura</b>, no un pedido de aprobación, y el mail se lo aclara.</p>
          <p><b>No incluye el motivo ni el certificado</b>, y el líder no tiene forma de abrir el archivo: es información de salud. Sólo accedemos vos —People— y la propia persona.</p>
          <p>Si la persona <b>no tiene líder cargado</b>, la licencia se registra igual y simplemente no se notifica a nadie. No queda trabada, porque no hay nada que aprobar.</p>
        </ManualStep>

        <ManualStep
          n={3}
          title="El certificado médico"
          image="/manual/licencia-enfermedad-admin/03-certificado.png"
          imageAlt="Fila de la licencia en el admin con el chip del estado del certificado y el botón Ver."
        >
          <p>El certificado es <b>obligatorio</b>, y la persona puede adjuntarlo <b>al cargar la licencia</b> —si ya lo tiene, por ejemplo de una teleconsulta— o <b>después</b>. No se exige en el momento del alta a propósito: si lo exigiéramos, nadie podría registrar la ausencia el día que falta, y el aviso de cobertura al líder llegaría tarde. El plazo es de <b>{leaveCertRule('sick')?.businessDays} días hábiles</b> desde el inicio.</p>
          <p>En <b>Time Off → Solicitudes</b>, cada licencia por enfermedad muestra el estado del certificado:</p>
          <p><b>Certificado pendiente</b> (todavía dentro del plazo) · <b>Certificado vencido</b> (se pasó el plazo y no lo subió) · <b>Certificado presentado</b> (ya está, con el botón <b>Ver</b> para abrirlo).</p>
          <p>El estado se <b>calcula solo</b> a partir del archivo y la fecha de inicio; no hay que marcar nada a mano. Un <b>vencido no anula</b> la licencia: la marca para que la reclames. El criterio es acompañar, no sancionar.</p>
          <p>El reclamo tampoco depende de que alguien lo note: al vencer el plazo, el <b>cron diario</b> le manda un <b>recordatorio automático</b> a la persona, por mail y por la campanita. Sale <b>una sola vez</b> por licencia.</p>
          <p>El archivo se abre con un enlace que <b>caduca a los 2 minutos</b>, y quien lo sube es siempre la propia persona: vos lo consultás, no lo cargás.</p>
        </ManualStep>

        <ManualStep
          n={4}
          title="El KPI de ausentismo"
          image="/manual/licencia-enfermedad-admin/04-kpi.png"
          imageAlt="Pestaña Ausentismo con los cinco indicadores, estacionalidad, por área y ranking."
        >
          <p>Está en <b>Time Off → Ausentismo</b> y se alimenta solo de las licencias registradas. Es una pestaña <b>sólo para People</b>.</p>
          <p>Arriba, cinco indicadores: <b>tasa de ausentismo</b>, <b>días</b>, <b>eventos</b>, <b>duración media</b> y <b>% de personas con al menos un evento</b>. Frecuencia y duración van <b>separadas</b> a propósito: muchos eventos cortos y un evento largo son problemas distintos y se atacan distinto.</p>
          <p>Abajo, <b>estacionalidad</b> por mes, <b>distribución por área</b> y el ranking <b>“Quiénes acumulan más”</b>, ordenado por días y con la antigüedad y la modalidad de cada persona.</p>
          <p>Podés filtrar por <b>año, área y modalidad</b>.</p>
        </ManualStep>

        <ManualStep
          n={5}
          title="Cómo leer la tasa"
          imageAlt="Nota al pie del KPI con la fórmula de la tasa y las salvedades."
        >
          <p>La <b>tasa</b> es días de enfermedad sobre los días laborables disponibles: <i>días / (días hábiles del período × dotación activa)</i>. En el <b>año en curso el período corta hoy</b>, no a fin de año — si contáramos días que todavía no ocurrieron, la tasa saldría artificialmente baja.</p>
          <p>Dos salvedades que conviene tener presentes al reportar, y que la pantalla aclara al pie:</p>
          <p>Todavía <b>no hay calendario de feriados</b>, así que un feriado cuenta como día hábil. Y <b>no hay histórico</b>: la serie arranca cuando se habilitó el módulo, no antes.</p>
          <p>El <b>dato individual</b> —el ranking— es para gestión de People. Al <b>directorio</b> se reporta agregado.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
