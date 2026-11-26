import type { Metadata } from 'next';
import { RsvpClient } from './RsvpClient';
import { RsvpOptionsClient } from './RsvpOptionsClient';

export const metadata: Metadata = { title: 'Tu respuesta · Pow', robots: { index: false, follow: false } };

// Página a la que llevan los botones "Voy / No voy" del mail. No pide sesión:
// la respuesta se guarda con el link firmado (ver src/lib/rsvp.ts). La guarda
// un POST que hace la página en el navegador, no el GET de la URL: así los
// filtros de mail que sólo abren los links para revisarlos no responden.
export default async function RsvpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const index = (k: string) => (/^\d$/.test(one(k)) ? Number(one(k)) : undefined);
  const q = index('q');
  const o = index('o');
  // Pregunta con opciones (q + o) o "Voy / No voy" (r).
  if (q !== undefined && o !== undefined) {
    return <RsvpOptionsClient m={one('m')} u={one('u')} t={one('t')} q={q} o={o} />;
  }
  return <RsvpClient m={one('m')} u={one('u')} r={one('r') === 'no' ? 'no' : 'yes'} t={one('t')} />;
}
