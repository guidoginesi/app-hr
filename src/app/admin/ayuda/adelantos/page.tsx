import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaAdelantosPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Adelantos de sueldo"
      description="Cómo gestionar las solicitudes de adelanto: de la solicitud del colaborador al descuento en la liquidación."
    >
      <div className="mb-2">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>
      </div>

      {/* Resumen del flujo */}
      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El flujo, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          El colaborador solicita desde el portal → <b>People (RRHH)</b> revisa y aprueba → <b>Administración</b> valida y aprueba →
          se <b>transfiere</b> → al armar la liquidación del mes el adelanto se <b>descuenta</b> y queda <b>saldado</b>.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde encontrarlo" imageAlt="Menú lateral del admin con 'Adelantos' resaltado en la sección Gestión.">
          <p>En el menú lateral, dentro de <b>Gestión → Adelantos</b>. Ahí ves todas las solicitudes de adelanto de sueldo.</p>
        </ManualStep>

        <ManualStep n={2} title="La cola de solicitudes" imageAlt="Tabla de solicitudes con columnas Colaborador, Monto, Mes de descuento, Tipo y Estado, y el filtro de Estado arriba.">
          <p>Cada fila es una solicitud, con su <b>monto</b>, el <b>mes de descuento</b>, el <b>tipo</b> (Estándar / Excepción / Emergencia) y el <b>estado</b>. Podés filtrar por estado arriba.</p>
          <p>Los estados siguen el flujo: <b>Pendiente RRHH → Pendiente Administración → Aprobado → Transferido → Saldado</b> (o Rechazado / Bloqueado).</p>
        </ManualStep>

        <ManualStep n={3} title="Gestionar una solicitud" imageAlt="Fila expandida al hacer clic en 'Gestionar', mostrando el motivo del colaborador y los botones de acción.">
          <p>Tocá <b>Gestionar</b> en una fila para abrir el panel de acciones. Ahí ves el motivo del colaborador (si lo hay) y las acciones disponibles según el estado.</p>
        </ManualStep>

        <ManualStep n={4} title="Aprobación de People (RRHH)" imageAlt="Panel de una solicitud en Pendiente RRHH: el switch 'Confirmo que no tiene renuncia comunicada' y el botón 'Aprobar → Administración'.">
          <p>Con la solicitud en <b>Pendiente RRHH</b>, confirmá con el switch que el colaborador <b>no tiene una renuncia comunicada</b> y tocá <b>Aprobar → Administración</b>. Sin ese check no se puede aprobar.</p>
        </ManualStep>

        <ManualStep n={5} title="Aprobación de Administración" imageAlt="Panel de una solicitud en Pendiente Administración con el recordatorio del 50% y el botón 'Aprobar'.">
          <p>En <b>Pendiente Administración</b>, validá manualmente que el monto no supere el <b>50% del neto</b> del colaborador y tocá <b>Aprobar</b>. La solicitud pasa a <b>Aprobado</b>.</p>
        </ManualStep>

        <ManualStep n={6} title="Transferir y saldar" imageAlt="Panel de una solicitud Aprobada con los botones 'Marcar transferido' y 'Marcar saldado'.">
          <p>Una vez aprobada, hacé la transferencia (dentro de los 5 días hábiles) y marcala como <b>Transferido</b>. El paso a <b>Saldado</b> se hace solo al cerrar la liquidación del mes (ver paso 9), o manualmente si hace falta.</p>
        </ManualStep>

        <ManualStep n={7} title="Rechazar o bloquear" imageAlt="Panel con el campo de motivo y los botones 'Rechazar' y 'Bloquear (renuncia)'.">
          <p>En cualquier paso podés <b>Rechazar</b> (con motivo) — el colaborador recibe el aviso con la explicación. Si hay una <b>renuncia comunicada</b>, usá <b>Bloquear</b>: corta el flujo y no se otorga.</p>
        </ManualStep>

        <ManualStep n={8} title="Invitar un aprobador de Administración" imageAlt="Botón 'Invitar aprobador' y el formulario con el campo de email.">
          <p>Con el botón <b>Invitar aprobador</b> creás un acceso con perfil <b>Administración</b>: solo puede aprobar/transferir adelantos, nada más del admin. La persona recibe un email para configurar su contraseña.</p>
        </ManualStep>

        <ManualStep n={9} title="Descuento en la liquidación" imageAlt="Detalle de un período de liquidación con la sección 'Adelantos del mes' mostrando el descuento Computado/Informado y el botón 'Actualizar adelantos'.">
          <p>Al crear la <b>liquidación del mes</b>, los adelantos aprobados de ese mes se aplican solos. En el detalle del período vas a ver la sección <b>Adelantos del mes</b>:</p>
          <p>• <b>Computado</b> (monotributistas): el descuento se resta del total automáticamente.<br />• <b>Informado</b> (relación de dependencia): como el recibo es un PDF, el monto se muestra para que lo apliques al armarlo.</p>
          <p>El botón <b>Actualizar adelantos</b> vuelve a traer los pendientes (útil si aprobás uno después de crear el período). Al <b>cerrar</b> el período, esos adelantos se marcan <b>Saldados</b> automáticamente.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
