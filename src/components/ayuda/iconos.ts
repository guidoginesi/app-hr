import {
  Award,
  Baby,
  Banknote,
  BookOpen,
  Building2,
  Cake,
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  Dumbbell,
  FileCheck,
  FileSignature,
  FileText,
  FolderOpen,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  HeartPulse,
  House,
  IdCard,
  Laptop,
  Lightbulb,
  Link2,
  Mail,
  Megaphone,
  MessagesSquare,
  MonitorSmartphone,
  PawPrint,
  Plane,
  Presentation,
  Receipt,
  Scale,
  ShieldCheck,
  Smartphone,
  Star,
  Stethoscope,
  Table2,
  TreePalm,
  Users,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { normalizar } from '@/lib/ayudaBusqueda';
import { TEMA_MANUALES, tipoDeLink, type ItemDeAyuda, type NombreDeIcono } from '@/lib/ayudaContenidos';

/** El catálogo: qué dibujo es cada nombre y cómo se llama en el selector del admin. */
export const ICONOS: Record<NombreDeIcono, { Icono: LucideIcon; nombre: string }> = {
  calendario: { Icono: CalendarDays, nombre: 'Calendario' },
  'dias-especiales': { Icono: CalendarHeart, nombre: 'Días especiales' },
  cumpleanos: { Icono: Cake, nombre: 'Cumpleaños' },
  vacaciones: { Icono: TreePalm, nombre: 'Vacaciones' },
  mundo: { Icono: Globe, nombre: 'Mundo' },
  avion: { Icono: Plane, nombre: 'Viaje' },
  internet: { Icono: Wifi, nombre: 'Internet' },
  mascota: { Icono: PawPrint, nombre: 'Mascotas' },
  salud: { Icono: HeartPulse, nombre: 'Salud' },
  medico: { Icono: Stethoscope, nombre: 'Médico' },
  bebe: { Icono: Baby, nombre: 'Familia' },
  capacitacion: { Icono: GraduationCap, nombre: 'Capacitación' },
  premio: { Icono: Award, nombre: 'Reconocimiento' },
  computadora: { Icono: Laptop, nombre: 'Computadora' },
  celular: { Icono: Smartphone, nombre: 'Celular' },
  escudo: { Icono: ShieldCheck, nombre: 'Política' },
  balanza: { Icono: Scale, nombre: 'Legal' },
  documento: { Icono: FileText, nombre: 'Documento' },
  constancia: { Icono: FileCheck, nombre: 'Constancia' },
  formulario: { Icono: ClipboardList, nombre: 'Formulario' },
  firma: { Icono: FileSignature, nombre: 'Firma' },
  planilla: { Icono: Table2, nombre: 'Planilla' },
  presentacion: { Icono: Presentation, nombre: 'Presentación' },
  datos: { Icono: IdCard, nombre: 'Datos personales' },
  dinero: { Icono: Banknote, nombre: 'Dinero' },
  billetera: { Icono: Wallet, nombre: 'Sueldo' },
  recibo: { Icono: Receipt, nombre: 'Recibo' },
  regalo: { Icono: Gift, nombre: 'Beneficio' },
  oficina: { Icono: Building2, nombre: 'Oficina' },
  casa: { Icono: House, nombre: 'Casa' },
  equipo: { Icono: Users, nombre: 'Equipo' },
  bienvenida: { Icono: Handshake, nombre: 'Bienvenida' },
  mensaje: { Icono: MessagesSquare, nombre: 'Consulta' },
  anuncio: { Icono: Megaphone, nombre: 'Anuncio' },
  comida: { Icono: Utensils, nombre: 'Comida' },
  deporte: { Icono: Dumbbell, nombre: 'Deporte' },
  idea: { Icono: Lightbulb, nombre: 'Idea' },
  estrella: { Icono: Star, nombre: 'Destacado' },
  mail: { Icono: Mail, nombre: 'Mail' },
  link: { Icono: Link2, nombre: 'Link' },
  carpeta: { Icono: FolderOpen, nombre: 'Carpeta' },
  libro: { Icono: BookOpen, nombre: 'Manual' },
  pantalla: { Icono: MonitorSmartphone, nombre: 'Portal' },
};

/**
 * Palabra del título → ícono, para los contenidos que no tienen uno elegido.
 * El orden importa: "Reintegro de internet" es internet antes que reintegro, y
 * "Adelantos de sueldo" es un adelanto antes que sueldo.
 */
const POR_TITULO: Array<[RegExp, NombreDeIcono]> = [
  [/cumple/, 'cumpleanos'],
  [/dias? pow/, 'dias-especiales'],
  [/vacacion/, 'vacaciones'],
  [/anywhere|remot|home office|viaj/, 'mundo'],
  [/internet|wifi|conexion/, 'internet'],
  [/mascota|\bpets?\b/, 'mascota'],
  [/guarderia|maternidad|paternidad|nacimiento|lactancia|licencia extendida/, 'bebe'],
  [/enfermedad|certificado medico/, 'medico'],
  [/medic|salud|prepaga|obra social|swiss/, 'salud'],
  [/estudio|examen|capacitacion|curso|formacion/, 'capacitacion'],
  [/computadora|notebook|laptop|equipamiento/, 'computadora'],
  [/celular|telefono/, 'celular'],
  [/conducta|politica|norma|reglamento|seguridad/, 'escudo'],
  [/constancia|certificado/, 'constancia'],
  [/datos|domicilio|\bcbu\b/, 'datos'],
  [/adelanto|prestamo/, 'dinero'],
  [/recibo|reintegro|gasto|factura/, 'recibo'],
  [/liquidacion|sueldo|pago/, 'billetera'],
  [/consulta/, 'mensaje'],
  [/comunicacion|mensaje|novedad/, 'anuncio'],
  [/oficina|sala/, 'oficina'],
  [/onboarding|bienvenid|ingreso/, 'bienvenida'],
  [/gimnasio|deporte/, 'deporte'],
  [/almuerzo|comida|vianda/, 'comida'],
  [/beneficio|regalo/, 'regalo'],
];

/** El de un link sin texto, según qué es: un formulario se ve como formulario. */
const POR_TIPO_DE_LINK: Record<string, NombreDeIcono> = {
  Formulario: 'formulario',
  Documento: 'documento',
  Planilla: 'planilla',
  Presentación: 'presentacion',
  Mail: 'mail',
};

type ParaIcono = {
  titulo: string;
  icono: NombreDeIcono | null;
  tipo: ItemDeAyuda['tipo'];
  /** Sólo cuenta para los que son únicamente un link. */
  link?: string | null;
};

/**
 * El ícono de un contenido: el que eligió People o, si no eligió, el que
 * sugiere el título; si el título no sugiere nada, el de su tipo.
 */
export function nombreDeIconoDe({ titulo, icono, tipo, link }: ParaIcono): NombreDeIcono {
  if (icono) return icono;
  const porTitulo = POR_TITULO.find(([regla]) => regla.test(normalizar(titulo)))?.[1];
  if (porTitulo) return porTitulo;
  if (tipo === 'manual') return 'libro';
  if (tipo === 'link' && link) return POR_TIPO_DE_LINK[tipoDeLink(link).nombre] ?? 'link';
  return 'documento';
}

/** El ícono de un ítem del índice del portal. */
export function nombreDeIconoDeItem(item: ItemDeAyuda): NombreDeIcono {
  return nombreDeIconoDe({ ...item, link: item.tipo === 'link' ? item.href : null });
}

/**
 * Palabra del nombre de un tema → ícono. El orden importa: "Beneficios de
 * salud" es un beneficio antes que salud.
 */
const POR_TEMA: Array<[RegExp, NombreDeIcono]> = [
  [/benefici/, 'regalo'],
  [/salud|medic|obra social|prepaga|bienestar/, 'salud'],
  [/licencia|vacacion|time off|ausencia|feriado|dias/, 'calendario'],
  [/remot|anywhere|home office|viaje/, 'mundo'],
  [/sueldo|pago|liquidacion|recibo|reintegro|gasto|compensacion|remuneracion/, 'billetera'],
  [/capacitacion|formacion|aprendizaje|estudio|curso|desarrollo/, 'capacitacion'],
  [/politica|norma|reglamento|codigo|conducta|compliance|legal/, 'escudo'],
  [/formulario|tramite|solicitud|pedido/, 'formulario'],
  [/onboarding|bienvenid|ingreso|primeros/, 'bienvenida'],
  [/equipo|cultura|organigrama|contacto|people|personas/, 'equipo'],
  [/oficina|sala|espacio|edificio/, 'oficina'],
  [/herramienta|equipamiento|computadora|tecnologia|sistemas/, 'computadora'],
  [/comunicacion|novedad|noticia/, 'anuncio'],
  [/documento|archivo|plantilla|recurso|material/, 'carpeta'],
];

/**
 * El ícono de un tema, según cómo se llama.
 *
 * Las secciones las nombra People desde el admin, así que no hay una lista
 * cerrada contra la cual mapear: se reconocen por palabras. Lo que no se
 * reconoce lleva el libro, que es el ícono de Ayuda en el menú.
 */
export function nombreDeIconoDeTema(tema: { id?: string; nombre: string }): NombreDeIcono {
  if (tema.id === TEMA_MANUALES) return 'pantalla';
  const nombre = normalizar(tema.nombre);
  return POR_TEMA.find(([regla]) => regla.test(nombre))?.[1] ?? 'libro';
}
