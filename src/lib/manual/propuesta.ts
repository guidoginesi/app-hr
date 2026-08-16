import { getAnthropic } from '@/lib/anthropic';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { slugFaq, type FaqVigente } from '@/lib/manual/faq';

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

export const PROMPT_VERSION = 5;

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
  nota_para_hr: string | null;
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
  /** Lo que la app sabe de esa persona. Vacío si no se pudo leer. */
  datos: string;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** El modelo no calcula días de la semana: se los damos ya resueltos. */
function fecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${DIAS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Lo que la app sabe de quien consulta: licencias cargadas y saldos.
 *
 * Es un recorte a propósito. Va lo que hace falta para contestar sobre
 * licencias —que es de lo que se pregunta— y NO va nada de compensación: el
 * sueldo es el dato más sensible del sistema y no tiene por qué salir de la app
 * para redactar un borrador.
 */
export async function datosDelColaborador(employeeId: string): Promise<string> {
  const supabase = getSupabaseServer();
  const partes: string[] = [];

  const { data: persona } = await supabase
    .from('employees')
    .select('hire_date, job_title')
    .eq('id', employeeId)
    .maybeSingle();
  if (persona?.hire_date) {
    const anios = Math.floor((Date.now() - new Date(persona.hire_date as string).getTime()) / 31557600000);
    partes.push(`Ingreso: ${fecha(persona.hire_date as string)} (antigüedad: ${anios} ${anios === 1 ? 'año' : 'años'})`);
  }

  const { data: licencias } = await supabase
    .from('leave_requests_with_details')
    .select('leave_type_name, start_date, end_date, days_requested, status')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })
    .limit(8);
  if (licencias?.length) {
    partes.push(
      'Licencias cargadas en el Portal (de la más reciente):\n' +
        licencias
          .map(
            (l) =>
              `- ${l.leave_type_name}: del ${fecha(l.start_date as string)} al ${fecha(l.end_date as string)}` +
              ` · ${l.days_requested} días · ${l.status}`,
          )
          .join('\n'),
    );
  }

  const anio = new Date().getFullYear();
  const { data: saldos } = await supabase
    .from('leave_balances_with_details')
    .select('leave_type_name, available_days, used_days, pending_days')
    .eq('employee_id', employeeId)
    .eq('year', anio);
  if (saldos?.length) {
    partes.push(
      `Saldos ${anio}:\n` +
        saldos
          .map((b) => `- ${b.leave_type_name}: ${b.available_days} disponibles, ${b.used_days} usados, ${b.pending_days} pendientes`)
          .join('\n'),
    );
  }

  return partes.join('\n\n');
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

Producís DOS cosas distintas, con lectores distintos. No las mezcles.

═══ 1. borrador — el mensaje que va a leer el colaborador ═══

Es lo que People le manda tal cual, en español rioplatense, en segunda persona (vos), claro y breve.

Escribilo como le escribe una persona de People a un compañero: **respuesta directa a lo que preguntó**. Nada de "según el manual", "la política establece", "lo que el manual no resuelve", ni ninguna otra referencia a de dónde sacaste la información. Esa trazabilidad va en la nota para People, no acá — al colaborador no le sirve y lo hace sonar a formulario.

Si hay una parte que no podés afirmar, el borrador **no explica por qué**: simplemente no la afirma. Decí lo que sí sabés y, si hace falta, que eso puntual se lo confirman a la brevedad. Es lo que diría cualquiera por escrito, sin exhibir el trámite interno.

Si falta un dato de esa persona (fechas, saldo, montos), dejá un hueco visible entre corchetes para que lo complete quien mande el mensaje.

No firmes: la firma la pone quien envía.

═══ 2. nota_para_hr — para quien revisa antes de mandar ═══

Dos o tres frases, telegráficas, escritas para adentro. Acá SÍ hablás del manual. Tiene que responder:

- Qué parte de la consulta queda respaldada por el manual.
- Qué parte NO está escrita y por lo tanto hay que decidir o chequear antes de mandar.
- Qué dato hay que completar, si falta alguno.

Si el manual cubre todo y no hay nada que decidir, poné exactamente: "Cubierto por el manual, no hay nada pendiente."

═══ REGLAS QUE NO SE NEGOCIAN ═══

