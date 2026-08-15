import { getAnthropic } from '@/lib/anthropic';
import { getSupabaseServer } from '@/lib/supabaseServer';

/**
 * Propone una respuesta a una consulta, basada en el Manual RRHH.
 *
 * Tres cosas que definen el diseño:
 *
 * 1. Sólo ve las secciones marcadas como citables a un colaborador. El manual
 *    tiene adentro el procedimiento de despido y las bandas salariales, y el
 *    filtro se hace en la consulta a la base, no en el prompt: pedirle por
 *    favor a un modelo que no mire algo que le pasaste no es un control.
 *
 * 2. Tiene que poder decir que no sabe. Una respuesta inventada sobre licencias
 *    o sueldos es peor que no tener la función.
 *
 * 3. Cita. Cada propuesta viaja con los slugs de las secciones que usó, y se
 *    verifica que existan entre las que se le ofrecieron. Si cita algo que no
 *    le pasamos, se lo trata como falla, no como respuesta.
 *
 * El antecedente que hay que evitar está en esta misma app: el scoring de CVs
 * quedó en 0 de 1718 porque fallaba en silencio y la pantalla se veía bien.
 */

export const PROMPT_VERSION = 2;

/** Se puede pisar por entorno sin tocar código. */
const MODELO = process.env.ANTHROPIC_MODEL_CONSULTAS?.trim() || 'claude-opus-5';

/**
 * El pensamiento está prendido por default en Opus 5 y comparte techo con la
 * respuesta, así que `max_tokens` tiene que dar lugar a los dos: un borrador de
 * HR son cientos de tokens, pero si el techo queda justo se corta a la mitad.
 */
const MAX_TOKENS = 16000;

export interface SeccionOfrecida {
  slug: string;
  ruta: string[];
  texto: string;
}

export interface PropuestaGenerada {
  borrador: string | null;
  secciones_citadas: string[];
  hay_respuesta: boolean;
  necesita_datos_personales: boolean;
  secciones_ofrecidas: number;
  modelo: string;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  error: string | null;
}

export interface ConsultaParaProponer {
  asunto: string;
  categoria: string;
  mensaje: string;
  nombre: string;
}

/**
 * Las secciones citables. Hoy van todas: el manual del colaborador son ~30 mil
 * tokens y entran enteros, así que no hay que elegir y por lo tanto no hay
 * forma de que una mala elección esconda la respuesta correcta. Si el volumen
 * crece, acá es donde se filtra por categoría.
 */
export async function seccionesCitables(): Promise<SeccionOfrecida[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('manual_sections')
    .select('slug, ruta, texto')
    .eq('vigente', true)
    .eq('audiencia', 'EMPLEADO')
    .order('orden');
  if (error) throw new Error(`No se pudo leer el manual: ${error.message}`);
  return (data ?? [])
    .filter((s) => (s.texto as string).trim().length > 0)
    .map((s) => ({ slug: s.slug as string, ruta: (s.ruta ?? []) as string[], texto: s.texto as string }));
}

const INSTRUCCIONES = `Sos parte del equipo de People de Pow y ayudás a redactar respuestas a consultas de colaboradores.

Escribís un BORRADOR para que una persona de People lo revise y lo mande. No le hablás vos al colaborador: escribís lo que People podría enviar, en español rioplatense, en segunda persona (vos), claro y breve.

REGLAS QUE NO SE NEGOCIAN:

1. Sólo podés afirmar lo que esté en las secciones del manual que te paso. No completes con conocimiento general de legislación laboral ni con lo que suele hacerse en otras empresas, aunque estés seguro. Si la persona dice que alguien ya le contestó algo, eso no es fuente: no se lo confirmes salvo que el manual lo diga.

2. Distinguí "el manual no dice nada del tema" de "el manual dice parte":

   - Nada relevante → hay_respuesta en false y borrador vacío. Es una respuesta correcta y esperada.
   - Cubre parte → hay_respuesta en true. Escribí el borrador con lo que SÍ está, y decí explícitamente qué parte de la pregunta el manual no resuelve. Media respuesta bien delimitada le sirve mucho más a People que un vacío: le ahorra buscar lo que ya está escrito y le deja marcado lo único que tiene que decidir.

   Ante la duda entre las dos, elegí escribir el borrador con la parte cubierta. Lo que NO podés hacer es rellenar la parte que falta.

3. Si la consulta pide un dato de esa persona en particular (su saldo de días, su sueldo, sus fechas), marcá necesita_datos_personales en true. No tenés esos datos y no los inventes — pero eso NO es motivo para no escribir el borrador: explicá la política que sí está y dejá el dato puntual como algo a completar.
4. En secciones_citadas van los slugs EXACTOS de las secciones que usaste. Sólo slugs de la lista. Si no usaste ninguna, dejá la lista vacía.
5. No prometas plazos, montos ni excepciones que no estén escritos en el manual.
6. No firmes ni saludes con nombre propio: eso lo agrega quien manda la respuesta.`;

