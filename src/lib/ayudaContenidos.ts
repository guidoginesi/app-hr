/**
 * Contenidos de People en la Ayuda del portal.
 *
 * Reemplazan la página de Recursos Humanos del Pow Site, que quedó
 * desactualizada porque buena parte de lo que explicaba pasó a hacerse desde la
 * app. Acá los edita People desde el admin, sin deploy, y el portal los muestra
 * en Ayuda junto a los manuales.
 *
 * Cada sección es un tema del índice. Un contenido con cuerpo se lee en un
 * panel lateral; uno con sólo un link abre ese link (un formulario, un doc).
 *
 * Este archivo lo usan también los componentes del navegador, así que no
 * importa nada de servidor: la limpieza del HTML vive en ayudaContenidosHtml.ts.
 */

import type { EmploymentType } from '@/types/employee';

export type Audiencia = 'todos' | EmploymentType;

export const AUDIENCIAS: Record<Audiencia, string> = {
  todos: 'Todo el equipo',
  dependency: 'Sólo relación de dependencia',
  monotributista: 'Sólo monotributo',
};

/**
 * Los íconos que se pueden elegir para un contenido. Los nombres viven acá,
 * sin React, para que la API los pueda validar; qué dibujo es cada uno está en
 * components/ayuda/iconos.ts.
 */
export const NOMBRES_DE_ICONOS = [
  'calendario', 'dias-especiales', 'cumpleanos', 'vacaciones', 'mundo', 'avion',
  'internet', 'mascota', 'salud', 'medico', 'bebe', 'capacitacion', 'premio',
  'computadora', 'celular', 'escudo', 'balanza', 'documento', 'constancia',
  'formulario', 'firma', 'planilla', 'presentacion', 'datos', 'dinero',
  'billetera', 'recibo', 'regalo', 'oficina', 'casa', 'equipo', 'bienvenida',
  'mensaje', 'anuncio', 'comida', 'deporte', 'idea', 'estrella', 'mail', 'link',
  'carpeta', 'libro', 'pantalla',
] as const;

export type NombreDeIcono = (typeof NOMBRES_DE_ICONOS)[number];

export function esNombreDeIcono(valor: unknown): valor is NombreDeIcono {
  return typeof valor === 'string' && (NOMBRES_DE_ICONOS as readonly string[]).includes(valor);
}

export type AyudaContenido = {
  id: string;
  slug: string;
  seccion: string;
  titulo: string;
  resumen: string | null;
  cuerpo_html: string;
  link_url: string | null;
  /** null = lo elige el portal según el título. */
  icono: NombreDeIcono | null;
  audiencia: Audiencia;
  orden: number;
  publicado: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Un tema del índice de Ayuda: una sección de People, o los manuales del
 * portal, que son un tema más para que el buscador encuentre todo junto.
 */
export type TemaDeAyuda = {
  /** El slug del nombre. Va en la URL (`?tema=`) para volver al mismo tema. */
  id: string;
  nombre: string;
  /** Una línea bajo el título del tema. */
  descripcion: string;
  items: ItemDeAyuda[];
};

type BaseDeItem = {
  id: string;
  titulo: string;
  resumen: string | null;
  /** El que eligió People; si no eligió, null y sale del título. */
  icono: NombreDeIcono | null;
};

export type ItemDeAyuda =
  /** Tiene texto: se lee en el panel lateral, sin salir del índice. */
  | (BaseDeItem & {
      tipo: 'contenido';
      slug: string;
      /** Ya limpio. */
      html: string;
      /** El mismo cuerpo en texto plano, para buscar adentro. */
      texto: string;
      link: string | null;
      actualizado: string;
    })
  /** Es sólo un link —un formulario, un doc—: se abre en otra pestaña. */
  | (BaseDeItem & { tipo: 'link'; href: string })
  /** Un manual del portal, con su propia página. */
  | (BaseDeItem & { tipo: 'manual'; href: string; nuevo: boolean });

export type ContenidoDeAyuda = Extract<ItemDeAyuda, { tipo: 'contenido' }>;

/** El tema de los manuales. Si People crea una sección con este nombre, se juntan. */
export const TEMA_MANUALES = 'como-usar-el-portal';

/**
 * Qué es un link, para nombrarlo en el índice y en el botón. Google es lo que
 * usa People para todo; lo demás se nombra por su dominio.
 */
export function tipoDeLink(url: string): { nombre: string; abrir: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { nombre: 'Link', abrir: 'Abrir el link' };
  }
  if (u.protocol === 'mailto:') return { nombre: 'Mail', abrir: 'Escribir un mail' };

  const host = u.hostname.replace(/^www\./, '');
  const google = host === 'docs.google.com';
  if (host === 'forms.gle' || (google && u.pathname.includes('/forms/'))) {
    return { nombre: 'Formulario', abrir: 'Abrir el formulario' };
  }
  if (google && u.pathname.includes('/document/')) return { nombre: 'Documento', abrir: 'Abrir el documento' };
  if (google && u.pathname.includes('/spreadsheets/')) return { nombre: 'Planilla', abrir: 'Abrir la planilla' };
  if (google && u.pathname.includes('/presentation/')) return { nombre: 'Presentación', abrir: 'Abrir la presentación' };
  if (host === 'drive.google.com') return { nombre: 'Drive', abrir: 'Abrir en Drive' };
  return { nombre: host, abrir: 'Abrir el link' };
}

/** "Días Pow y vacaciones" → "dias-pow-y-vacaciones". */
export function slugDe(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'contenido';
}

/**
 * Sólo http, https o mailto. Un `javascript:` en el link de un contenido se
 * ejecutaría al hacerle clic.
 */
export function linkValido(url: string | null | undefined): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** ¿Se le muestra a esta persona? */
export function visiblePara(c: Pick<AyudaContenido, 'audiencia'>, tipo: EmploymentType | null | undefined): boolean {
  return c.audiencia === 'todos' || c.audiencia === tipo;
}

/**
 * Las secciones en el orden en que se ven. Una sección va donde va su contenido
 * de menor `orden`, así reordenar un contenido alcanza para mover su sección.
 */
export function agruparPorSeccion<T extends Pick<AyudaContenido, 'seccion' | 'orden' | 'titulo'>>(
  items: T[],
): { seccion: string; items: T[] }[] {
  const porSeccion = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo))) {
    const lista = porSeccion.get(it.seccion) ?? [];
    lista.push(it);
    porSeccion.set(it.seccion, lista);
  }
  return [...porSeccion.entries()].map(([seccion, lista]) => ({ seccion, items: lista }));
}
