'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../Modal';
import { PipelineView } from './PipelineView';
import { Stage, StageStatus, OfferStatus, FinalOutcome, RejectionReason, StageLabels, StageStatusLabels } from '@/types/funnel';
import { formatCurrency } from '@/lib/formatCurrency';

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

type Application = {
	id: string;
	job_id: string;
	job_title: string;
	job_department: string | null;
	status: string;
	ai_score: number | null;
	resume_url: string;
	created_at: string;
	salary_expectation?: string | null;
	english_level?: string | null;
	ai_extracted?: any;
	ai_reasons?: string[] | null;
	ai_match_highlights?: string[] | null;
	current_stage?: Stage;
	current_stage_status?: StageStatus;
	offer_status?: OfferStatus | null;
	final_outcome?: FinalOutcome | null;
	final_rejection_reason?: RejectionReason | null;
	stage_history?: StageHistory[];
};

type Candidate = {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	provincia: string | null;
	linkedin_url: string | null;
	created_at: string;
	applications: Application[];
};

type CandidateDetailModalProps = {
	candidate: Candidate;
	onClose: () => void;
};

type Tab = 'ai' | 'history' | 'cv' | 'notes';

export function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
	const router = useRouter();
	const [refreshKey, setRefreshKey] = useState(0);
	const [currentCandidate, setCurrentCandidate] = useState(candidate);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<Tab>('history');
	const [notes, setNotes] = useState('');

	// Cargar datos actualizados cuando se abre el modal
	useEffect(() => {
		async function loadCandidateData() {
			try {
				const res = await fetch(`/api/admin/candidates/${candidate.id}`);
				if (res.ok) {
					const updatedCandidate = await res.json();
					setCurrentCandidate(updatedCandidate);
					console.log('Candidato cargado:', updatedCandidate);
					console.log('Aplicaciones:', updatedCandidate.applications);
					if (updatedCandidate.applications.length > 0) {
						console.log('Historial:', updatedCandidate.applications[0].stage_history);
					}
				}
			} catch (error) {
				console.error('Error loading candidate:', error);
			}
		}
		loadCandidateData();
	}, [candidate.id]);

	const displayCandidate = currentCandidate || candidate;
	const mainApplication = displayCandidate.applications.length > 0 ? displayCandidate.applications[0] : null;
	
	// Debug log
	if (mainApplication) {
		console.log('Main application:', mainApplication);
		console.log('Stage history:', mainApplication.stage_history);
	}

	async function handlePipelineUpdate() {
		setLoading(true);
		setRefreshKey((k) => k + 1);
		
		// Recargar los datos del candidato desde el servidor
		try {
			const res = await fetch(`/api/admin/candidates/${candidate.id}`);
			if (res.ok) {
				const updatedCandidate = await res.json();
				setCurrentCandidate(updatedCandidate);
			}
		} catch (error) {
			console.error('Error reloading candidate:', error);
		} finally {
			setLoading(false);
			router.refresh();
		}
	}

	async function handleSaveNotes() {
		if (!mainApplication) return;
		
		try {
			// TODO: Implementar endpoint para guardar notas del reclutador
			// Por ahora solo mostramos un mensaje
			alert('Funcionalidad de notas próximamente disponible');
		} catch (error) {
			console.error('Error saving notes:', error);
		}
	}

	const currentStageLabel = mainApplication?.current_stage 
		? StageLabels[mainApplication.current_stage] 
		: 'Sin etapa';

	return (
		<Modal isOpen={true} onClose={onClose} title="" maxWidth="max-w-6xl">
			{loading && (
				<div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
					<p className="text-xs text-zinc-600">Actualizando datos...</p>
				</div>
			)}

			{/* Header */}
			<div className="mb-6">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-bold text-zinc-900">{displayCandidate.name}</h2>
						{mainApplication && (
							<div className="flex items-center gap-2 mt-1">
								<svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								<p className="text-sm text-zinc-600">{mainApplication.job_title}</p>
							</div>
						)}
					</div>
					{mainApplication?.current_stage && (
						<div className="flex items-center gap-2">
							<span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
								{currentStageLabel}
								<button
									type="button"
									onClick={() => {}}
									className="text-yellow-600 hover:text-yellow-800"
								>
									<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Tres tarjetas horizontales */}
			<div className="grid grid-cols-3 gap-4 mb-6">
				{/* Información de Contacto */}
				<div className="rounded-lg border border-zinc-200 bg-white p-4">
					<div className="flex items-center gap-2 mb-3">
						<svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
						<h3 className="text-sm font-semibold text-zinc-900">Información de Contacto</h3>
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							<a href={`mailto:${displayCandidate.email}`} className="text-sm text-zinc-700 hover:text-black">
								{displayCandidate.email}
							</a>
						</div>
						{displayCandidate.phone && (
							<div className="flex items-center gap-2">
								<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
								</svg>
								<a href={`tel:${displayCandidate.phone}`} className="text-sm text-zinc-700 hover:text-black">
									{displayCandidate.phone}
								</a>
							</div>
						)}
						{displayCandidate.provincia && (
							<div className="flex items-center gap-2">
								<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<span className="text-sm text-zinc-700">{displayCandidate.provincia}</span>
							</div>
						)}
					</div>
				</div>

				{/* Datos de la Aplicación */}
				<div className="rounded-lg border border-zinc-200 bg-white p-4">
					<div className="flex items-center gap-2 mb-3">
						<svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
						<h3 className="text-sm font-semibold text-zinc-900">Datos de la Aplicación</h3>
					</div>
					<div className="space-y-2">
						{mainApplication && (
							<>
								<div className="flex items-center gap-2">
									<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<span className="text-sm text-zinc-700">
										{new Date(mainApplication.created_at).toLocaleDateString('es-AR', {
											day: 'numeric',
											month: 'long',
											year: 'numeric'
										})}
									</span>
								</div>
								{mainApplication.salary_expectation && (
									<div className="flex items-center gap-2">
										<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span className="text-sm text-zinc-700">Expectativa salarial: {formatCurrency(mainApplication.salary_expectation)}</span>
									</div>
								)}
								{mainApplication.english_level && (
									<div className="flex items-center gap-2">
										<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
										</svg>
										<span className="text-sm text-zinc-700">Nivel de inglés: {mainApplication.english_level}</span>
									</div>
								)}
							</>
						)}
					</div>
				</div>

				{/* Enlaces Externos */}
				<div className="rounded-lg border border-zinc-200 bg-white p-4">
					<div className="flex items-center gap-2 mb-3">
						<svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
						</svg>
						<h3 className="text-sm font-semibold text-zinc-900">Enlaces Externos</h3>
					</div>
					<div className="space-y-2">
						{displayCandidate.linkedin_url ? (
							<a
								href={displayCandidate.linkedin_url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
							>
								<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
								</svg>
								LinkedIn
							</a>
						) : (
							<p className="text-sm text-zinc-400">Sin LinkedIn registrado</p>
						)}
						{mainApplication?.resume_url && (
							<a
								href={mainApplication.resume_url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-zinc-700 hover:text-black"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Ver CV
							</a>
						)}
						{!displayCandidate.linkedin_url && !mainApplication?.resume_url && (
							<p className="text-sm text-zinc-400">Sin enlaces registrados</p>
						)}
					</div>
				</div>
			</div>

			{/* Pipeline de Selección */}
			{mainApplication?.current_stage && (
				<div className="mb-6">
					<PipelineView
						application={{
							id: mainApplication.id,
							current_stage: mainApplication.current_stage,
							current_stage_status: mainApplication.current_stage_status!,
							offer_status: mainApplication.offer_status || null,
							final_outcome: mainApplication.final_outcome || null,
							final_rejection_reason: mainApplication.final_rejection_reason || null
						}}
						onUpdate={handlePipelineUpdate}
					/>
				</div>
			)}

			{/* Tabs */}
			<div className="mb-4">
				<div className="flex gap-1 border-b border-zinc-200">
					<button
						type="button"
						onClick={() => setActiveTab('history')}
						className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'history'
								? 'border-b-2 border-black text-black'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Historial
					</button>
					<button
						type="button"
						onClick={() => setActiveTab('cv')}
						className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'cv'
								? 'border-b-2 border-black text-black'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						CVs
					</button>
					<button
						type="button"
						onClick={() => setActiveTab('notes')}
						className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'notes'
								? 'border-b-2 border-black text-black'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
						</svg>
						Notas
					</button>
				</div>
			</div>

			{/* Contenido de los tabs */}
			<div className="min-h-[300px]">
				{activeTab === 'history' && (
					<div className="space-y-3">
						{mainApplication?.stage_history && mainApplication.stage_history.length > 0 ? (
							mainApplication.stage_history.map((entry) => {
								const changedDate = new Date(entry.changed_at);
								const dateStr = changedDate.toLocaleDateString('es-AR', {
									day: 'numeric',
									month: 'long',
									year: 'numeric'
								});
								const timeStr = changedDate.toLocaleTimeString('es-AR', {
									hour: '2-digit',
									minute: '2-digit'
								});
								
								return (
									<div key={entry.id} className="rounded-lg border border-zinc-200 bg-white p-4">
										<div className="flex items-center justify-between gap-4">
											<div className="flex-1 flex items-center gap-3">
												<div className="flex items-center gap-2">
													{entry.from_stage && (
														<>
															<span className="text-sm text-zinc-500">
																{StageLabels[entry.from_stage]}
															</span>
															<svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
															</svg>
														</>
													)}
													<span className="text-sm font-semibold text-zinc-900">
														{StageLabels[entry.to_stage]}
													</span>
													<span className="text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-100">
														{StageStatusLabels[entry.status]}
													</span>
												</div>
												<div className="flex items-center gap-2 text-xs text-zinc-500">
													<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
													</svg>
													<span className="font-medium">{dateStr}</span>
													<span>a las</span>
													<span className="font-medium">{timeStr}</span>
												</div>
											</div>
											{entry.notes && (
												<div className="flex-shrink-0 text-right">
													<p className="text-xs font-medium text-zinc-500 mb-0.5">Notas:</p>
													<p className="text-sm text-zinc-700 max-w-xs">{entry.notes}</p>
												</div>
											)}
										</div>
									</div>
								);
							})
						) : (
							<div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
								<p className="text-sm text-zinc-500">No hay historial disponible</p>
							</div>
						)}
					</div>
				)}

				{activeTab === 'cv' && (
					<div>
						{mainApplication?.resume_url ? (
							<div className="rounded-lg border border-zinc-200 bg-white p-4">
								<a
									href={mainApplication.resume_url}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									Ver CV
								</a>
							</div>
						) : (
							<div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
								<p className="text-sm text-zinc-500">No hay CV disponible</p>
							</div>
						)}
					</div>
				)}

				{activeTab === 'notes' && (
					<div className="space-y-4">
						<div className="rounded-lg border border-zinc-200 bg-white p-4">
							<h4 className="text-sm font-semibold text-zinc-900 mb-3">Notas del Reclutador</h4>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={8}
								className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
								placeholder="Escribe tus notas sobre este candidato..."
							/>
							<div className="mt-4">
								<button
									type="button"
									onClick={handleSaveNotes}
									className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									Guardar Notas
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
