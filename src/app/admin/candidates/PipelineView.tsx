'use client';

import { useState, useTransition } from 'react';
import {
	Stage,
	StageStatus,
	OfferStatus,
	FinalOutcome,
	RejectionReason,
	STAGE_ORDER,
	StageLabels,
	StageStatusLabels,
	OfferStatusLabels,
	FinalOutcomeLabels,
	RejectionReasonLabels
} from '@/types/funnel';
import {
	isValidTransition,
	requiresOfferStatus,
	canHaveFinalOutcome,
	getValidRejectionReasons
} from '@/lib/funnel';

type StageHistory = {
	id: string;
	application_id: string;
	from_stage: Stage | null;
	to_stage: Stage;
	status: StageStatus;
	changed_by_user_id: string | null;
	changed_at: string;
	notes: string | null;
};

type ApplicationWithPipeline = {
	id: string;
	current_stage: Stage;
	current_stage_status: StageStatus;
	offer_status: OfferStatus | null;
	final_outcome: FinalOutcome | null;
	final_rejection_reason: RejectionReason | null;
	stage_history?: StageHistory[];
};

type PipelineViewProps = {
	application: ApplicationWithPipeline;
	onUpdate: () => void;
};

// Función para calcular tiempo en una etapa
function getTimeInStage(stageHistory: StageHistory[], stage: Stage): string | null {
	if (!stageHistory || stageHistory.length === 0) return null;
	
	// El historial está ordenado DESC (más reciente primero, index 0)
	// Convertir a array ordenado ASC para facilitar el procesamiento
	const historyAsc = [...stageHistory].reverse();
	
	// Buscar cuando entró a esta etapa
	const entryIndex = historyAsc.findIndex(h => h.to_stage === stage);
	if (entryIndex === -1) return null;
	
	const entry = historyAsc[entryIndex];
	const entryDate = new Date(entry.changed_at);
	
	// Buscar cuando salió de esta etapa
	// La salida es la siguiente entrada en el historial (donde from_stage === stage)
	let exitDate = new Date(); // Por defecto: ahora (aún está en esta etapa)
	
	for (let i = entryIndex + 1; i < historyAsc.length; i++) {
		if (historyAsc[i].from_stage === stage) {
			exitDate = new Date(historyAsc[i].changed_at);
			break;
		}
	}
	
	// Calcular duración
	const diffMs = exitDate.getTime() - entryDate.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	
	if (diffDays > 30) {
		const months = Math.floor(diffDays / 30);
		return `${months} ${months === 1 ? 'mes' : 'meses'}`;
	} else if (diffDays > 0) {
		return diffHours > 0 ? `${diffDays}d ${diffHours}h` : `${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
	} else if (diffHours > 0) {
		return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
	} else {
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		if (diffMinutes < 1) return '< 1 min';
		return `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'}`;
	}
}

