import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ArtTeletrabajoConfig, TeleworkEmployeeRow } from './types';

const TEMPLATE_PATH = path.join(process.cwd(), 'assets/templates/berkley-teletrabajo.pdf');

/** Columnas del formulario Berkley: Text3..Text13 */
const COLUMN_BASE = 3;
const COLUMN_COUNT = 11;

const ROW_VALUES = (row: TeleworkEmployeeRow) => [
  row.apellido,
  row.nombre,
  row.cuil,
  row.calle,
  row.nro,
  row.piso,
  row.depto,
  row.localidad,
  row.provincia,
  row.cantDias,
  row.hsSemanales,
];

/**
 * Nombres de campos AcroForm del template Berkley (sin encriptar).
 * Página 1: Text3.N .. Text13.N  (N = 0..18, 19 filas)
 * Página 2/3: Text3.18.0.M .. Text13.18.0.M  (M = 0..20, 21 filas)
 */
function fieldName(columnIndex: number, rowIndex: number): string {
  const col = `Text${columnIndex + COLUMN_BASE}`;
  if (rowIndex <= 18) return `${col}.${rowIndex}`;
  return `${col}.18.0.${rowIndex - 19}`;
}

function loadTemplateBytes(): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`No se encontró el template PDF en ${TEMPLATE_PATH}`);
  }
  return fs.readFileSync(TEMPLATE_PATH);
}

function setField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string) {
  if (!value) return;
  try {
    form.getTextField(name).setText(value);
  } catch {
    // campo inexistente en alguna variante del template
  }
}

export async function generateArtTeletrabajoPdf(
  rows: TeleworkEmployeeRow[],
  config: ArtTeletrabajoConfig,
): Promise<Uint8Array> {
  const maxRows = 19 + 21;
  if (rows.length > maxRows) {
    throw new Error(
      `El PDF admite ${maxRows} filas y hay ${rows.length} empleados en relación de dependencia.`,
    );
  }

  const pdf = await PDFDocument.load(loadTemplateBytes());
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  setField(form, 'Text1', config.employerName);
  setField(form, 'Text2', config.employerCuit);

  rows.forEach((employee, rowIndex) => {
    const values = ROW_VALUES(employee);
    for (let col = 0; col < COLUMN_COUNT; col++) {
      setField(form, fieldName(col, rowIndex), values[col] ?? '');
    }
  });

  form.updateFieldAppearances(font);

  // No flatten: en este template aplanar borra el contenido visible.
  return pdf.save({ useObjectStreams: false });
}

export function buildPdfFilename(referenceDate: string, notificationType: string): string {
  const suffix = notificationType === 'pre_departure' ? 'salida' : 'retorno';
  return `teletrabajo-${referenceDate}-${suffix}.pdf`;
}
