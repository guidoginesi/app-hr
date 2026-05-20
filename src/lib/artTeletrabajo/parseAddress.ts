import type { TeleworkEmployeeRow } from './types';

export interface ParsedAddress {
  calle: string;
  nro: string;
  piso: string;
  depto: string;
  localidad: string;
  provincia: string;
}

/** Parsea domicilio desde notas de solicitud remota. */
export function parseRemoteLocationFromNotes(notes: string | null) {
  if (!notes) {
    return { destino: '', domicilio: '', contacto: '' };
  }
  const destino = notes.match(/^Destino:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const domicilio = notes.match(/^Domicilio:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const contacto = notes.match(/^Contacto de emergencia:\s*(.+)$/m)?.[1]?.trim() ?? '';
  return { destino, domicilio, contacto };
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Heurística simple para partir una dirección en campos del formulario ART. */
export function parseAddressString(raw: string, fallbackLocalidad = '', fallbackProvincia = ''): ParsedAddress {
  const text = raw.trim();
  if (!text) {
    return {
      calle: '',
      nro: '',
      piso: '',
      depto: '',
      localidad: fallbackLocalidad,
      provincia: fallbackProvincia,
    };
  }

  const pisoMatch = text.match(/(?:piso|pto\.?)\s*([^\s,]+)/i);
  const deptoMatch = text.match(/(?:depto\.?|dto\.?|departamento)\s*([^\s,]+)/i);
  const nroMatch = text.match(/\b(n[°ºo]?\.?\s*)?(\d{1,6}[a-zA-Z]?)\b/);

  let calle = text;
  let nro = nroMatch?.[2] ?? '';

  if (nroMatch?.index != null) {
    calle = text.slice(0, nroMatch.index).replace(/[\s,]+$/, '');
  }

  calle = calle
    .replace(/(?:piso|pto\.?)\s*[^\s,]+/gi, '')
    .replace(/(?:depto\.?|dto\.?|departamento)\s*[^\s,]+/gi, '')
    .replace(/[\s,]+$/, '')
    .trim();

  return {
    calle: truncate(calle, 40),
    nro: truncate(nro, 6),
    piso: truncate(pisoMatch?.[1] ?? '', 4),
    depto: truncate(deptoMatch?.[1] ?? '', 4),
    localidad: truncate(fallbackLocalidad, 30),
    provincia: truncate(fallbackProvincia, 30),
  };
}

export function formatCuil(cuil: string | null): string {
  if (!cuil) return '';
  const digits = cuil.replace(/\D/g, '');
  if (digits.length !== 11) return cuil.trim();
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function buildRowFromEmployee(
  employee: {
    first_name: string;
    last_name: string;
    cuil: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  },
  defaults: { cantDias: string; hsSemanales: string },
  domicilioOverride?: string,
  destinoOverride?: string,
): TeleworkEmployeeRow {
  const parsed = parseAddressString(
    domicilioOverride || employee.address || '',
    destinoOverride || employee.city || '',
    employee.country || 'Argentina',
  );

  return {
    apellido: truncate(employee.last_name, 30),
    nombre: truncate(employee.first_name, 30),
    cuil: truncate(formatCuil(employee.cuil), 13),
    calle: parsed.calle,
    nro: parsed.nro,
    piso: parsed.piso,
    depto: parsed.depto,
    localidad: parsed.localidad,
    provincia: parsed.provincia,
    cantDias: defaults.cantDias,
    hsSemanales: defaults.hsSemanales,
  };
}
