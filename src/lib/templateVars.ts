// Render de plantillas de mensajes con variables {{token}}, merge por destinatario.

export const TEMPLATE_VARS = [
  { token: 'nombre', label: 'Nombre' },
  { token: 'apellido', label: 'Apellido' },
  { token: 'dni', label: 'DNI' },
  { token: 'cuil', label: 'CUIL' },
  { token: 'periodo', label: 'Período' },
] as const;

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function hasTemplateTokens(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => (t ? new RegExp(TOKEN_RE.source, 'i').test(t) : false));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Reemplaza {{token}} por su valor. Tokens desconocidos → ''.
// `escape` = true cuando el resultado se inyecta en HTML (body del mensaje).
export function renderTemplate(s: string, vars: Record<string, string>, escape = false): string {
  if (!s) return s;
  return s.replace(TOKEN_RE, (_m, key: string) => {
    const raw = vars[key.toLowerCase()];
    const val = raw === undefined || raw === null ? '' : String(raw);
    return escape ? escapeHtml(val) : val;
  });
}

type EmpLike = {
  first_name?: string | null;
  last_name?: string | null;
  dni?: string | null;
  cuil?: string | null;
} | null;

// Variables de un destinatario (datos del empleado) + contexto del mensaje (período, etc.).
export function buildRecipientVars(emp: EmpLike, context: Record<string, string> = {}): Record<string, string> {
  return {
    nombre: emp?.first_name ?? '',
    apellido: emp?.last_name ?? '',
    dni: emp?.dni ?? '',
    cuil: emp?.cuil ?? '',
    ...context,
  };
}