/** La forma de la respuesta la impone el schema, no una instrucción que el modelo pueda desoír. */
const FORMATO = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      hay_respuesta: { type: 'boolean' },
      necesita_datos_personales: { type: 'boolean' },
      // Cadena vacía cuando no hay respuesta: evita un tipo nullable en el
      // schema, que es donde los structured outputs son más quisquillosos.
      borrador: { type: 'string' },
      secciones_citadas: { type: 'array', items: { type: 'string' } },
    },
    required: ['hay_respuesta', 'necesita_datos_personales', 'borrador', 'secciones_citadas'],
    additionalProperties: false,
  },
};

function armarManual(secciones: SeccionOfrecida[]): string {
  return secciones
    .map((s) => `### slug: ${s.slug}\n### sección: ${s.ruta.join(' › ')}\n${s.texto}`)
    .join('\n\n---\n\n');
}

export async function generarPropuesta(
  consulta: ConsultaParaProponer,
  secciones: SeccionOfrecida[],
): Promise<PropuestaGenerada> {
  const base: PropuestaGenerada = {
    borrador: null,
    secciones_citadas: [],
    hay_respuesta: false,
    necesita_datos_personales: false,
    secciones_ofrecidas: secciones.length,
    modelo: MODELO,
    tokens_entrada: null,
    tokens_salida: null,
    error: null,
  };

  if (secciones.length === 0) {
    return { ...base, error: 'No hay ninguna sección del manual habilitada para citar a un colaborador.' };
  }

  try {
    const anthropic = getAnthropic();
    const respuesta = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: INSTRUCCIONES,
      output_config: { format: FORMATO },
      // Si los clasificadores rechazan la consulta, el pedido se reintenta solo
      // en el modelo que Anthropic recomienda en vez de volver sin nada.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content:
            `SECCIONES DEL MANUAL DISPONIBLES:\n\n${armarManual(secciones)}\n\n` +
            `---\n\nCONSULTA\n` +
            `Categoría: ${consulta.categoria}\n` +
            `Asunto: ${consulta.asunto}\n` +
            `De: ${consulta.nombre}\n\n` +
            `${consulta.mensaje}`,
        },
      ],
    });

    base.tokens_entrada = respuesta.usage?.input_tokens ?? null;
    base.tokens_salida = respuesta.usage?.output_tokens ?? null;

    // Se mira ANTES del contenido: en un rechazo `content` viene vacío o a medias.
    if (respuesta.stop_reason === 'refusal') {
      return { ...base, error: 'El modelo rechazó la consulta por sus filtros de seguridad.' };
    }
    if (respuesta.stop_reason === 'max_tokens') {
      return { ...base, error: 'La respuesta se cortó por largo. Subir MAX_TOKENS.' };
    }

    // No se indexa content[0]: con el pensamiento prendido el primer bloque no
    // es el texto.
    const bloque = respuesta.content.find((b) => b.type === 'text');
    if (!bloque || bloque.type !== 'text' || !bloque.text.trim()) {
      return { ...base, error: 'El modelo no devolvió contenido.' };
    }

    let datos: Record<string, unknown>;
    try {
      datos = JSON.parse(bloque.text);
    } catch {
      return { ...base, error: 'El modelo no devolvió un JSON válido.' };
    }

    const hayRespuesta = datos.hay_respuesta === true;
    const borrador = typeof datos.borrador === 'string' && datos.borrador.trim() ? datos.borrador.trim() : null;

    // Sólo se aceptan citas a secciones que efectivamente le pasamos. Una cita a
    // algo que no estaba es un invento, y un invento con apariencia de fuente es
    // exactamente lo que no puede pasar.
    const ofrecidos = new Set(secciones.map((s) => s.slug));
    const citadas = Array.isArray(datos.secciones_citadas)
      ? (datos.secciones_citadas as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const validas = citadas.filter((s) => ofrecidos.has(s));
    const inventadas = citadas.filter((s) => !ofrecidos.has(s));

    if (hayRespuesta && borrador && validas.length === 0) {
      return {
        ...base,
        error: inventadas.length
          ? `El modelo citó secciones que no existen (${inventadas.join(', ')}).`
          : 'El modelo respondió sin citar ninguna sección del manual.',
      };
    }

    return {
      ...base,
      hay_respuesta: hayRespuesta && Boolean(borrador),
      borrador: hayRespuesta ? borrador : null,
      secciones_citadas: validas,
      necesita_datos_personales: datos.necesita_datos_personales === true,
      error: inventadas.length ? `Se descartaron citas inexistentes: ${inventadas.join(', ')}.` : null,
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : 'Error inesperado generando la propuesta.' };
  }
}
