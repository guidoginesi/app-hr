import { z } from 'zod';
import { NOMBRES_DE_ICONOS } from '@/lib/ayudaContenidos';

/**
 * Lo que manda el editor del admin. Vive acá y no en route.ts porque Next no
 * deja exportar nada que no sea un método HTTP desde un archivo de ruta.
 */
const campos = {
  titulo: z.string().trim().min(2, 'El contenido necesita un título.').max(120),
  seccion: z.string().trim().min(2, 'Elegí o escribí una sección.').max(60),
  resumen: z.string().trim().max(300).nullable(),
  cuerpo_html: z.string().max(200_000),
  link_url: z.string().trim().max(1000).nullable(),
  /** null = que lo elija el portal según el título. */
  icono: z.enum(NOMBRES_DE_ICONOS, { message: 'Ese ícono no existe.' }).nullable(),
  audiencia: z.enum(['todos', 'dependency', 'monotributista']),
  orden: z.number().int().min(0).max(10_000),
  publicado: z.boolean(),
};

/** Un contenido nuevo: lo que no viene toma el valor de siempre. */
export const NuevoContenidoSchema = z.object({
  ...campos,
  resumen: campos.resumen.optional(),
  cuerpo_html: campos.cuerpo_html.default(''),
  link_url: campos.link_url.optional(),
  icono: campos.icono.optional(),
  audiencia: campos.audiencia.default('todos'),
  orden: campos.orden.default(100),
  publicado: campos.publicado.default(false),
});

/**
 * Cambios a uno que existe: sólo lo que viene. Sin valores por defecto a
 * propósito: en Zod 4 un default se aplica aunque el campo sea opcional, y
 * con ellos tildar "Publicado" en la lista (que manda sólo `publicado`)
 * vaciaba el texto y mandaba el contenido al final.
 */
export const CambiosDeContenidoSchema = z.object(campos).partial();
