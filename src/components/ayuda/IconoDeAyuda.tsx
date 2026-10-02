import type { LucideProps } from 'lucide-react';
import type { NombreDeIcono } from '@/lib/ayudaContenidos';
import { ICONOS } from './iconos';

/**
 * Un ícono del catálogo de Ayuda, por su nombre. Se elige por nombre y no
 * pasando el componente: así cada pantalla dibuja siempre el mismo componente
 * y React no lo trata como uno nuevo en cada render.
 */
export function IconoDeAyuda({ nombre, ...props }: LucideProps & { nombre: NombreDeIcono }) {
  const { Icono } = ICONOS[nombre];
  return <Icono {...props} />;
}
