// Banco de Talentos: reglas compartidas entre el formulario público y el panel.
//
// Este archivo NO importa nada del server: lo consumen componentes de cliente
// (el formulario público, la tabla del panel) y arrastrar acá el cliente de
// Supabase metería la service role key en el bundle del navegador. Lo que
// necesita la base vive en talentPoolServer.ts.

export const RESUMES_BUCKET = 'resumes';

/** Carpeta propia dentro del bucket: separa lo espontáneo de lo que vino por una búsqueda. */
export const TALENT_POOL_PREFIX = 'talent-pool';

export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB, como pedía el ticket

/**
 * PDF y Word. El formulario de postulación a una búsqueda ya acepta ambos; pedir
 * sólo PDF acá haría que alguien abandone por no tener el CV convertido.
 */
export const ALLOWED_RESUME_EXTENSIONS = ['pdf', 'doc', 'docx'] as const;

export const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const SENIORITY_OPTIONS = ['Junior', 'Semi Senior', 'Senior', 'Lead'] as const;
export type Seniority = (typeof SENIORITY_OPTIONS)[number];

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;

/** Envíos por IP en una hora. Un candidato real manda uno; esto sólo frena scripts. */
export const SUBMISSIONS_PER_IP_PER_HOUR = 5;

export type TalentPoolStatus = 'NEW' | 'ON_HOLD' | 'DISCARDED' | 'ASSIGNED';

export const TALENT_POOL_STATUS_LABELS: Record<TalentPoolStatus, string> = {
  NEW: 'Nuevo',
  ON_HOLD: 'En espera',
  DISCARDED: 'Descartado',
  ASSIGNED: 'Asignado',
};

/**
 * Estados que HR puede elegir a mano. "Asignado" no está: no se tipea, se
 * consigue asignando a una búsqueda, y ponerlo a mano dejaría el estado
 * diciendo que la persona está en un proceso que no existe.
 */
export const MANUAL_TALENT_POOL_STATUSES: TalentPoolStatus[] = ['NEW', 'ON_HOLD', 'DISCARDED'];

/** Etiqueta que lleva la postulación creada desde el banco. */
export const TALENT_POOL_SOURCE = 'TALENT_POOL';
export const TALENT_POOL_SOURCE_LABEL = 'Banco de Talentos';

export function resumeExtension(fileName: string): string {
  return (fileName.split('.').pop() || '').toLowerCase();
}

export function isAllowedResume(file: { name: string; type?: string }): boolean {
  const ext = resumeExtension(file.name);
  // El MIME que manda el navegador no es confiable (Word suele llegar vacío o
  // como octet-stream), así que la extensión manda y el MIME sólo suma.
  if ((ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(ext)) return true;
  return !!file.type && ALLOWED_RESUME_MIME_TYPES.includes(file.type);
}

export type TalentPoolArea = { id: string; name: string; active: boolean; sort_order: number };
