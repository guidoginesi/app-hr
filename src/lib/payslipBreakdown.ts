import { getSupabaseServer } from '@/lib/supabaseServer';
import { parsearRecibo, type ReciboParseado } from '@/lib/payslipParser';
import type { PayslipSlot } from '@/lib/payrollPayslips';

/**
 * Lee los PDFs de una liquidación de relación de dependencia y guarda el
 * desglose en `payroll_payslips.parsed`, listo para que la ruta de A&F lo sirva
 * sin abrir un solo archivo.
 *
 * Este archivo es SOLO de servidor (baja del bucket con la service role key).
 * No importarlo desde un componente de cliente.
 */

/** Subir esto obliga a releer todos los recibos: el backfill usa la diferencia. */
export const PARSER_VERSION = 1;

export type MotivoDescarte = 'REPETIDO' | 'AJENO' | null;

export interface ReciboGuardado extends ReciboParseado {
  slot: PayslipSlot;
  descartado_por: MotivoDescarte;
  /** El PERÍODO del PDF no está donde se lo espera. No descarta por sí solo: ver `marcarDescartes`. */
  periodo_inesperado: boolean;
}

export interface DesgloseGuardado {
  parser_version: number;
  recibos: ReciboGuardado[];
  errores: string[];
}

export type EstadoParseo = 'OK' | 'PARCIAL' | 'ERROR';

// ─── Las dos reglas de descarte ────────────────────────────────────────────

/**
 * Cuánto se corre el `PERIODO` que imprime el recibo respecto del período
 * devengado. Está corrido un mes de forma sistemática y verificada: el recibo de
 * `2026-06` dice `05/2026`. Cualquier otra distancia es un archivo que no
 * corresponde a esta liquidación.
 */
const CORRIMIENTO_ESPERADO_MESES = 1;

function mesesEntre(periodoA: string, periodoB: string): number | null {
  const a = periodoA.match(/^(\d{4})-(\d{2})$/);
  const b = periodoB.match(/^(\d{4})-(\d{2})$/);
  if (!a || !b) return null;
  return (Number(a[1]) - Number(b[1])) * 12 + (Number(a[2]) - Number(b[2]));
}

/**
 * Marca lo que sobra. Hay dos formas distintas de sobrar y una sola regla no
 * alcanza para las dos:
 *
 *   REPETIDO — el mismo recibo dos veces. El `pdf2` casi siempre repite una
 *   página que el `pdf` ya trae; sumarlos contaría de más y ninguna validación
 *   de totales lo detectaría, porque cada recibo cierra perfecto por separado.
 *
 *   AJENO — un archivo que no es de esta liquidación.
 *
 * El corrimiento NO alcanza para decidir por sí solo, y descartar con él sería
 * peor que no hacer nada: las liquidaciones extraordinarias devengan en un
 * período y se pagan meses después. El bono anual de `2025-12` se pagó el
 * 20/03/2026 y su recibo dice `02/2026` — a dos meses del devengado, no a uno.
 * Descartarlo por la distancia tiraría plata real que está bien imputada.
 *
 * Por eso el corrimiento sólo descarta en el SEGUNDO archivo, que es el slot sin
 * semántica donde aparecieron los duplicados y hasta una factura de gas. Lo que
 * subió People como recibo principal se entrega siempre; si el período no es el
 * esperado, queda marcado para que alguien lo mire, no descartado.
 */
function marcarDescartes(recibos: ReciboGuardado[], periodKey: string): ReciboGuardado[] {
  const vistos = new Set<string>();
  // El `pdf` primero: verificado que es el que viene completo.
  const enOrden = [...recibos].sort(
    (a, b) => a.slot - b.slot || a.pagina - b.pagina,
  );

  for (const recibo of enOrden) {
    const distancia = recibo.periodo_pdf ? mesesEntre(periodKey, recibo.periodo_pdf) : null;
    recibo.periodo_inesperado = distancia !== null && distancia !== CORRIMIENTO_ESPERADO_MESES;

    if (recibo.slot === 2 && recibo.periodo_inesperado) {
      recibo.descartado_por = 'AJENO';
      continue;
    }
    // El período que viaja es siempre el devengado, así que dentro de una
    // liquidación la clave del repetido termina siendo el tipo de recibo.
    const clave = `${periodKey}|${recibo.tipo}`;
    if (vistos.has(clave)) {
      recibo.descartado_por = 'REPETIDO';
      continue;
    }
    vistos.add(clave);
    recibo.descartado_por = null;
  }
  return recibos;
}

// ─── Parseo de una liquidación ─────────────────────────────────────────────

interface FilaPayslip {
  settlement_id: string;
  pdf_storage_path: string | null;
  pdf2_storage_path: string | null;
}

/**
 * Baja, lee y guarda el desglose de una liquidación.
 *
 * Nunca tira: si el PDF no se puede leer, se guarda el error y la liquidación
 * sigue publicándose igual. Que A&F no pueda importar un recibo es un problema
 * menor que impedirle a People mandarlo.
 */
