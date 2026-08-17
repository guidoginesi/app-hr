/**
 * Qué se publica de una licencia en el calendario del equipo.
 *
 * Vive aparte de `leaveCalendar.ts` a propósito: ese módulo habla con Supabase y
 * no puede entrar a un componente cliente. La pantalla de solicitudes necesita
 * el mismo título para el link manual, y dos lugares que arman el título por su
 * cuenta terminan discrepando justo en el caso que importa.
 */

import { SICK_LEAVE_CODE } from '@/lib/leaveCertificates';

/**
 * Tipos que van al calendario del equipo.
 *
 * `remote_work` está adentro porque al equipo le sirve saber desde dónde trabaja
 * cada uno, no porque sea una ausencia. Si algún día molesta, se saca de acá.
 */
export const TIPOS_SINCRONIZABLES = [
  'vacation',
  'pow_days',
  'study',
  'remote_work',
  'remote_work_trip',
  'sick',
  'birthday',
];

export type DatosDelEvento = {
  leave_type_code: string;
  leave_type_name: string;
  employee_name: string;
  days_requested: number;
  count_type: string;
};

/**
 * El título y la descripción que se publican.
 *
 * La licencia por enfermedad va con un **título neutro**. El calendario lo lee
 * toda la empresa, y el módulo está construido para que al líder le llegue el
 * aviso sin datos de salud: publicar "Licencia por enfermedad — Fulano" en la
 * pantalla más visible que hay desharía eso mismo. Al equipo le sirve saber que
 * la persona no está; por qué no está no es asunto del calendario.
 */
export function textoDelEvento(datos: DatosDelEvento): { titulo: string; descripcion: string } {
  const unidad = datos.count_type === 'weeks' ? 'semana(s)' : 'día(s)';

  if (datos.leave_type_code === SICK_LEAVE_CODE) {
    return {
      titulo: `Ausente — ${datos.employee_name}`,
      descripcion: `Duración: ${datos.days_requested} ${unidad}\nCargado desde app-hr.`,
    };
  }

  return {
    titulo: `${datos.leave_type_name} — ${datos.employee_name}`,
    descripcion:
      `Tipo: ${datos.leave_type_name}\n` +
      `Empleado: ${datos.employee_name}\n` +
      `Duración: ${datos.days_requested} ${unidad}\n` +
      `Cargado desde app-hr.`,
  };
}
