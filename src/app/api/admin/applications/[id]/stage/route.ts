import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, StageStatus, OfferStatus, FinalOutcome, RejectionReason } from '@/types/funnel';
import {
	isValidTransition,
	requiresOfferStatus,
	canHaveFinalOutcome,
	getValidRejectionReasons,
	getFinalOutcomeFromOfferStatus,
	getNextStage
} from '@/lib/funnel';
import { sendTemplatedEmail } from '@/lib/emailService';

const UpdateStageSchema = z.object({
	to_stage: z.nativeEnum(Stage),
	status: z.nativeEnum(StageStatus),
	offer_status: z.nativeEnum(OfferStatus).optional().nullable(),
	final_outcome: z.nativeEnum(FinalOutcome).optional().nullable(),
	final_rejection_reason: z.nativeEnum(RejectionReason).optional().nullable(),
	notes: z.string().optional().nullable()
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const userId = user.id;

		const { id } = await params;
		const applicationId = id;
		const body = await req.json();
		const parsed = UpdateStageSchema.parse(body);

		const supabase = getSupabaseServer();

		// Obtener la aplicación actual con información del candidato y job
		const { data: application, error: appError } = await supabase
			.from('applications')
			.select(`
				current_stage,
				current_stage_status,
				offer_status,
				final_outcome,
				candidate_id,
				job_id,
				candidates (
					name,
					email
				),
				jobs (
					title
				)
			`)
			.eq('id', applicationId)
			.single();

		if (appError) {
			console.error('Error fetching application:', appError);
			console.error('Application ID:', applicationId);
			return NextResponse.json(
				{ error: `Application not found: ${appError.message}` },
				{ status: 404 }
			);
		}

		if (!application) {
			console.error('Application not found, ID:', applicationId);
			return NextResponse.json(
				{ error: 'Application not found' },
				{ status: 404 }
			);
		}

		// Validar transición
		if (!isValidTransition(application.current_stage, parsed.to_stage)) {
			return NextResponse.json(
				{ error: 'Invalid stage transition' },
				{ status: 400 }
			);
		}

		// Validar que si requiere offer_status, esté presente
		if (requiresOfferStatus(parsed.to_stage) && !parsed.offer_status) {
			return NextResponse.json(
				{ error: 'offer_status is required for this stage' },
				{ status: 400 }
			);
		}

		// Validar que si requiere final_outcome, esté presente
		if (canHaveFinalOutcome(parsed.to_stage) && !parsed.final_outcome) {
			return NextResponse.json(
				{ error: 'final_outcome is required when closing an application' },
				{ status: 400 }
			);
		}

		// Validar rejection_reason si hay final_outcome
		if (parsed.final_outcome) {
			const validReasons = getValidRejectionReasons(parsed.final_outcome);
			if (
				parsed.final_rejection_reason &&
				!validReasons.includes(parsed.final_rejection_reason)
			) {
				return NextResponse.json(
					{ error: 'Invalid rejection reason for this outcome' },
					{ status: 400 }
				);
			}
		}

		// Auto-completar final_outcome desde offer_status si aplica
		let finalOutcome = parsed.final_outcome;
		if (
			parsed.to_stage === Stage.CLOSED &&
			parsed.offer_status &&
			!finalOutcome
		) {
			finalOutcome = getFinalOutcomeFromOfferStatus(parsed.offer_status);
		}

		// Si se marca como COMPLETED y no es CLOSED, avanzar automáticamente a la siguiente etapa
		let targetStage = parsed.to_stage;
		let targetStatus = parsed.status;
		const shouldAutoAdvance = parsed.status === StageStatus.COMPLETED && parsed.to_stage !== Stage.CLOSED;
		
		if (shouldAutoAdvance) {
			const nextStage = getNextStage(parsed.to_stage);
			if (nextStage) {
				targetStage = nextStage;
				targetStatus = StageStatus.PENDING;
			}
		}

		// Actualizar la aplicación
		const updateData: any = {
			current_stage: targetStage,
			current_stage_status: targetStatus,
			updated_at: new Date().toISOString()
		};

		if (parsed.offer_status !== undefined) {
			updateData.offer_status = parsed.offer_status;
		}

		if (finalOutcome) {
			updateData.final_outcome = finalOutcome;
		}

		if (parsed.final_rejection_reason) {
			updateData.final_rejection_reason = parsed.final_rejection_reason;
		}

		const { error: updateError } = await supabase
			.from('applications')
			.update(updateData)
			.eq('id', applicationId);

		if (updateError) {
			throw updateError;
		}

		// Crear registros en stage_history
		const historyRecords = [];

		// Registro de la etapa actual completada
		historyRecords.push({
			application_id: applicationId,
			from_stage: application.current_stage,
			to_stage: parsed.to_stage,
			status: parsed.status,
			changed_by_user_id: userId,
			notes: parsed.notes || null
		});

		// Si se avanzó automáticamente, crear registro de la siguiente etapa
		if (shouldAutoAdvance && targetStage !== parsed.to_stage) {
			historyRecords.push({
				application_id: applicationId,
				from_stage: parsed.to_stage,
				to_stage: targetStage,
				status: StageStatus.PENDING,
				changed_by_user_id: userId,
				notes: 'Avance automático a la siguiente etapa'
			});
		}

		const { error: historyError } = await supabase
			.from('stage_history')
			.insert(historyRecords);

		if (historyError) {
			console.error('Error creating stage history:', historyError);
			// No fallamos si el historial falla, pero lo registramos
		}

		// TRIGGER 1: Email de descarte cuando status = DISCARDED_IN_STAGE
		if (parsed.status === StageStatus.DISCARDED_IN_STAGE) {
			const candidate = (application as any).candidates;
			const job = (application as any).jobs;
			
			if (candidate?.email) {
				await sendTemplatedEmail({
					templateKey: 'candidate_rejected',
					to: candidate.email,
					variables: {
						candidateName: candidate.name || 'Candidato',
						jobTitle: job?.title || 'la posición',
						stage: parsed.to_stage
					},
					applicationId
				}).catch(err => {
					console.error('Error sending rejection email:', err);
				});
			}
		}

		// TRIGGER 2: Email de coordinación de entrevista cuando HR_REVIEW está COMPLETED
		if (parsed.to_stage === Stage.HR_REVIEW && parsed.status === StageStatus.COMPLETED) {
			const candidate = (application as any).candidates;
			const job = (application as any).jobs;
			
			if (candidate?.email) {
				await sendTemplatedEmail({
					templateKey: 'interview_coordination',
					to: candidate.email,
					variables: {
						candidateName: candidate.name || 'Candidato',
						jobTitle: job?.title || 'la posición'
					},
					applicationId
				}).catch(err => {
					console.error('Error sending interview coordination email:', err);
				});
			}
		}

		return NextResponse.json({ ok: true });
	} catch (error: any) {
		console.error('Error updating application stage:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to update stage' },
			{ status: 400 }
		);
	}
}

