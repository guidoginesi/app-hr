import { Stage, StageStatus, OfferStatus, FinalOutcome, STAGE_ORDER } from '@/types/funnel';

/**
 * Obtiene la siguiente etapa válida en el funnel
 */
export function getNextStage(currentStage: Stage): Stage | null {
	const currentIndex = STAGE_ORDER.indexOf(currentStage);
	if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
		return null;
	}
	return STAGE_ORDER[currentIndex + 1];
}

/**
 * Obtiene la etapa anterior en el funnel
 */
export function getPreviousStage(currentStage: Stage): Stage | null {
	const currentIndex = STAGE_ORDER.indexOf(currentStage);
	if (currentIndex <= 0) {
		return null;
	}
	return STAGE_ORDER[currentIndex - 1];
}

/**
 * Verifica si una transición de etapa es válida
 */
export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
	// Siempre se puede volver a CLOSED
	if (toStage === Stage.CLOSED) {
		return true;
	}

	// No se puede salir de CLOSED
	if (fromStage === Stage.CLOSED) {
		return false;
	}

	const fromIndex = STAGE_ORDER.indexOf(fromStage);
	const toIndex = STAGE_ORDER.indexOf(toStage);

	// Solo se puede avanzar a la siguiente etapa o retroceder a la anterior
	return Math.abs(toIndex - fromIndex) <= 1;
}

/**
 * Determina si una etapa requiere offer_status
 */
export function requiresOfferStatus(stage: Stage): boolean {
	return stage === Stage.OFFER || stage === Stage.CLOSED;
}

/**
 * Determina si una etapa puede tener final_outcome
 */
export function canHaveFinalOutcome(stage: Stage): boolean {
	return stage === Stage.CLOSED;
}

/**
 * Obtiene los motivos de rechazo válidos según quién rechaza
 */
export function getValidRejectionReasons(
	finalOutcome: FinalOutcome
): string[] {
	if (finalOutcome === FinalOutcome.REJECTED_BY_POW) {
		return [
			'TECH_SKILLS_INSUFFICIENT',
			'CULTURAL_MISFIT',
			'SALARY_EXPECTATION_ABOVE_RANGE',
			'LACK_OF_EXPERIENCE',
			'SOFT_SKILLS_MISMATCH',
			'NO_SHOW',
			'OTHER'
		];
	} else if (finalOutcome === FinalOutcome.REJECTED_BY_CANDIDATE) {
		return [
			'ACCEPTED_OTHER_OFFER',
			'SALARY_TOO_LOW',
			'BENEFITS_INSUFFICIENT',
			'MODALITY_NOT_ACCEPTED',
			'LOCATION_ISSUE',
			'PERSONAL_REASON',
			'PROCESS_TAKES_TOO_LONG',
			'OTHER'
		];
	}
	return ['OTHER'];
}

/**
 * Auto-completa final_outcome basado en offer_status cuando se acepta
 */
export function getFinalOutcomeFromOfferStatus(
	offerStatus: OfferStatus
): FinalOutcome | null {
	switch (offerStatus) {
		case OfferStatus.ACCEPTED:
			return FinalOutcome.HIRED;
		case OfferStatus.REJECTED_BY_CANDIDATE:
			return FinalOutcome.REJECTED_BY_CANDIDATE;
		case OfferStatus.WITHDRAWN_BY_POW:
			return FinalOutcome.REJECTED_BY_POW;
		default:
			return null;
	}
}

