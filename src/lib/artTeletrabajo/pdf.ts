import fs from 'fs';
import path from 'path';
import {
  PDFDocument,
  PDFTextField,
  StandardFonts,
  type PDFFont,
} from 'pdf-lib';
import type { ArtTeletrabajoConfig, TeleworkEmployeeRow } from './types';

const TEMPLATE_PATH = path.join(process.cwd(), 'assets/templates/berkley-teletrabajo.pdf');

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

interface FieldSlot {
  pageIndex: number;
  y: number;
  x: number;
  field: PDFTextField;
}

function loadTemplateBytes(): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`No se encontró el template PDF en ${TEMPLATE_PATH}`);
  }
  return fs.readFileSync(TEMPLATE_PATH);
}

function collectFieldSlots(pdf: PDFDocument): FieldSlot[] {
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const slots: FieldSlot[] = [];

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const widget = field.acroField.getWidgets()[0];
    const rect = widget.getRectangle();
    const pageIndex = pages.findIndex((page) => page.ref === widget.P());
    if (pageIndex < 0) continue;

    slots.push({
      pageIndex,
      y: Math.round(rect.y),
      x: Math.round(rect.x),
      field,
    });
  }

  return slots;
}

/** Agrupa los 11 campos de cada fila de empleado (misma página + misma Y). */
function groupEmployeeRows(slots: FieldSlot[]): FieldSlot[][] {
  const rows: FieldSlot[][] = [];

  for (const slot of slots) {
    // Fila de empleador en página 1 (solo razón social + CUIT)
    if (slot.pageIndex === 0 && slot.y >= 420) continue;

    const existing = rows.find(
      (row) =>
        row[0].pageIndex === slot.pageIndex && Math.abs(row[0].y - slot.y) <= 6,
    );
    if (existing) {
      existing.push(slot);
    } else {
      rows.push([slot]);
    }
  }

  return rows
    .filter((row) => row.length >= 8)
    .map((row) => row.sort((a, b) => a.x - b.x))
    .sort((a, b) => {
      if (a[0].pageIndex !== b[0].pageIndex) return a[0].pageIndex - b[0].pageIndex;
      return b[0].y - a[0].y;
    });
}

function fillEmployerFields(slots: FieldSlot[], config: ArtTeletrabajoConfig) {
  const employerFields = slots
    .filter((slot) => slot.pageIndex === 0 && slot.y >= 420 && slot.x >= 180)
    .sort((a, b) => a.x - b.x);

  if (employerFields[0]) employerFields[0].field.setText(config.employerName);
  if (employerFields[1]) employerFields[1].field.setText(config.employerCuit);
}

function applyFieldStyle(field: PDFTextField, font: PDFFont) {
  try {
    field.setFontSize(7);
    field.updateAppearances(font);
  } catch {
    // algunos campos encriptados pueden fallar; seguimos con el resto
  }
}

function fillEmployeeRow(rowSlots: FieldSlot[], row: TeleworkEmployeeRow, font: PDFFont) {
  const values = ROW_VALUES(row);
  rowSlots.forEach((slot, index) => {
    if (index >= values.length) return;
    slot.field.setText(values[index] ?? '');
    applyFieldStyle(slot.field, font);
  });
}

export async function generateArtTeletrabajoPdf(
  rows: TeleworkEmployeeRow[],
  config: ArtTeletrabajoConfig,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(loadTemplateBytes(), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const slots = collectFieldSlots(pdf);
  const employeeRows = groupEmployeeRows(slots);

  fillEmployerFields(slots, config);
  for (const slot of slots.filter((s) => s.pageIndex === 0 && s.y >= 420 && s.x >= 180)) {
    applyFieldStyle(slot.field, font);
  }

  const maxRows = employeeRows.length;
  if (rows.length > maxRows) {
    throw new Error(
      `El PDF admite ${maxRows} filas y hay ${rows.length} empleados en relación de dependencia.`,
    );
  }

  rows.forEach((row, index) => {
    if (employeeRows[index]) {
      fillEmployeeRow(employeeRows[index], row, font);
    }
  });

  try {
    form.updateFieldAppearances(font);
  } catch {
    // fallback: las apariencias por campo ya se intentaron arriba
  }

  form.flatten();
  return pdf.save();
}

export function buildPdfFilename(referenceDate: string, notificationType: string): string {
  const suffix = notificationType === 'pre_departure' ? 'salida' : 'retorno';
  return `teletrabajo-${referenceDate}-${suffix}.pdf`;
}
