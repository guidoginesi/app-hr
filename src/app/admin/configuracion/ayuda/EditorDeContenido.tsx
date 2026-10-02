'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { DeleteConfirmDialog } from '@pow/ui/components/ui/delete-confirm-dialog';
import { RichTextEditor } from '../../RichTextEditor';
import { CuerpoDeAyuda } from '@/components/ayuda/CuerpoDeAyuda';
import { nombreDeIconoDe } from '@/components/ayuda/iconos';
import { AUDIENCIAS, type Audiencia, type AyudaContenido, type NombreDeIcono } from '@/lib/ayudaContenidos';
import { SelectorDeIcono } from './SelectorDeIcono';

type Props = {
  /** null para un contenido nuevo. */
  inicial: AyudaContenido | null;
  /** Las secciones que ya existen, para sugerirlas y no terminar con "Beneficios" y "beneficios". */
  secciones: string[];
};

/**
 * El editor de un contenido de Ayuda.
 *
 * Lo usa People, no un desarrollador: el texto se escribe con el mismo editor
 * que Comunicaciones (más títulos) y antes de publicar se puede ver como va a
 * quedar en el portal.
 */
export function EditorDeContenido({ inicial, secciones }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [seccion, setSeccion] = useState(inicial?.seccion ?? secciones[0] ?? '');
  const [resumen, setResumen] = useState(inicial?.resumen ?? '');
  const [cuerpo, setCuerpo] = useState(inicial?.cuerpo_html ?? '');
  const [link, setLink] = useState(inicial?.link_url ?? '');
  const [icono, setIcono] = useState<NombreDeIcono | null>(inicial?.icono ?? null);
  const [audiencia, setAudiencia] = useState<Audiencia>(inicial?.audiencia ?? 'todos');
  const [orden, setOrden] = useState(String(inicial?.orden ?? 100));
  const [publicado, setPublicado] = useState(inicial?.publicado ?? false);
  const [vista, setVista] = useState<'editar' | 'previa'>('editar');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const cuerpoDelPedido = {
        titulo,
        seccion,
        resumen: resumen || null,
        cuerpo_html: cuerpo,
        link_url: link || null,
        icono,
        audiencia,
        orden: Number(orden) || 0,
        publicado,
      };
      const res = await fetch(
        inicial ? `/api/admin/ayuda-contenidos/${inicial.id}` : '/api/admin/ayuda-contenidos',
        {
          method: inicial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpoDelPedido),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar.');
      if (!inicial) {
        // Recién creado: se pasa a editarlo, así tiene su dirección propia.
        router.replace(`/admin/configuracion/ayuda/${data.contenido.id}`);
        router.refresh();
        return;
      }
      setCuerpo(data.contenido.cuerpo_html);
      setAviso(publicado ? 'Guardado. Ya se ve en el portal.' : 'Guardado como borrador.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!inicial) return;
    setBorrando(true);
    try {
      const res = await fetch(`/api/admin/ayuda-contenidos/${inicial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo borrar.');
      router.replace('/admin/configuracion/ayuda');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBorrando(false);
      setConfirmarBorrado(false);
    }
  };

  const tieneTexto = cuerpo.replace(/<[^>]+>/g, '').trim().length > 0;
  const sugerido = nombreDeIconoDe({ titulo, icono: null, tipo: tieneTexto ? 'contenido' : 'link', link });

  const etiqueta = 'block text-sm font-medium text-secondary-foreground mb-1.5';
  const ayuda = 'mt-1 text-xs text-muted-foreground';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Columna principal: lo que se lee */}
      <div className="space-y-5 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="titulo" className={etiqueta}>Título</label>
          <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Días Pow" />
        </div>

        <div>
          <span className={etiqueta}>Ícono</span>
          <SelectorDeIcono valor={icono} sugerido={sugerido} onCambiar={setIcono} />
          <p className={ayuda}>Acompaña al título en el portal. En automático, sale del título.</p>
        </div>

        <div>
          <label htmlFor="resumen" className={etiqueta}>Resumen</label>
          <Textarea
            id="resumen"
            rows={2}
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder="Una o dos líneas: es lo que se lee en el índice, antes de abrirlo."
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={etiqueta + ' mb-0'}>Contenido</span>
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs">
              {(['editar', 'previa'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    vista === v ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'editar' ? 'Editar' : 'Vista previa'}
                </button>
              ))}
            </div>
          </div>
          {vista === 'editar' ? (
            <RichTextEditor content={cuerpo} onChange={setCuerpo} conTitulos placeholder="Escribí la política, el beneficio o cómo se hace…" />
          ) : (
            <div className="min-h-[200px] rounded-lg border border-[var(--border)] px-5 py-4">
              {tieneTexto ? (
                <CuerpoDeAyuda html={cuerpo} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin texto todavía.</p>
              )}
            </div>
          )}
          <p className={ayuda}>
            Si es sólo un formulario o un documento, podés dejarlo vacío y cargar el link: en el portal se abre directo.
          </p>
        </div>
      </div>

      {/* Columna lateral: dónde y para quién */}
      <div className="space-y-5 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm lg:self-start">
        <div>
          <label htmlFor="seccion" className={etiqueta}>Sección</label>
          <Input
            id="seccion"
            list="secciones-existentes"
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            placeholder="Beneficios"
          />
          <datalist id="secciones-existentes">
            {secciones.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className={ayuda}>Es el tema del portal donde aparece. Elegí uno existente o escribí uno nuevo.</p>
        </div>

        <div>
          <label htmlFor="link" className={etiqueta}>Link (opcional)</label>
          <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/…" />
          <p className={ayuda}>Un formulario, un doc o una planilla. Si además hay texto, aparece como botón al final.</p>
        </div>

        <div>
          <span className={etiqueta}>Para quién</span>
          <SelectMenu
            ariaLabel="Para quién"
            className="w-full"
            value={audiencia}
            onChange={(v) => setAudiencia(v as Audiencia)}
            options={(Object.keys(AUDIENCIAS) as Audiencia[]).map((a) => ({ value: a, label: AUDIENCIAS[a] }))}
          />
        </div>

        <div>
          <label htmlFor="orden" className={etiqueta}>Orden</label>
          <Input id="orden" type="number" min={0} value={orden} onChange={(e) => setOrden(e.target.value)} className="w-28" />
          <p className={ayuda}>Menor va primero. La sección se ubica donde está su contenido de menor orden.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-muted p-3">
          <Checkbox checked={publicado} onCheckedChange={(v) => setPublicado(v === true)} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">Publicado</span>
            <span className="block text-xs text-muted-foreground">Sin tildar queda como borrador: sólo se ve acá.</span>
          </span>
        </label>

        {error && <div className="rounded-lg bg-danger-subtle p-3 text-sm text-[var(--red-600)]">{error}</div>}
        {aviso && <div className="rounded-lg bg-success-subtle p-3 text-sm text-[var(--green-700)]">{aviso}</div>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={guardar} loading={guardando}>
            Guardar
          </Button>
          <Link href="/admin/configuracion/ayuda" className={buttonVariants({ variant: 'outline' })}>
            Volver
          </Link>
        </div>

        {inicial && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
            {inicial.publicado ? (
              <a
                href={`/portal/ayuda/recursos/${inicial.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--brand-strong)] hover:underline"
              >
                Ver en el portal
              </a>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setConfirmarBorrado(true)}
              className="text-sm font-medium text-[var(--red-600)] hover:underline"
            >
              Borrar
            </button>
          </div>
        )}
      </div>

      {inicial && (
        <DeleteConfirmDialog
          open={confirmarBorrado}
          onClose={() => setConfirmarBorrado(false)}
          onConfirm={borrar}
          entityLabel="el contenido"
          entityIdentifier={inicial.titulo}
          description="Deja de verse en el portal y no se puede recuperar. Si sólo querés ocultarlo, destildá Publicado."
          loading={borrando}
        />
      )}
    </div>
  );
}
