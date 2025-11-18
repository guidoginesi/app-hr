// Enums para el funnel de selección

export enum Stage {
	CV_RECEIVED = 'CV_RECEIVED',
	HR_REVIEW = 'HR_REVIEW',
	FILTER_QUESTIONS = 'FILTER_QUESTIONS',
	HR_INTERVIEW = 'HR_INTERVIEW',
	LEAD_INTERVIEW = 'LEAD_INTERVIEW',
	EO_INTERVIEW = 'EO_INTERVIEW',
	REFERENCES_CHECK = 'REFERENCES_CHECK',
	SELECTED_FOR_OFFER = 'SELECTED_FOR_OFFER',
	OFFER = 'OFFER',
	CLOSED = 'CLOSED'
}

export enum StageStatus {
	PENDING = 'PENDING',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	DISCARDED_IN_STAGE = 'DISCARDED_IN_STAGE',
	ON_HOLD = 'ON_HOLD'
}

export enum OfferStatus {
	PENDING_TO_SEND = 'PENDING_TO_SEND',
	SENT = 'SENT',
	ACCEPTED = 'ACCEPTED',
	REJECTED_BY_CANDIDATE = 'REJECTED_BY_CANDIDATE',
	WITHDRAWN_BY_POW = 'WITHDRAWN_BY_POW',
	EXPIRED = 'EXPIRED'
}

export enum FinalOutcome {
	HIRED = 'HIRED',
	REJECTED_BY_POW = 'REJECTED_BY_POW',
	REJECTED_BY_CANDIDATE = 'REJECTED_BY_CANDIDATE',
	ROLE_CANCELLED = 'ROLE_CANCELLED',
	TALENT_POOL = 'TALENT_POOL'
}

export enum RejectionReason {
	// Para REJECTED_BY_POW
	TECH_SKILLS_INSUFFICIENT = 'TECH_SKILLS_INSUFFICIENT',
	CULTURAL_MISFIT = 'CULTURAL_MISFIT',
	SALARY_EXPECTATION_ABOVE_RANGE = 'SALARY_EXPECTATION_ABOVE_RANGE',
	LACK_OF_EXPERIENCE = 'LACK_OF_EXPERIENCE',
	SOFT_SKILLS_MISMATCH = 'SOFT_SKILLS_MISMATCH',
	NO_SHOW = 'NO_SHOW',
	// Para REJECTED_BY_CANDIDATE
	ACCEPTED_OTHER_OFFER = 'ACCEPTED_OTHER_OFFER',
	SALARY_TOO_LOW = 'SALARY_TOO_LOW',
	BENEFITS_INSUFFICIENT = 'BENEFITS_INSUFFICIENT',
	MODALITY_NOT_ACCEPTED = 'MODALITY_NOT_ACCEPTED',
	LOCATION_ISSUE = 'LOCATION_ISSUE',
	PERSONAL_REASON = 'PERSONAL_REASON',
	PROCESS_TAKES_TOO_LONG = 'PROCESS_TAKES_TOO_LONG',
	// General
	OTHER = 'OTHER'
}

// Etiquetas en español para UI
export const StageLabels: Record<Stage, string> = {
	[Stage.CV_RECEIVED]: 'CV Recibido',
	[Stage.HR_REVIEW]: 'Revisión HR',
	[Stage.FILTER_QUESTIONS]: 'Preguntas Filtro',
	[Stage.HR_INTERVIEW]: 'Entrevista HR',
	[Stage.LEAD_INTERVIEW]: 'Entrevista Líder',
	[Stage.EO_INTERVIEW]: 'Entrevista EO/CEO',
	[Stage.REFERENCES_CHECK]: 'Chequeo Referencias',
	[Stage.SELECTED_FOR_OFFER]: 'Seleccionado para Oferta',
	[Stage.OFFER]: 'Oferta',
	[Stage.CLOSED]: 'Cerrado'
};