export async function parsearYGuardarDesglose(
  settlementId: string,
  periodKey: string,
  opciones: { guardar?: boolean } = {},
): Promise<{ estado: EstadoParseo; desglose: DesgloseGuardado }> {
  const guardarEnBase = opciones.guardar !== false;
  const supabase = getSupabaseServer();

  const { data: payslip } = await supabase
    .from('payroll_payslips')
    .select('settlement_id, pdf_storage_path, pdf2_storage_path')
    .eq('settlement_id', settlementId)
    .maybeSingle<FilaPayslip>();

  const desglose: DesgloseGuardado = { parser_version: PARSER_VERSION, recibos: [], errores: [] };

  if (!payslip) {
    desglose.errores.push('La liquidación no tiene ningún recibo cargado.');
    return await guardar(settlementId, desglose, 'ERROR', guardarEnBase);
  }

  const archivos: [PayslipSlot, string | null][] = [
    [1, payslip.pdf_storage_path],
    [2, payslip.pdf2_storage_path],
  ];

  for (const [slot, path] of archivos) {
    if (!path) continue;
    const { data: archivo, error } = await supabase.storage.from('payslips').download(path);
    if (error || !archivo) {
      desglose.errores.push(`Archivo ${slot}: no se pudo bajar (${error?.message ?? 'sin detalle'}).`);
      continue;
    }
    const { recibos, errores } = await parsearRecibo(new Uint8Array(await archivo.arrayBuffer()));
    for (const e of errores) desglose.errores.push(`Archivo ${slot}: ${e}`);
    for (const recibo of recibos) {
      desglose.recibos.push({ ...recibo, slot, descartado_por: null, periodo_inesperado: false });
    }
  }

  marcarDescartes(desglose.recibos, periodKey);
  return await guardar(settlementId, desglose, evaluarEstado(desglose), guardarEnBase);
}

function evaluarEstado(desglose: DesgloseGuardado): EstadoParseo {
  const vigentes = desglose.recibos.filter((r) => !r.descartado_por);
  if (vigentes.length === 0) return 'ERROR';
  if (vigentes.some((r) => r.advertencias.length > 0)) return 'PARCIAL';
  // Un archivo ilegible cuando ya hay un recibo bueno no invalida la liquidación,
  // pero tampoco es un parseo limpio.
  if (desglose.errores.length > 0) return 'PARCIAL';
  return 'OK';
}

async function guardar(
  settlementId: string,
  desglose: DesgloseGuardado,
  estado: EstadoParseo,
  guardarEnBase: boolean,
): Promise<{ estado: EstadoParseo; desglose: DesgloseGuardado }> {
  if (!guardarEnBase) return { estado, desglose };
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('payroll_payslips')
    .update({ parsed: desglose, parsed_at: new Date().toISOString(), parse_status: estado })
    .eq('settlement_id', settlementId);
  if (error) console.error(`[Payslip] no se pudo guardar el desglose de ${settlementId}:`, error.message);
  return { estado, desglose };
}

// ─── Forma para A&F ────────────────────────────────────────────────────────

export interface ConceptoApi {
  codigo: string;
  nombre: string;
  tipo: string;
  monto: number;
}

export interface ReciboApi {
  tipo: string;
  periodo: string;
  remunerativo_total: number;
  no_remunerativo_total: number;
  descuentos_total: number;
  contribuciones_total: number | null;
  sueldo_bruto: number;
  sueldo_neto: number;
  costo_total_empleador: number | null;
  conceptos: ConceptoApi[];
}

export interface RrddApi {
  fecha_ingreso: string | null;
  recibos: ReciboApi[];
}

/**
 * Arma el objeto `rrdd` del contrato. Devuelve sólo los recibos vigentes: lo
 * descartado no viaja, para que del otro lado no se pueda sumar por accidente.
 * La evidencia de qué se descartó y por qué queda en `payroll_payslips.parsed`.
 *
 * `periodo` es SIEMPRE el período devengado de la liquidación, no la etiqueta
 * del PDF: esa viene corrida un mes y no es confiable.
 */
export function construirRrdd(parsed: unknown, periodKey: string): RrddApi | null {
  const desglose = parsed as DesgloseGuardado | null;
  if (!desglose?.recibos?.length) return null;

  const vigentes = desglose.recibos.filter((r) => !r.descartado_por);
  if (vigentes.length === 0) return null;

  return {
    fecha_ingreso: vigentes.find((r) => r.fecha_ingreso)?.fecha_ingreso ?? null,
    recibos: vigentes.map((recibo) => ({
      tipo: recibo.tipo,
      periodo: periodKey,
      remunerativo_total: recibo.remunerativo_total,
      no_remunerativo_total: recibo.no_remunerativo_total,
      descuentos_total: recibo.descuentos_total,
      contribuciones_total: recibo.contribuciones_total,
      sueldo_bruto: recibo.sueldo_bruto,
      sueldo_neto: recibo.sueldo_neto,
      costo_total_empleador: recibo.costo_total_empleador,
      conceptos: recibo.conceptos.map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo === 'DESCUENTO' ? 'DESCUENTO' : c.tipo,
        monto: c.monto,
      })),
    })),
  };
}
