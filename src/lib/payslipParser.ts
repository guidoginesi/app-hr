import { getDocumentProxy } from 'unpdf';

/**
 * Lector de los recibos de sueldo de relación de dependencia.
 *
 * Los importes de relación de dependencia no están en ninguna tabla: viven
 * adentro del PDF que sube People. Esto los saca de ahí para que A&F pueda
 * importarlos (contrato `contrato-rrhh-recibos-rrdd.md`).
 *
 * Lo que hace defendible al parseo no es el parser sino las tres identidades:
 * si se come una línea, la aritmética no cierra, el recibo queda marcado y
 * nadie importa un número mal. Ver `verificarIdentidades`.
 *
 * El estudio cambió el formato del recibo dos veces en 2026, así que hay tres
 * plantillas vivas y conviven en la base:
 *
 *   A  (2026-06 en adelante)  bloques por sección, con contribuciones
 *   B  (hasta 2026-04)        columnas, SIN contribuciones patronales
 *   C  (2026-05)              columnas, con contribuciones
 *
 * La plantilla B no trae las contribuciones patronales en ninguna parte: no es
 * que el parser no las encuentre, es que el documento no las tiene. Para esos
 * recibos `contribuciones_total` y `costo_total_empleador` viajan en null.
 */

export type PlantillaRecibo = 'A' | 'B' | 'C';
export type ConceptoTipo = 'REMUNERATIVO' | 'NO_REMUNERATIVO' | 'DESCUENTO' | 'CONTRIBUCION';
export type ReciboTipo = 'MENSUAL' | 'SAC' | 'FINAL';

export interface ConceptoRecibo {
  codigo: string;
  nombre: string;
  tipo: ConceptoTipo;
  monto: number;
}

export interface ReciboParseado {
  tipo: ReciboTipo;
  /** El período que dice el PDF, en YYYY-MM. Viene corrido un mes; no usarlo como período del recibo. */
  periodo_pdf: string | null;
  fecha_ingreso: string | null;
  remunerativo_total: number;
  no_remunerativo_total: number;
  descuentos_total: number;
  /** null cuando el documento no las trae (plantilla B). */
  contribuciones_total: number | null;
  sueldo_bruto: number;
  sueldo_neto: number;
  /** null cuando el documento no trae contribuciones (plantilla B). */
  costo_total_empleador: number | null;
  conceptos: ConceptoRecibo[];
  plantilla: PlantillaRecibo;
  pagina: number;
  /** Diferencias contra los totales impresos. Vacío = las identidades cerraron. */
  advertencias: string[];
}

export interface ResultadoParseo {
  recibos: ReciboParseado[];
  errores: string[];
}

// ─── Grilla ────────────────────────────────────────────────────────────────
// pdf.js entrega fragmentos sueltos con su posición. Los agrupamos en filas por
// `y` y los ordenamos por `x`: así el documento vuelve a ser una tabla y se
// puede decir a qué columna pertenece cada importe.

interface Celda {
  x: number;
  ancho: number;
  texto: string;
}
interface Fila {
  y: number;
  celdas: Celda[];
}

const TOLERANCIA_FILA = 3;

function agruparEnFilas(items: { str: string; transform: number[]; width: number }[]): Fila[] {
  const filas: Fila[] = [];
  for (const item of items) {
    const texto = item.str.trim();
    if (!texto) continue;
    const y = item.transform[5];
    let fila = filas.find((f) => Math.abs(f.y - y) < TOLERANCIA_FILA);
    if (!fila) {
      fila = { y, celdas: [] };
      filas.push(fila);
    }
    fila.celdas.push({ x: item.transform[4], ancho: item.width, texto });
  }
  for (const fila of filas) fila.celdas.sort((a, b) => a.x - b.x);
  // De arriba hacia abajo, que es como se lee el recibo.
  return filas.sort((a, b) => b.y - a.y);
}

// ─── Piezas sueltas ────────────────────────────────────────────────────────

const IMPORTE = /^\$?\s*(-?\d{1,3}(?:\.\d{3})*|-?\d+),(\d{2})$/;
const CODIGO = /^\d{4}$/;

