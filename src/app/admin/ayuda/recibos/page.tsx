import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaRecibosPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Recepción de recibos"
      description="Cómo seguir quién confirmó haber recibido su recibo de sueldo, recordar a los pendientes y exportar las constancias."
    >
      <div className="mb-2">
        <Link href="/admin/ayuda" className="text-sm text-[var(--brand-strong)] hover:underline">← Volver a Ayuda</Link>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El circuito, de un vistazo</p>
        <p className="mt-2 text-sm text-foreground">
          Publicás el recibo del período → al colaborador le llega el <b>aviso</b> (mail + in-app) → entra al portal,
          lo descarga y marca <b>“Recibido”</b> → vos ves el estado en <b>Recepción de recibos</b> y podés
          <b> recordar a los pendientes</b> o <b>exportar las constancias</b>.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--amber-200,var(--border))] bg-warning-subtle p-5">
        <p className="text-sm text-[var(--amber-600)]">
          <b>Importante:</b> la casilla registra la <b>recepción</b> del documento (que la persona accedió a él).
          <b> No es conformidad</b> con lo liquidado ni reemplaza la firma del recibo de sueldo.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde encontrarlo" imageAlt="Menú lateral con 'Recepción de recibos' en la sección Gestión.">
          <p>En el menú lateral, <b>Gestión → Recepción de recibos</b>. Es una vista de solo lectura del estado: no muestra montos, así que también la puede usar el perfil <b>Administración</b>.</p>
          <p>El mismo panel aparece dentro del detalle de cada período de <b>Liquidaciones</b>.</p>
        </ManualStep>

        <ManualStep n={2} title="Leer el estado" imageAlt="Las tres tarjetas: Publicados, Confirmados con porcentaje y Pendientes.">
          <p>Arriba ves <b>Publicados</b> (recibos disponibles), <b>Confirmados</b> (con el % de avance) y <b>Pendientes</b>. Podés filtrar por <b>período</b> y por estado (Todos / Confirmados / Pendientes).</p>
          <p>Los períodos anteriores a la puesta en marcha figuran como <b>“Sin acuse requerido”</b>: se siguen viendo y descargando, pero no cuentan como pendientes.</p>
        </ManualStep>

        <ManualStep n={3} title="Recordar a los pendientes" imageAlt="Botón 'Recordar a pendientes' con la cantidad entre paréntesis.">
          <p>Elegí un período y tocá <b>Recordar a pendientes</b>: a cada uno le llega un mail y un aviso in-app pidiéndole que confirme.</p>
          <p>Además hay un <b>recordatorio automático</b>: el primero a los <b>3 días</b> de publicado el recibo, después cada <b>7 días</b>, hasta <b>4 envíos</b>. Se corta cuando la persona confirma o cuando se cierra el período. <b>No se escala al líder.</b></p>
        </ManualStep>

        <ManualStep n={4} title="Exportar las constancias" imageAlt="Botón 'Exportar constancias' que descarga el CSV.">
          <p>Con <b>Exportar constancias</b> bajás un CSV con período, colaborador, email, estado, fecha de publicación y de confirmación, versión del documento, el <b>archivo confirmado</b>, y la IP y el navegador desde donde se confirmó. Sirve como respaldo ante un reclamo.</p>
        </ManualStep>

        <ManualStep n={5} title="Si tenés que corregir un recibo" imageAlt="Aviso al reemplazar un recibo ya publicado, pidiendo el motivo del reemplazo.">
          <p>Si reemplazás el PDF de un recibo <b>ya publicado</b>, la app te pide el <b>motivo</b> y genera una <b>versión nueva</b> sin pisar el archivo anterior (esa es la evidencia de qué documento se había confirmado).</p>
          <p>La constancia previa queda <b>archivada</b>, la persona vuelve a <b>pendiente</b> y recibe un aviso para descargar la versión corregida y volver a confirmar.</p>
        </ManualStep>

        <ManualStep n={6} title="Quién ve qué" imageAlt="Vista de Administración con la nav recortada.">
          <p>Acceden a los recibos <b>la persona</b>, <b>People</b> y <b>Administración</b> (esta última, solo el estado de recepción, sin montos). <b>El líder no ve recibos</b> de su equipo por ninguna vía.</p>
          <p>Las consultas o dudas sobre la liquidación se canalizan por el <b>chat del portal</b>, fuera de este módulo.</p>
        </ManualStep>
      </div>
    </AyudaLayout>
  );
}
