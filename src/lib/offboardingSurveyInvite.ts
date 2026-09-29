/**
 * La invitación a la encuesta de salida.
 *
 * Se manda una sola vez, cuando RRHH registra la baja con la encuesta
 * habilitada. No hay recordatorios: para repetir haría falta guardar que ya se
 * mandó, y eso es una columna nueva en `employees`. Si algún día hacen falta,
 * ese es el cambio.
 *
 * El mail importa más de lo que parece. Desde que el portal corta el acceso a
 * quien ya no trabaja acá, la encuesta es la única pantalla que le queda — y si
 * nadie le avisa, se entera sólo si se le ocurre entrar.
 */

import { renderEmail, getAppUrl, getReplyTo } from './email/layout';
import { sendSimpleEmail } from './emailService';
import { formatDateLocal } from './dateUtils';
import { getRoleEmails } from './notificationService';

export type ParaInvitar = {
  first_name: string | null;
  personal_email: string | null;
  work_email: string | null;
  termination_date: string | null;
};

export type Invitacion =
  | { enviada: true; a: string[] }
  | { enviada: false; motivo: 'sin-mail' | 'falló'; detalle?: string };

/**
 * Las casillas de la persona, en orden de importancia.
 *
 * Primero el **personal**, al revés que el resto de la app, que usa
 * `work_email || personal_email`: el de trabajo es justamente el que se da de
 * baja cuando alguien se va, así que es el que puede no existir más.
 *
 * Y también el de trabajo, mientras siga vivo. Desde que las bajas se pueden
 * programar, la invitación puede salir días antes del último día: ahí la
 * casilla de Pow todavía funciona y es donde la persona mira todos los días.
 * Si ya se dio de baja, ese mail rebota y queda el personal, que es el que
 * importa.
 */
function aDondeMandar(e: ParaInvitar): string[] {
  const casillas = [e.personal_email, e.work_email]
    .map((m) => (m ?? '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(casillas)];
}

function mail(e: ParaInvitar): { subject: string; html: string } {
  const nombre = (e.first_name ?? '').trim();
  const hola = nombre ? `Hola ${nombre}` : 'Hola';

  // La baja se puede registrar antes del último día. Si todavía no llegó, se lo
  // decimos, para que el pedido no suene a que ya se tiene que haber ido.
  const ultimoDia = e.termination_date ? formatDateLocal(e.termination_date) : null;
  const esFutura = e.termination_date ? e.termination_date > new Date().toISOString().split('T')[0] : false;

  // En minúscula: va detrás de "Hola Ana, ".
  const contexto = esFutura && ultimoDia
    ? `sabemos que tu último día con nosotros es el ${ultimoDia}.`
    : 'gracias por el tiempo que pasaste con nosotros.';

  return {
    subject: 'Contanos cómo te fue',
    html: renderEmail({
      title: 'Contanos cómo te fue',
      contextLabel: 'People · Offboarding',
      preheader: 'Tu opinión nos ayuda a mejorar. Son unos minutos.',
      intro:
        `${hola}, ${contexto} Nos gustaría conocer tu experiencia: qué funcionó, qué no, y qué ` +
        `deberíamos cambiar. La lee el equipo de People y nos sirve de verdad para mejorar.\n\n` +
        `Son unos minutos. Entrás al portal con el mismo mail y la misma contraseña de siempre.`,
      cta: { label: 'Completar la encuesta', url: `${getAppUrl()}/portal/offboarding` },
      outro: 'Si no la querés completar, no pasa nada: podés ignorar este mail.',
    }),
  };
}

/**
 * Manda la invitación. Nunca lanza: la baja no se cae porque falle un mail.
 *
 * Va con copia a People. No es control: es que la invitación sale una sola vez
 * y sin copia nadie del equipo se entera de que salió, ni a qué casilla. Si
 * después la persona no contesta, al menos se sabe que se le escribió.
 *
 * Si falla la copia no pasa nada: lo que no puede fallar es el mail a la
 * persona, y eso es lo que decide el resultado.
 */
export async function invitarAEncuestaDeSalida(e: ParaInvitar): Promise<Invitacion> {
  const destinos = aDondeMandar(e);
  if (destinos.length === 0) return { enviada: false, motivo: 'sin-mail' };

  const contenido = mail(e);

  try {
    const res = await sendSimpleEmail({ to: destinos, replyTo: getReplyTo(), ...contenido });
    if (!res.success) return { enviada: false, motivo: 'falló', detalle: res.error };

    await copiarAPeople(e, destinos).catch((error) => {
      console.error('[Offboarding] no se pudo copiar a People:', error);
    });

    return { enviada: true, a: destinos };
  } catch (error) {
    return { enviada: false, motivo: 'falló', detalle: (error as Error)?.message };
  }
}

/** La copia para el equipo, con un encabezado que aclara que es una copia. */
async function copiarAPeople(e: ParaInvitar, destinos: string[]): Promise<void> {
  const people = await getRoleEmails(['admin']);
  if (people.length === 0) return;

  const quien = (e.first_name ?? '').trim() || 'la persona';
  await sendSimpleEmail({
    to: people.map((p) => p.email),
    replyTo: getReplyTo(),
    subject: `Copia: se le pidió la entrevista de salida a ${quien}`,
    html: renderEmail({
      title: 'Entrevista de salida enviada',
      contextLabel: 'People · Offboarding',
      preheader: `Copia de lo que recibió ${quien}.`,
      intro:
        `Se le mandó la entrevista de salida a ${quien}, a ${destinos.join(' y ')}. ` +
        `El texto es el mismo que ya conocés.`,
      cta: { label: 'Ver las entrevistas', url: `${getAppUrl()}/admin/people/salidas` },
      outro: 'Esto es una copia automática. La persona no ve este mail.',
    }),
  });
}
