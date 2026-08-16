import { getAnthropic } from '@/lib/anthropic';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * Las FAQ: lo que People sabe y el manual no dice.
 *
 * Cuando el agente no encuentra algo en el manual y HR contesta igual, esa
 * respuesta es conocimiento real de la empresa que no está escrito en ningún
 * lado. Capturarla es lo único que hace que el sistema mejore de una consulta
 * a la siguiente.
 *
 * "Aprende", pero con un humano en el medio: una FAQ nace en BORRADOR y no se
 * cita hasta que alguien la aprueba. Una FAQ mal cargada le contesta mal a
 * mucha gente — es exactamente el tipo de error que no queremos automatizar.
 *
 * Y el destino de una FAQ es dejar de ser FAQ: `pendiente_de_manual` marca las
 * que todavía no se subieron al Doc, donde las puede leer cualquiera y no sólo
 * el agente.
 */

const MODELO = process.env.ANTHROPIC_MODEL_CONSULTAS?.trim() || 'claude-opus-5';

export interface FaqVigente {
  id: string;
  pregunta: string;
  respuesta: string;
  categoria: string | null;
}

/** Las FAQ aprobadas, que son las únicas que el agente puede citar. */
export async function faqsVigentes(): Promise<FaqVigente[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('manual_faqs')
    .select('id, pregunta, respuesta, categoria')
    .eq('estado', 'APROBADA')
    .order('creado_at');
  if (error) {
    // No frena la propuesta: sin FAQ el agente sigue contestando con el manual.
    console.error('[faq] no se pudieron leer:', error.message);
    return [];
  }
  return (data ?? []) as FaqVigente[];
}

/** El slug con el que el agente cita una FAQ, para no confundirla con el manual. */
export function slugFaq(id: string): string {
  return `faq:${id}`;
}

const INSTRUCCIONES = `Sos parte del equipo de People de Pow.

Te paso una consulta de un colaborador y la respuesta que People terminó mandando. Tu trabajo es convertir ese intercambio en una entrada de preguntas frecuentes, para que la próxima vez que alguien pregunte lo mismo la respuesta ya esté.

REGLAS:

1. La pregunta se escribe en GENERAL, no sobre esta persona. "¿Qué pasa si mis vacaciones arrancan un feriado?" y no "¿Antonella vuelve el 25 o el 26?".

2. La respuesta también va en general: sacá nombres, fechas puntuales, saldos y cualquier dato de esa persona. Lo que queda tiene que servirle a cualquiera.

3. Sólo podés afirmar lo que People afirmó en su respuesta. No agregues condiciones, excepciones ni fundamentos legales que no estén ahí, aunque los sepas.

4. Si la respuesta de People fue puramente circunstancial —un dato de esa persona, un "ya lo miro", una coordinación— entonces NO hay FAQ acá. Poné sirve en false y explicá en una línea por qué.

5. Escribí en español rioplatense, claro y corto. La respuesta en dos o tres frases como máximo.

Respondé con: {"sirve": boolean, "pregunta": string, "respuesta": string, "motivo": string}`;

export interface FaqPropuesta {
  sirve: boolean;
  pregunta: string;
  respuesta: string;
  motivo: string;
  error: string | null;
}

/**
 * Convierte una consulta ya respondida en una FAQ candidata.
 *
 * Se hace con el modelo y no a mano porque escribir la versión general de una
 * respuesta puntual es trabajo, y si es trabajo nadie lo hace. Igual queda en
 * BORRADOR: esto propone, no aprueba.
 */
export async function proponerFaq(
  consulta: string,
  respuestaDeHr: string,
): Promise<FaqPropuesta> {
  const vacia: FaqPropuesta = { sirve: false, pregunta: '', respuesta: '', motivo: '', error: null };
  try {
    const anthropic = getAnthropic();
    const r = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: INSTRUCCIONES,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              sirve: { type: 'boolean' },
              pregunta: { type: 'string' },
              respuesta: { type: 'string' },
              motivo: { type: 'string' },
            },
            required: ['sirve', 'pregunta', 'respuesta', 'motivo'],
            additionalProperties: false,
          },
        },
      },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content: `CONSULTA DEL COLABORADOR\n\n${consulta}\n\n---\n\nRESPUESTA QUE MANDÓ PEOPLE\n\n${respuestaDeHr}`,
        },
      ],
    });

    if (r.stop_reason === 'refusal') return { ...vacia, error: 'El modelo rechazó la consulta.' };
    const bloque = r.content.find((b) => b.type === 'text');
    if (!bloque || bloque.type !== 'text') return { ...vacia, error: 'El modelo no devolvió contenido.' };

    const datos = JSON.parse(bloque.text) as Record<string, unknown>;
    return {
      sirve: datos.sirve === true,
      pregunta: String(datos.pregunta ?? '').trim(),
      respuesta: String(datos.respuesta ?? '').trim(),
      motivo: String(datos.motivo ?? '').trim(),
      error: null,
    };
  } catch (error) {
    return { ...vacia, error: error instanceof Error ? error.message : 'Error inesperado.' };
  }
}