export function PipelineView({ application, onUpdate }: PipelineViewProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [loading, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Si el estado actual es IN_PROGRESS o ON_HOLD, usar PENDING como default
	const initialStatus: StageStatus = 
		application.current_stage_status === StageStatus.IN_PROGRESS || 
		application.current_stage_status === StageStatus.ON_HOLD
			? StageStatus.PENDING
			: application.current_stage_status;

	const [formData, setFormData] = useState<{
		to_stage: Stage;
		status: StageStatus;
		offer_status: OfferStatus | null;
		final_outcome: FinalOutcome | null;
		final_rejection_reason: RejectionReason | null;
		notes: string;
	}>({
		to_stage: application.current_stage,
		status: initialStatus,
		offer_status: application.offer_status || null,
		final_outcome: application.final_outcome || null,
		final_rejection_reason: application.final_rejection_reason || null,
		notes: ''
	});

	const currentStageIndex = STAGE_ORDER.indexOf(application.current_stage);
	const isDiscarded = application.current_stage_status === StageStatus.DISCARDED_IN_STAGE;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		// Validaciones
		if (requiresOfferStatus(formData.to_stage) && !formData.offer_status) {
			setError('El estado de oferta es requerido para esta etapa');
			return;
		}

		if (canHaveFinalOutcome(formData.to_stage) && !formData.final_outcome) {
			setError('El resultado final es requerido al cerrar una aplicación');
			return;
		}

		// Si está descartado, no permitir avanzar
		if (isDiscarded && formData.to_stage !== application.current_stage) {
			setError('No se puede cambiar de etapa cuando el candidato está descartado');
			return;
		}

		if (!isValidTransition(application.current_stage, formData.to_stage)) {
			setError('Transición de etapa inválida');
			return;
		}

		try {
			console.log('Sending update:', formData);
			const res = await fetch(`/api/admin/applications/${application.id}/stage`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json().catch(() => null);
			console.log('Response:', { status: res.status, data });

			if (!res.ok) {
				setError(data?.error ?? 'Error al actualizar la etapa');
				return;
			}

			startTransition(() => {
				onUpdate();
				setIsEditing(false);
			});
		} catch (err) {
			console.error('Error updating stage:', err);
			setError('Error de conexión. Por favor intenta nuevamente.');
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-semibold text-foreground">Pipeline de Selección</h4>
				{!isEditing && !isDiscarded && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-black"
					>
						Editar etapa
					</button>
				)}
				{isDiscarded && (
					<span className="text-xs font-medium text-[var(--red-600)]">Candidato descartado</span>
				)}
			</div>

			{/* Visualización del funnel - horizontal mejorado */}
			<div className="overflow-x-auto pb-4">
				<div className="flex gap-3 min-w-max">
					{STAGE_ORDER.map((stage, index) => {
						const isPast = index < currentStageIndex;
						const isCurrent = index === currentStageIndex;
						const isFuture = index > currentStageIndex;
						const isFutureAndDiscarded = isFuture && isDiscarded;
						const timeInStage = application.stage_history ? getTimeInStage(application.stage_history, stage) : null;

						return (
							<div key={stage} className="flex items-center">
								{/* Etapa */}
								<div
									className={`flex flex-col items-center min-w-[140px] ${
										isCurrent ? 'opacity-100' : isPast ? 'opacity-70' : isFutureAndDiscarded ? 'opacity-60' : 'opacity-40'
									}`}
								>
									<div
										className={`w-full rounded-lg px-3 py-2.5 text-center transition-all ${
											isCurrent
												? isDiscarded
													? 'bg-danger-subtle text-[var(--red-600)] shadow-md'
													: 'bg-black text-white shadow-md'
												: isPast
												? 'bg-secondary text-secondary-foreground'
												: isFutureAndDiscarded
												? 'bg-danger-subtle text-[var(--red-600)] border border-danger/20'
												: 'bg-secondary text-muted-foreground'
										}`}
									>
										<p className="text-xs font-semibold leading-tight">{StageLabels[stage]}</p>
										{isCurrent && (
											<p className="text-[10px] mt-1 opacity-90">
												{StageStatusLabels[application.current_stage_status]}
											</p>
										)}
									</div>
									
									{/* Tiempo en la etapa */}
									{(isPast || isCurrent) && timeInStage && (
										<div className="mt-1.5 flex items-center gap-1">
											<svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<span className="text-[10px] text-muted-foreground font-medium">
												{timeInStage}
											</span>
										</div>
									)}
								</div>
								{/* Flecha conectora */}
								{index < STAGE_ORDER.length - 1 && (
									<div className="flex items-center mx-1">
										<div
											className={`h-0.5 w-8 ${
												isFutureAndDiscarded
													? 'bg-danger-subtle'
													: isPast || isCurrent
													? 'bg-secondary'
													: 'bg-secondary'
											}`}
										/>
										<div
											className={`w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent ${
												isFutureAndDiscarded
													? 'border-l-danger/30'
													: isPast || isCurrent
													? 'border-l-[var(--border)]'
													: 'border-l-[var(--border)]'
											}`}
										/>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Formulario de edición */}
			{isEditing && (
				<form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
					<div>
						<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Nueva etapa</label>
						<select
							value={formData.to_stage}
							onChange={(e) => setFormData({ ...formData, to_stage: e.target.value as Stage })}
							className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							required
						>
							{STAGE_ORDER.map((stage) => (
								<option key={stage} value={stage}>
									{StageLabels[stage]}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Estado dentro de la etapa</label>
						<select
							value={formData.status}
							onChange={(e) => {
								const newStatus = e.target.value as StageStatus;
								setFormData((prev) => ({ ...prev, status: newStatus }));
							}}
							className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							required
						>
							{Object.values(StageStatus)
								.filter((status) => status !== StageStatus.IN_PROGRESS && status !== StageStatus.ON_HOLD)
								.map((status) => (
									<option key={status} value={status}>
										{StageStatusLabels[status]}
									</option>
								))}
						</select>
					</div>

					{requiresOfferStatus(formData.to_stage) && (
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Estado de oferta</label>
							<select
								value={formData.offer_status || ''}
								onChange={(e) =>
									setFormData({
										...formData,
										offer_status: (e.target.value || null) as OfferStatus | null
									})
								}
								className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
								required
							>
								<option value="">Selecciona...</option>
								{Object.values(OfferStatus).map((status) => (
									<option key={status} value={status}>
										{OfferStatusLabels[status]}
									</option>
								))}
							</select>
						</div>
					)}

					{canHaveFinalOutcome(formData.to_stage) && (
						<>
							<div>
								<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Resultado final</label>
								<select
									value={formData.final_outcome || ''}
									onChange={(e) =>
										setFormData({
											...formData,
											final_outcome: (e.target.value || null) as FinalOutcome | null
										})
									}
									className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
									required
								>
									<option value="">Selecciona...</option>
									{Object.values(FinalOutcome).map((outcome) => (
										<option key={outcome} value={outcome}>
											{FinalOutcomeLabels[outcome]}
										</option>
									))}
								</select>
							</div>

							{formData.final_outcome &&
								(formData.final_outcome === FinalOutcome.REJECTED_BY_POW ||
									formData.final_outcome === FinalOutcome.REJECTED_BY_CANDIDATE) && (
									<div>
										<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">
											Motivo de rechazo
										</label>
										<select
											value={formData.final_rejection_reason || ''}
											onChange={(e) =>
												setFormData({
													...formData,
													final_rejection_reason: (e.target.value || null) as RejectionReason | null
												})
											}
											className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
										>
											<option value="">Opcional</option>
											{getValidRejectionReasons(formData.final_outcome).map((reason) => {
												const reasonEnum = reason as RejectionReason;
												return (
													<option key={reasonEnum} value={reasonEnum}>
														{RejectionReasonLabels[reasonEnum]}
													</option>
												);
											})}
										</select>
									</div>
								)}
						</>
					)}

					<div>
						<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Notas (opcional)</label>
						<textarea
							value={formData.notes}
							onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
							rows={2}
							className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							placeholder="Agregar notas sobre este cambio..."
						/>
					</div>

					{error && (
						<div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
							<p className="text-xs font-medium text-[var(--red-600)]">{error}</p>
						</div>
					)}

					<div className="flex gap-3 pt-2">
						<button
							type="submit"
							disabled={loading}
							className="flex-1 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-secondary hover:shadow-md disabled:opacity-50"
						>
							{loading ? 'Guardando...' : 'Guardar cambios'}
						</button>
						<button
							type="button"
							onClick={() => {
								setIsEditing(false);
								setError(null);
								setFormData({
									to_stage: application.current_stage,
									status: initialStatus,
									offer_status: application.offer_status || null,
									final_outcome: application.final_outcome || null,
									final_rejection_reason: application.final_rejection_reason || null,
									notes: ''
								});
							}}
							disabled={loading}
							className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-secondary-foreground transition-all hover:bg-muted disabled:opacity-50"
						>
							Cancelar
						</button>
					</div>
				</form>
			)}
		</div>
	);
}