function esImporte(texto: string): boolean {
  return IMPORTE.test(texto);
}

function aNumero(texto: string): number {
  const m = texto.match(IMPORTE);
  if (!m) return NaN;
  return Number(`${m[1].replace(/\./g, '')}.${m[2]}`);
}

/** El importe está alineado a la derecha: lo que define su columna es dónde TERMINA. */
function bordeDerecho(celda: Celda): number {
  return celda.x + celda.ancho;
}

function textoDe(fila: Fila): string {
  return fila.celdas.map((c) => c.texto).join(' ');
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Detección de plantilla ────────────────────────────────────────────────

function detectarPlantilla(filas: Fila[]): PlantillaRecibo | null {
  const texto = filas.map(textoDe).join('\n');
  if (texto.includes('COSTO TOTAL EMPLEADOR')) return 'A';
  if (/REMUN\.\s?SUJ\. A RET/.test(texto)) return 'B';
  if (texto.includes('CÓDIGO') && texto.includes('CONTRIBUCIONES')) return 'C';
  return null;
}

// ─── Encabezado ────────────────────────────────────────────────────────────

/** El `PERIODO` del PDF viene como MM/YYYY. Las fechas del recibo son DD/MM/YYYY, así que no se pisan. */
function buscarPeriodoPdf(filas: Fila[]): string | null {
  for (const fila of filas) {
    for (const celda of fila.celdas) {
      const m = celda.texto.match(/^(\d{2})\/(\d{4})$/);
      if (m) return `${m[2]}-${m[1]}`;
    }
  }
  return null;
}

function buscarFechaIngreso(filas: Fila[]): string | null {
  for (let i = 0; i < filas.length; i++) {
    if (!/FECHA DE INGRESO|FECHA INGRESO/i.test(textoDe(filas[i]))) continue;
    // La etiqueta y el valor pueden estar en la misma fila o en la de al lado.
    for (const fila of [filas[i], filas[i + 1], filas[i - 1]].filter(Boolean)) {
      for (const celda of fila.celdas) {
        const m = celda.texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          const dd = m[1].padStart(2, '0');
          const mm = m[2].padStart(2, '0');
          return `${m[3]}-${mm}-${dd}`;
        }
      }
    }
  }
  return null;
}

/**
 * El tipo sale de los conceptos que trae el recibo, no del nombre del archivo.
 * Un recibo que liquida el sueldo del mes es MENSUAL aunque además pague el SAC.
 */
function deducirTipo(conceptos: ConceptoRecibo[], filas: Fila[]): ReciboTipo {
  const texto = filas.map(textoDe).join(' ').toUpperCase();
  if (/LIQUIDACI[OÓ]N FINAL|EGRESO/.test(texto)) return 'FINAL';
  const codigos = new Set(conceptos.map((c) => c.codigo));
  const tieneSueldo = [...codigos].some((c) => c.startsWith('201'));
  if (tieneSueldo) return 'MENSUAL';
  const tieneSac = [...codigos].some((c) => c.startsWith('25'));
  if (tieneSac) return 'SAC';
  return 'MENSUAL';
}

// ─── Plantillas columnares (B y C) ─────────────────────────────────────────

interface Columna {
  desde: number;
  tipo: ConceptoTipo;
}

/**
 * Arma las columnas de importes a partir de la fila de encabezado. Cada columna
 * va desde donde arranca su título hasta donde arranca el siguiente, y un
 * importe cae en la columna que contiene su borde derecho.
 */