export const StageStatusLabels: Record<StageStatus, string> = {
	[StageStatus.PENDING]: 'Pendiente',
	[StageStatus.IN_PROGRESS]: 'En Progreso',
	[StageStatus.COMPLETED]: 'Completado',
	[StageStatus.DISCARDED_IN_STAGE]: 'Descartado',
	[StageStatus.ON_HOLD]: 'En Pausa'
};

export const OfferStatusLabels: Record<OfferStatus, string> = {
	[OfferStatus.PENDING_TO_SEND]: 'Pendiente de Envío',
	[OfferStatus.SENT]: 'Enviada',
	[OfferStatus.ACCEPTED]: 'Aceptada',
	[OfferStatus.REJECTED_BY_CANDIDATE]: 'Rechazada por Candidato',
	[OfferStatus.WITHDRAWN_BY_POW]: 'Retirada por Pow',
	[OfferStatus.EXPIRED]: 'Expirada'
};

export const FinalOutcomeLabels: Record<FinalOutcome, string> = {
	[FinalOutcome.HIRED]: 'Contratado',
	[FinalOutcome.REJECTED_BY_POW]: 'Rechazado por Pow',
	[FinalOutcome.REJECTED_BY_CANDIDATE]: 'Rechazado por Candidato',
	[FinalOutcome.ROLE_CANCELLED]: 'Búsqueda Cancelada',
	[FinalOutcome.TALENT_POOL]: 'Banco de Talento'
};

export const RejectionReasonLabels: Record<RejectionReason, string> = {
	[RejectionReason.TECH_SKILLS_INSUFFICIENT]: 'Habilidades técnicas insuficientes',
	[RejectionReason.CULTURAL_MISFIT]: 'No encaja culturalmente',
	[RejectionReason.SALARY_EXPECTATION_ABOVE_RANGE]: 'Expectativa salarial fuera de rango',
	[RejectionReason.LACK_OF_EXPERIENCE]: 'Falta de experiencia',
	[RejectionReason.SOFT_SKILLS_MISMATCH]: 'Habilidades blandas no coinciden',
	[RejectionReason.NO_SHOW]: 'No se presentó',
	[RejectionReason.ACCEPTED_OTHER_OFFER]: 'Aceptó otra oferta',
	[RejectionReason.SALARY_TOO_LOW]: 'Salario muy bajo',
	[RejectionReason.BENEFITS_INSUFFICIENT]: 'Beneficios insuficientes',
	[RejectionReason.MODALITY_NOT_ACCEPTED]: 'Modalidad no aceptada',
	[RejectionReason.LOCATION_ISSUE]: 'Problema de ubicación',
	[RejectionReason.PERSONAL_REASON]: 'Razón personal',
	[RejectionReason.PROCESS_TAKES_TOO_LONG]: 'Proceso muy largo',
	[RejectionReason.OTHER]: 'Otro'
};

// Orden de las etapas del funnel
export const STAGE_ORDER: Stage[] = [
	Stage.CV_RECEIVED,
	Stage.HR_REVIEW,
	Stage.HR_INTERVIEW,
	Stage.LEAD_INTERVIEW,
	Stage.EO_INTERVIEW,
	Stage.REFERENCES_CHECK,
	Stage.SELECTED_FOR_OFFER,
	Stage.OFFER,
	Stage.CLOSED
];

// Tipos para las entidades
export interface StageHistory {
	id: string;
	application_id: string;
	from_stage: Stage | null;
	to_stage: Stage;
	status: StageStatus;
	changed_by_user_id: string | null;
	changed_at: string;
	notes: string | null;
}

export interface ApplicationWithFunnel {
	id: string;
	candidate_id: string;
	job_id: string;
	resume_url: string;
	current_stage: Stage;
	current_stage_status: StageStatus;
	offer_status: OfferStatus | null;
	final_outcome: FinalOutcome | null;
	final_rejection_reason: RejectionReason | null;
	ai_extracted: any;
	ai_score: number | null;
	ai_reasons: string[] | null;
	ai_match_highlights: string[] | null;
	created_at: string;
	updated_at: string;
	// Relaciones
	stage_history?: StageHistory[];
}

