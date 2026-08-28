import { getSupabaseServer } from '@/lib/supabaseServer';
import { generarPropuesta, seccionesCitables, datosDelColaborador, PROMPT_VERSION } from '@/lib/manual/propuesta';
import { faqsVigentes } from '@/lib/manual/faq';

/**
 * Genera y guarda la propuesta de respuesta de una consulta.
 *
 * Vive acá y no dentro de la ruta porque la dispara más de un lado: el alta de
 * la consulta —para que el borrador ya esté cuando People la abre— y el botón
 * de "Proponer de nuevo". Si estuviera duplicada, el prompt y lo que se guarda
 * se irían separando entre los dos caminos.
 *
 * La propuesta NUNCA se manda sola: queda como borrador para que People la edite
 * y la envíe.
 */
export async function generarPropuestaDeConsulta(
  inquiryId: string,
  opts: { generadoPor?: string | null } = {},
): Promise<{ ok: boolean; motivo?: string }> {
  const supabase = getSupabaseServer();

  const { data: consulta } = await supabase
    .from('inquiries_with_details')
    .select('id, subject, category, employee_name, employee_id')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!consulta) return { ok: false, motivo: 'Consulta no encontrada' };

  // El primer mensaje del colaborador es la consulta; el resto es la
  // conversación. Se manda todo lo que escribió, sin las notas internas.
  const { data: mensajes } = await supabase
    .from('inquiry_messages')
    .select('body, author_role, created_at')
    .eq('inquiry_id', inquiryId)
    .eq('is_internal', false)
    .order('created_at');

  const delColaborador = (mensajes ?? []).filter((m) => m.author_role === 'employee');
  if (delColaborador.length === 0) {
    return { ok: false, motivo: 'La consulta no tiene ningún mensaje del colaborador.' };
  }

  // Los datos de la persona son opcionales: si fallan, la propuesta sale igual
  // pero sin fechas concretas. No vale la pena perderla entera por un saldo.
  const [secciones, faqs, datos] = await Promise.all([
    seccionesCitables(),
    faqsVigentes(),
    datosDelColaborador(consulta.employee_id as string).catch((e) => {
      console.error('[propuesta] no se pudieron leer los datos del colaborador:', e);
      return '';
    }),
  ]);

  const generada = await generarPropuesta(
    {
      asunto: consulta.subject as string,
      categoria: consulta.category as string,
      nombre: consulta.employee_name as string,
      mensaje: delColaborador.map((m) => m.body as string).join('\n\n'),
      datos,
    },
    secciones,
    faqs,
  );

  // Se guarda siempre, también cuando falló: un agente que falla en silencio es
  // peor que no tenerlo.
  const { error } = await supabase.from('inquiry_answer_drafts').insert({
    inquiry_id: inquiryId,
    borrador: generada.borrador,
    nota_para_hr: generada.nota_para_hr,
    secciones_citadas: generada.secciones_citadas,
    hay_respuesta: generada.hay_respuesta,
    necesita_datos_personales: generada.necesita_datos_personales,
    modelo: generada.modelo,
    prompt_version: PROMPT_VERSION,
    secciones_ofrecidas: generada.secciones_ofrecidas,
    tokens_entrada: generada.tokens_entrada,
    tokens_salida: generada.tokens_salida,
    error: generada.error,
    generado_por: opts.generadoPor ?? null,
  });
  if (error) {
    console.error('[propuesta] no se pudo guardar:', error.message);
    return { ok: false, motivo: 'No se pudo guardar la propuesta' };
  }

  return { ok: true };
}

/**
 * ¿Ya tiene una propuesta? Sirve para no generar dos veces la misma: el alta la
 * dispara sola, y si alguien abre la consulta mientras tanto no hace falta otra.
 */
export async function yaTienePropuesta(inquiryId: string): Promise<boolean> {
  const { count } = await getSupabaseServer()
    .from('inquiry_answer_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId);
  return (count ?? 0) > 0;
}