function columnasDeEncabezado(fila: Fila): { columnas: Columna[]; finNombre: number } | null {
  const mapa: [RegExp, ConceptoTipo][] = [
    [/^REMUNERATIVO$|^REMUN\.\s?SUJ\. A RET\.?$/i, 'REMUNERATIVO'],
    [/^NO REMUNERATIVO$|^REMUN\.\s?EXENTAS$/i, 'NO_REMUNERATIVO'],
    [/^DESCUENTOS$/i, 'DESCUENTO'],
    [/^CONTRIBUCIONES$/i, 'CONTRIBUCION'],
  ];
  const columnas: Columna[] = [];
  let finNombre = Infinity;
  for (const celda of fila.celdas) {
    if (/^(CANTIDAD|uds\.?)$/i.test(celda.texto)) {
      finNombre = Math.min(finNombre, celda.x);
      continue;
    }
    for (const [patron, tipo] of mapa) {
      if (patron.test(celda.texto) && !columnas.some((c) => c.tipo === tipo)) {
        columnas.push({ desde: celda.x, tipo });
        finNombre = Math.min(finNombre, celda.x);
      }
    }
  }
  if (columnas.length < 3) return null;
  columnas.sort((a, b) => a.desde - b.desde);
  return { columnas, finNombre };
}

function tipoPorColumna(columnas: Columna[], borde: number): ConceptoTipo | null {
  let elegida: ConceptoTipo | null = null;
  for (const col of columnas) {
    if (borde >= col.desde) elegida = col.tipo;
  }
  // Un importe que termina antes de la primera columna no pertenece a ninguna.
  return elegida;
}

function parsearColumnar(filas: Fila[], plantilla: PlantillaRecibo, pagina: number): ReciboParseado | null {
  const iEncabezado = filas.findIndex((f) => columnasDeEncabezado(f) !== null);
  if (iEncabezado === -1) return null;
  const encabezado = columnasDeEncabezado(filas[iEncabezado])!;

  // La plantilla B imprime el recibo dos veces sobre la misma página (original y
  // duplicado, uno al lado del otro). Nos quedamos con el de la izquierda: el de
  // la derecha es el mismo recibo y sumarlo contaría todo dos veces.
  const titulosConcepto = filas[iEncabezado].celdas.filter((c) => /^CONCEPTO$/i.test(c.texto));
  const corte = titulosConcepto.length > 1 ? titulosConcepto[1].x : Infinity;

  const conceptos: ConceptoRecibo[] = [];
  for (const fila of filas.slice(iEncabezado + 1)) {
    const celdas = fila.celdas.filter((c) => c.x < corte);
    const iCodigo = celdas.findIndex((c) => CODIGO.test(c.texto));
    if (iCodigo === -1) continue;
    const importes = celdas.filter((c) => esImporte(c.texto));
    if (importes.length === 0) continue;
    const nombre = celdas
      .slice(iCodigo + 1)
      .filter((c) => c.x < encabezado.finNombre && !esImporte(c.texto))
      .map((c) => c.texto)
      .join(' ')
      .trim();
    for (const importe of importes) {
      const tipo = tipoPorColumna(encabezado.columnas, bordeDerecho(importe));
      if (!tipo) continue;
      conceptos.push({
        codigo: celdas[iCodigo].texto,
        nombre,
        tipo,
        monto: aNumero(importe.texto),
      });
    }
  }
  if (conceptos.length === 0) return null;

  const tieneColumnaContribuciones = encabezado.columnas.some((c) => c.tipo === 'CONTRIBUCION');
  return armarRecibo(conceptos, filas, plantilla, pagina, tieneColumnaContribuciones);
}

// ─── Plantilla A (por secciones) ───────────────────────────────────────────

/**
 * La plantilla A no tiene una columna por tipo: tiene una sola columna MONTO y
 * el tipo lo da la sección en la que cae la fila. Las contribuciones van en su
 * propio bloque, arriba, cerrado por "SUB TOTAL CONTRIBUCIONES EMPLEADOR".
 */
