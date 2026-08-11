import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AyudaLayout } from '../AyudaLayout';
import { ManualStep } from '@/components/manual/ManualStep';

export const dynamic = 'force-dynamic';

export default async function AyudaBancoDeTalentosPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AyudaLayout
      title="Manual · Banco de Talentos"
      description="Qué hacer con la gente que deja sus datos sin postularse a una búsqueda."
    >
      <div className="rounded-xl border border-[var(--border)] bg-muted p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          El circuito, de un vistazo
        </p>
        <p className="mt-2 text-sm text-foreground">
          Alguien entra al portal público, no encuentra una búsqueda que le sirva y deja sus datos →
          entra al banco como <b>Nuevo</b> y recibe un mail de confirmación → ustedes lo revisan y lo
          pasan a <b>En espera</b> o <b>Descartado</b> → cuando se abre una búsqueda que le va, con{' '}
          <b>Asignar</b> pasa al pipeline de esa búsqueda sin salir del banco.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <ManualStep n={1} title="Dónde encontrarlo" imageAlt="Pestaña Banco de Talentos dentro de Reclutamiento.">
          <p>
            En el menú lateral, <b>Personas → Reclutamiento</b>, pestaña <b>Banco de Talentos</b>.
          </p>
          <p>
            Cuando entra alguien nuevo, el ítem <b>Reclutamiento</b> del menú muestra un{' '}
            <b>punto naranja</b>. Se apaga al entrar al módulo, y es por persona: que lo haya visto
            otro no apaga el tuyo.
          </p>
          <p>
            Además, cada mañana les llega un <b>resumen por mail</b> con los perfiles que siguen en
            Nuevo. Si no hay ninguno, no se manda nada.
          </p>
        </ManualStep>

        <ManualStep n={2} title="De dónde sale esta gente" imageAlt="Sección del portal público con el botón Dejar mis datos.">
          <p>
            Del portal público de búsquedas. Abajo del listado hay una sección{' '}
            <b>&ldquo;¿No encontrás lo que buscás?&rdquo;</b> que lleva a un formulario donde dejan
            nombre, mail, LinkedIn, nivel de experiencia, áreas de interés, un mensaje y el CV.
          </p>
          <p>
            El <b>CV es obligatorio</b>. Sin CV no se podría asignar el perfil a una búsqueda, así que
            un registro sin CV no serviría para nada.
          </p>
          <p>
            El link es <b>/jobs/banco-de-talentos</b>, se puede compartir suelto en LinkedIn o donde
            haga falta.
          </p>
        </ManualStep>

        <ManualStep n={3} title="Los cuatro estados" imageAlt="Fila del banco con el selector de estado.">
          <p>
            <b>Nuevo</b> — entra así todo el mundo. Es lo que hay que revisar.
          </p>
          <p>
            <b>En espera</b> — el perfil está bueno pero hoy no hay búsqueda que le aplique. Queda
            guardado para cuando aparezca.
          </p>
          <p>
            <b>Descartado</b> — no encaja. No se borra nada: sigue estando, filtrable.
          </p>
          <p>
            <b>Asignado</b> — ya lo mandaron a una búsqueda. Este no se elige a mano: se consigue con
            el botón Asignar, y la fila muestra a qué búsqueda fue y cuándo.
          </p>
        </ManualStep>

        <ManualStep n={4} title="Asignar a una búsqueda" imageAlt="Panel lateral para elegir la búsqueda.">
          <p>
            El botón <b>Asignar</b> abre un panel con las búsquedas <b>publicadas</b>. Al confirmar,
            la persona entra al pipeline de esa búsqueda en <b>Revisión HR</b>, igual que cualquier
            postulación, y con la etiqueta <b>Origen: Banco de Talentos</b> para que se vea que la
            trajeron ustedes.
          </p>
          <p>
            El registro <b>no sale del banco</b>: queda como Asignado. Así siempre se sabe qué se hizo
            con cada persona.
          </p>
          <p>
            <b>No se le manda mail</b> al asignarlo. La persona no se postuló a esa búsqueda, la
            trajeron ustedes; mandarle un &ldquo;recibimos tu postulación&rdquo; la confundiría. Si
            avanza en el proceso, ahí sí recibe los avisos normales.
          </p>
          <p>
            Si la persona ya está en proceso en otra búsqueda, el panel lo avisa antes de confirmar.
          </p>
        </ManualStep>

        <ManualStep n={5} title="Si alguien vuelve a dejar sus datos" imageAlt="Fila con la etiqueta Volvió a anotarse.">
          <p>
            No se duplica: es la misma persona, identificada por el mail. Se actualizan sus datos y el
            CV nuevo reemplaza al anterior.
          </p>
          <p>
            Si estaba en Nuevo o En espera, vuelve a <b>Nuevo</b> para que lo revisen de nuevo.
          </p>
          <p>
            Si ya lo habían <b>descartado</b> o <b>asignado</b>, el estado <b>no cambia</b> — se
            actualiza el CV y aparece la etiqueta <b>Volvió a anotarse</b>. Sin esto, alguien
            insistente reaparecería en la bandeja cada vez.
          </p>
        </ManualStep>

        <ManualStep n={6} title="Es la misma ficha que la de las búsquedas" imageAlt="Ficha de candidato con su historial.">
          <p>
            Quien deja sus datos en el banco y además se postula a una búsqueda es <b>una sola
            persona</b> en el sistema, no dos fichas separadas. El mail es lo que las une.
          </p>
          <p>
            Por eso, si alguien ya se había postulado antes, al dejar sus datos en el banco se le
            suma esa entrada a la ficha que ya existía.
          </p>
        </ManualStep>

        <ManualStep n={7} title="Cambiar las áreas de interés" imageAlt="Configuración de áreas del Banco de Talentos.">
          <p>
            En <b>Reclutamiento → Configuración → Áreas del Banco</b>. Son las áreas como las entiende
            alguien de afuera, por eso no son los departamentos internos: un candidato no sabe qué es
            &ldquo;Front-end VTEX&rdquo;.
          </p>
          <p>
            Un área que ya se usó <b>no se borra, se desactiva</b>: deja de ofrecerse en el formulario
            pero los registros viejos la siguen mostrando.
          </p>
        </ManualStep>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Las capturas de esta guía se agregan en breve.
      </p>
    </AyudaLayout>
  );
}