0. Tenés DOS fuentes con la misma autoridad: las secciones del manual y las FAQ. Las FAQ son respuestas que People ya dio y confirmó para casos que el manual no cubre; usalas como usarías el manual. Si las dos hablan del mismo tema y se contradicen, ganá por el manual y avisá de la contradicción en nota_para_hr.

1. Sólo podés afirmar lo que esté en las secciones del manual o en las FAQ que te paso. No completes con conocimiento general de legislación laboral ni con lo que suele hacerse en otras empresas, aunque estés seguro. Si la persona dice que alguien ya le contestó algo, eso no es fuente: no se lo confirmes salvo que el manual lo diga.

2. Distinguí "el manual no dice nada del tema" de "el manual dice parte":

   - Nada relevante → hay_respuesta en false, borrador vacío, y explicá en nota_para_hr que el tema no está en el manual.
   - Cubre parte → hay_respuesta en true. Redactá el mensaje con lo que sí podés afirmar, y dejá lo que falta marcado en nota_para_hr.

   Ante la duda, escribí el borrador con la parte cubierta. Lo que NO podés hacer es rellenar la parte que falta.

3. Si la consulta pide un dato de esa persona en particular, marcá necesita_datos_personales en true. No lo inventes, pero eso NO es motivo para no escribir el borrador.

4. En secciones_citadas van los slugs EXACTOS de las secciones que usaste. Sólo slugs de la lista.

5. No prometas plazos, montos ni excepciones que no estén escritos en el manual.

6. Sobre los DATOS DE LA PERSONA, si vienen:

   - Son lo que está cargado en la app. Usalos para ser concreto —fechas, días, saldos— en vez de dejar huecos. Si tenés la fecha, escribila; no pongas [completar].
   - Dos fuentes distintas: el manual dice la POLÍTICA, los datos dicen EL CASO. No uses uno para afirmar lo del otro.
   - Los días de la semana ya vienen resueltos. No los calcules vos, no cuentes días hábiles ni feriados, y no infieras fechas que no estén ahí.
   - **Si lo que cuenta la persona no coincide con los datos, no se lo discutas en el borrador.** Escribí el borrador con lo que dicen los datos y avisá de la diferencia en nota_para_hr, para que People lo verifique antes de mandar.`;

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
      // Para quien revisa, no para el colaborador: qué está respaldado, qué
      // hay que decidir y qué dato falta.
      nota_para_hr: { type: 'string' },
      secciones_citadas: { type: 'array', items: { type: 'string' } },
    },
    required: ['hay_respuesta', 'necesita_datos_personales', 'borrador', 'nota_para_hr', 'secciones_citadas'],
    additionalProperties: false,
  },
};

function armarFaqs(faqs: FaqVigente[]): string {
  return faqs
    .map((f) => `### slug: ${slugFaq(f.id)}\n### pregunta: ${f.pregunta}\n${f.respuesta}`)
    .join('\n\n---\n\n');
}

function armarManual(secciones: SeccionOfrecida[]): string {
  return secciones
    .map((s) => `### slug: ${s.slug}\n### sección: ${s.ruta.join(' › ')}\n${s.texto}`)
    .join('\n\n---\n\n');
}

export async function generarPropuesta(
  consulta: ConsultaParaProponer,
  secciones: SeccionOfrecida[],
  faqs: FaqVigente[] = [],
): Promise<PropuestaGenerada> {
  const base: PropuestaGenerada = {
    borrador: null,
    nota_para_hr: null,
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
            (faqs.length
              ? `---\n\nFAQ — RESPUESTAS QUE PEOPLE YA CONFIRMÓ (misma autoridad que el manual)\n\n${armarFaqs(faqs)}\n\n`
              : '') +
            (consulta.datos ? `---\n\nDATOS DE LA PERSONA (de la app, no del manual)\n\n${consulta.datos}\n\n` : '') +
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
    const ofrecidos = new Set([...secciones.map((s) => s.slug), ...faqs.map((f) => slugFaq(f.id))]);
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
      nota_para_hr: typeof datos.nota_para_hr === 'string' && datos.nota_para_hr.trim() ? datos.nota_para_hr.trim() : null,
      borrador: hayRespuesta ? borrador : null,
      secciones_citadas: validas,
      necesita_datos_personales: datos.necesita_datos_personales === true,
      error: inventadas.length ? `Se descartaron citas inexistentes: ${inventadas.join(', ')}.` : null,
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : 'Error inesperado generando la propuesta.' };
  }
}
