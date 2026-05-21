import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFTextField, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { ArtTeletrabajoConfig, TeleworkEmployeeRow } from './types';

const TEMPLATE_PATH = path.join(process.cwd(), 'assets/templates/berkley-teletrabajo.pdf');
const FONT_SIZE = 7;
const EMPLOYER_FONT_SIZE = 8;

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

/** Posiciones de celdas extraídas del template Berkley. */
interface GridCell {
  x: number;
  y: number;
}

interface GridRow {
  pageIndex: number;
  cells: GridCell[];
}

interface EmployerSlot {
  pageIndex: number;
  name: GridCell;
  cuit: GridCell;
}

function loadTemplateBytes(): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`No se encontró el template PDF en ${TEMPLATE_PATH}`);
  }
  return fs.readFileSync(TEMPLATE_PATH);
}

/** Lee las coordenadas de las celdas desde los campos del template y luego los elimina. */
function extractGridAndClearForm(pdf: PDFDocument): { rows: GridRow[]; employer: EmployerSlot | null } {
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const rowMap = new Map<string, GridRow>();
  let employer: EmployerSlot | null = null;

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const widget = field.acroField.getWidgets()[0];
    const rect = widget.getRectangle();
    const pageIndex = pages.findIndex((page) => page.ref === widget.P());
    if (pageIndex < 0) continue;

    // Fila empleador (solo página 1)
    if (pageIndex === 0 && rect.y >= 420) {
      if (!employer) {
        employer = {
          pageIndex: 0,
          name: { x: 0, y: 0 },
          cuit: { x: 0, y: 0 },
        };
      }
      if (rect.x < 400) {
        employer.name = { x: rect.x, y: rect.y };
      } else {
        employer.cuit = { x: rect.x, y: rect.y };
      }
      continue;
    }

    const yKey = `${pageIndex}:${Math.round(rect.y)}`;
    let row = rowMap.get(yKey);
    if (!row) {
      row = { pageIndex, cells: [] };
      rowMap.set(yKey, row);
    }
    row.cells.push({ x: rect.x, y: rect.y });
  }

  // Eliminar campos del formulario (si no, las cajas vacías tapan el texto dibujado)
  for (const field of [...form.getFields()]) {
    form.removeField(field);
  }

  const rows = [...rowMap.values()]
    .filter((row) => row.cells.length >= 8)
    .map((row) => ({
      pageIndex: row.pageIndex,
      cells: row.cells.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => {
      const yA = a.cells[0]?.y ?? 0;
      const yB = b.cells[0]?.y ?? 0;
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return yB - yA;
    });

  return { rows, employer };
}

function truncateToWidth(text: string, maxChars: number): string {
  const value = (text ?? '').trim();
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

/** Límites aproximados según ancho de celda en el template. */
const MAX_CHARS = [18, 14, 13, 18, 4, 3, 3, 14, 14, 3, 3];

function drawCellText(
  font: PDFFont,
  page: ReturnType<PDFDocument['getPages']>[number],
  cell: GridCell,
  text: string,
  maxChars: number,
) {
  const value = truncateToWidth(text, maxChars);
  if (!value) return;

  page.drawText(value, {
    x: cell.x + 1.5,
    y: cell.y + 2.5,
    size: FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawEmployerText(
  font: PDFFont,
  pdf: PDFDocument,
  employer: EmployerSlot,
  config: ArtTeletrabajoConfig,
) {
  const page = pdf.getPages()[employer.pageIndex];
  if (config.employerName) {
    page.drawText(config.employerName, {
      x: employer.name.x + 2,
      y: employer.name.y + 3,
      size: EMPLOYER_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }
  if (config.employerCuit) {
    page.drawText(config.employerCuit, {
      x: employer.cuit.x + 2,
      y: employer.cuit.y + 3,
      size: EMPLOYER_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

export async function generateArtTeletrabajoPdf(
  rows: TeleworkEmployeeRow[],
  config: ArtTeletrabajoConfig,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(loadTemplateBytes(), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const { rows: gridRows, employer } = extractGridAndClearForm(pdf);

  if (employer) {
    drawEmployerText(font, pdf, employer, config);
  }

  const maxRows = gridRows.length;
  if (rows.length > maxRows) {
    throw new Error(
      `El PDF admite ${maxRows} filas y hay ${rows.length} empleados en relación de dependencia.`,
    );
  }

  rows.forEach((employee, index) => {
    const gridRow = gridRows[index];
    if (!gridRow) return;

    const page = pages[gridRow.pageIndex];
    const values = ROW_VALUES(employee);

    gridRow.cells.forEach((cell, colIndex) => {
      drawCellText(font, page, cell, values[colIndex] ?? '', MAX_CHARS[colIndex] ?? 20);
    });
  });

  return pdf.save();
}

export function buildPdfFilename(referenceDate: string, notificationType: string): string {
  const suffix = notificationType === 'pre_departure' ? 'salida' : 'retorno';
  return `teletrabajo-${referenceDate}-${suffix}.pdf`;
}