function parsearPorSecciones(filas: Fila[], pagina: number): ReciboParseado | null {
  const conceptos: ConceptoRecibo[] = [];
  let seccion: ConceptoTipo | null = null;
  let enContribuciones = false;

  for (const fila of filas) {
    const texto = textoDe(fila).trim();

    if (/^CONCEPTO\b/.test(texto) && /MONTO/.test(texto)) {
      // Cada bloque arranca con su propio encabezado. El primero de la página es
      // el de contribuciones; el segundo abre las secciones de haberes.
      enContribuciones = !enContribuciones && conceptos.length === 0;
      seccion = enContribuciones ? 'CONTRIBUCION' : null;
      continue;
    }
    if (/^SUB TOTAL CONTRIBUCIONES/.test(texto)) {
      enContribuciones = false;
      seccion = null;
      continue;
    }
    if (texto === 'REMUNERATIVO') { seccion = 'REMUNERATIVO'; continue; }
    if (texto === 'NO REMUNERATIVO') { seccion = 'NO_REMUNERATIVO'; continue; }
    if (texto === 'DESCUENTOS') { seccion = 'DESCUENTO'; continue; }
    if (/^(OBSERVACIONES|IMPORTE EN LETRAS|COMPOSICIÓN SALARIAL)/.test(texto)) { seccion = null; continue; }

    if (!seccion) continue;
    const iCodigo = fila.celdas.findIndex((c) => CODIGO.test(c.texto));
    if (iCodigo === -1) continue;
    const importes = fila.celdas.filter((c) => esImporte(c.texto));
    // Cuando hay UNIDAD y BASE, el importe del concepto es el último de la fila.
    if (importes.length === 0) continue;
    const nombre = fila.celdas
      .slice(iCodigo + 1)
      .filter((c) => !esImporte(c.texto) && !/^\d+$/.test(c.texto))
      .map((c) => c.texto)
      .join(' ')
      .trim();
    conceptos.push({
      codigo: fila.celdas[iCodigo].texto,
      nombre,
      tipo: seccion,
      monto: aNumero(importes[importes.length - 1].texto),
    });
  }

  if (conceptos.length === 0) return null;
  return armarRecibo(conceptos, filas, 'A', pagina, true);
}

// ─── Totales e identidades ─────────────────────────────────────────────────

/** Los totales que el recibo imprime, para contrastarlos con los que sumamos. */
function totalesImpresos(filas: Fila[]): Partial<Record<string, number>> {
  const impresos: Record<string, number> = {};
  const etiquetas: [RegExp, string][] = [
    [/^SUELDO NETO$|^TOTAL NETO$/i, 'neto'],
    [/^COSTO TOTAL EMPLEADOR$/i, 'costo'],
    [/^SUB TOTAL CONTRIBUCIONES EMPLEADOR$/i, 'contribuciones'],
    [/^SUELDO BRUTO$/i, 'bruto'],
  ];
  for (const fila of filas) {
    // La fila de "COMPOSICIÓN SALARIAL" trae los tres totales juntos.
    for (const celda of fila.celdas) {
      const m = celda.texto.match(/^(No Remunerativo|Remunerativo|Descuentos):\s*\$?\s*([\d.]+,\d{2})$/i);
      if (m) {
        const clave = m[1].toLowerCase() === 'no remunerativo'
          ? 'no_remunerativo'
          : m[1].toLowerCase() === 'remunerativo' ? 'remunerativo' : 'descuentos';
        impresos[clave] = aNumero(m[2]);
      }
    }
    for (const [patron, clave] of etiquetas) {
      const celda = fila.celdas.find((c) => patron.test(c.texto));
      if (!celda || impresos[clave] !== undefined) continue;
      const valor = fila.celdas.find((c) => c.x > celda.x && esImporte(c.texto));
      if (valor) impresos[clave] = aNumero(valor.texto);
    }
  }
  return impresos;
}

function armarRecibo(
  conceptos: ConceptoRecibo[],
  filas: Fila[],
  plantilla: PlantillaRecibo,
  pagina: number,
  tieneContribuciones: boolean,
): ReciboParseado {
  const sumar = (tipo: ConceptoTipo) =>
    redondear(conceptos.filter((c) => c.tipo === tipo).reduce((a, c) => a + c.monto, 0));

  const remunerativo = sumar('REMUNERATIVO');
  const noRemunerativo = sumar('NO_REMUNERATIVO');
  const descuentos = sumar('DESCUENTO');
  const contribuciones = tieneContribuciones ? sumar('CONTRIBUCION') : null;

  const bruto = redondear(remunerativo + noRemunerativo);
  const neto = redondear(bruto - descuentos);
  const costo = contribuciones === null ? null : redondear(bruto + contribuciones);

  const recibo: ReciboParseado = {
    tipo: 'MENSUAL',
    periodo_pdf: buscarPeriodoPdf(filas),
    fecha_ingreso: buscarFechaIngreso(filas),
    remunerativo_total: remunerativo,
    no_remunerativo_total: noRemunerativo,
    descuentos_total: descuentos,
    contribuciones_total: contribuciones,
    sueldo_bruto: bruto,
    sueldo_neto: neto,
    costo_total_empleador: costo,
    conceptos,
    plantilla,
    pagina,
    advertencias: [],
  };
  recibo.tipo = deducirTipo(conceptos, filas);
  recibo.advertencias = verificarIdentidades(recibo, totalesImpresos(filas));
  return recibo;
}

/**
 * Las tres identidades, contra lo que el propio recibo imprime.
 *
 *   remunerativo + no remunerativo = bruto
 *   bruto − descuentos            = neto
 *   bruto + contribuciones        = costo total empleador
 *
 * Es la red del parseo: si falta una línea la cuenta no cierra y el recibo
 * queda marcado en vez de viajar con un número mal.
 */
function verificarIdentidades(
  recibo: ReciboParseado,
  impresos: Partial<Record<string, number>>,
): string[] {
  const advertencias: string[] = [];
  const comparar = (etiqueta: string, calculado: number | null, impreso: number | undefined) => {
    if (impreso === undefined || calculado === null) return;
    if (Math.abs(calculado - impreso) > 0.01) {
      advertencias.push(`${etiqueta}: sumamos ${calculado.toFixed(2)}, el recibo dice ${impreso.toFixed(2)}`);
    }
  };
  comparar('remunerativo', recibo.remunerativo_total, impresos.remunerativo);
  comparar('no remunerativo', recibo.no_remunerativo_total, impresos.no_remunerativo);
  comparar('descuentos', recibo.descuentos_total, impresos.descuentos);
  comparar('contribuciones', recibo.contribuciones_total, impresos.contribuciones);
  comparar('sueldo bruto', recibo.sueldo_bruto, impresos.bruto);
  comparar('sueldo neto', recibo.sueldo_neto, impresos.neto);
  comparar('costo total empleador', recibo.costo_total_empleador, impresos.costo);
  return advertencias;
}

// ─── Entrada ───────────────────────────────────────────────────────────────

/**
 * Lee un PDF de recibo y devuelve un recibo por página: un archivo puede traer
 * el SAC y el mensual, y A&F los necesita separados (devengan distinto y su
 * base de contribuciones no es la misma).
 */
export async function parsearRecibo(archivo: Uint8Array): Promise<ResultadoParseo> {
  const errores: string[] = [];
  const recibos: ReciboParseado[] = [];

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(archivo);
  } catch (error) {
    return { recibos: [], errores: [`No se pudo abrir el PDF: ${(error as Error).message}`] };
  }

  for (let numero = 1; numero <= pdf.numPages; numero++) {
    try {
      const pagina = await pdf.getPage(numero);
      const contenido = await pagina.getTextContent();
      const filas = agruparEnFilas(contenido.items as never[]);
      if (filas.length === 0) {
        errores.push(`Página ${numero}: sin texto (¿es un escaneo?)`);
        continue;
      }
      const plantilla = detectarPlantilla(filas);
      if (!plantilla) {
        errores.push(`Página ${numero}: formato de recibo desconocido`);
        continue;
      }
      const recibo = plantilla === 'A'
        ? parsearPorSecciones(filas, numero)
        : parsearColumnar(filas, plantilla, numero);
      if (!recibo) {
        errores.push(`Página ${numero}: no se encontraron conceptos`);
        continue;
      }
      recibos.push(recibo);
    } catch (error) {
      errores.push(`Página ${numero}: ${(error as Error).message}`);
    }
  }

  return { recibos, errores };
}
