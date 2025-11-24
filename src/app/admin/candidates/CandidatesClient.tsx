'use client';

import { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { CandidateDetailModal } from './CandidateDetailModal';
import { AddCandidateModal } from './AddCandidateModal';
import { Stage, StageStatus, StageLabels, StageStatusLabels } from '@/types/funnel';

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

type Job = {
	id: string;
	title: string;
	department?: string | null;
};

type CandidatesClientProps = {
	candidates: Candidate[];
	jobs: Job[];
};

const ITEMS_PER_PAGE = 25;

// Función para calcular el tiempo transcurrido de forma legible
function getTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	if (diffDays > 30) {
		const months = Math.floor(diffDays / 30);
		return `${months} ${months === 1 ? 'mes' : 'meses'}`;
	} else if (diffDays > 0) {
		return `${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
	} else if (diffHours > 0) {
		return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
	} else if (diffMinutes > 0) {
		return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
	} else {
		return 'recién';
	}
}

// Función para obtener el tiempo en la etapa actual
function getTimeInCurrentStage(application: Application): string {
	if (!application.current_stage || !application.stage_history || application.stage_history.length === 0) {
		// Si no hay historial, usar created_at como referencia
		return getTimeAgo(application.created_at);
	}

	// El historial está ordenado DESC (más reciente primero)
	// Buscar la ÚLTIMA entrada (más antigua) donde llegó a la etapa actual
	// Esto nos da cuándo entró por primera vez a esta etapa
	let currentStageEntry = null;
	for (let i = application.stage_history.length - 1; i >= 0; i--) {
		if (application.stage_history[i].to_stage === application.current_stage) {
			currentStageEntry = application.stage_history[i];
			break;
		}
	}

	if (currentStageEntry) {
		return getTimeAgo(currentStageEntry.changed_at);
	}

	// Si no se encuentra, usar created_at
	return getTimeAgo(application.created_at);
}

export function CandidatesClient({ candidates, jobs }: CandidatesClientProps) {
	const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [stageFilter, setStageFilter] = useState<Stage | 'ALL' | 'DISCARDED'>('ALL');
	const [jobFilter, setJobFilter] = useState<string>('ALL');
	const [currentPage, setCurrentPage] = useState(1);

	// Aplanar candidatos con sus aplicaciones para facilitar el filtrado
	const flattenedApplications = useMemo(() => {
		return candidates.flatMap((candidate) =>
			candidate.applications.length > 0
				? candidate.applications.map((app) => ({
						candidate,
						application: app,
					}))
				: []
		);
	}, [candidates]);

	// Obtener lista única de búsquedas
	const uniqueJobs = useMemo(() => {
		const jobsMap = new Map<string, { id: string; title: string; department: string | null }>();
		flattenedApplications.forEach(({ application }) => {
			if (!jobsMap.has(application.job_id)) {
				jobsMap.set(application.job_id, {
					id: application.job_id,
					title: application.job_title,
					department: application.job_department,
				});
			}
		});
		return Array.from(jobsMap.values()).sort((a, b) => a.title.localeCompare(b.title));
	}, [flattenedApplications]);

	// Filtrar aplicaciones
	const filteredApplications = useMemo(() => {
		let filtered = flattenedApplications;

		// Filtro por búsqueda de texto
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				({ candidate, application }) =>
					candidate.name.toLowerCase().includes(query) ||
					candidate.email.toLowerCase().includes(query) ||
					application.job_title.toLowerCase().includes(query) ||
					(application.job_department && application.job_department.toLowerCase().includes(query))
			);
		}

		// Filtro por búsqueda/job
		if (jobFilter !== 'ALL') {
			filtered = filtered.filter(({ application }) => application.job_id === jobFilter);
		}

		// Filtro por etapa
		if (stageFilter === 'DISCARDED') {
			// Mostrar todos los descartados independientemente de la etapa
			filtered = filtered.filter(({ application }) => application.current_stage_status === 'DISCARDED_IN_STAGE');
		} else if (stageFilter !== 'ALL') {
			filtered = filtered.filter(({ application }) => application.current_stage === stageFilter);
		}

		return filtered;
	}, [flattenedApplications, searchQuery, jobFilter, stageFilter]);

	// Calcular paginación
	const totalPages = Math.ceil(filteredApplications.length / ITEMS_PER_PAGE);
	const paginatedApplications = useMemo(() => {
		const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
		return filteredApplications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
	}, [filteredApplications, currentPage]);

	// Reset página cuando cambian los filtros
	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setCurrentPage(1);
	};

	const handleJobFilterChange = (value: string) => {
		setJobFilter(value);
		setCurrentPage(1);
	};

	const handleStageFilterChange = (value: Stage | 'ALL' | 'DISCARDED') => {
		setStageFilter(value);
		setCurrentPage(1);
	};

	return (
		<>
			<div className="space-y-8">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Candidatos</h1>
						<p className="mt-1 text-sm text-zinc-500">
							{candidates.length} candidatos registrados en el sistema
						</p>
					</div>
					<button
						type="button"
						onClick={() => setIsAddModalOpen(true)}
						className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md"
					>
						Agregar candidato
					</button>
				</div>

				<div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
					{/* Filtros */}
					<div className="border-b border-zinc-200 px-6 py-4 space-y-4">
						<div>
							<h2 className="text-base font-semibold text-zinc-900">Lista de candidatos</h2>
							<p className="mt-1 text-xs text-zinc-500">
								{filteredApplications.length} de {flattenedApplications.length} aplicaciones
							</p>
						</div>
						
						<div className="flex flex-col lg:flex-row gap-3">
							{/* Búsqueda de texto */}
							<div className="flex-1">
								<input
									type="text"
									placeholder="Buscar por nombre, email..."
									value={searchQuery}
									onChange={(e) => handleSearchChange(e.target.value)}
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								/>
							</div>

							{/* Filtro por búsqueda/job */}
							<div className="lg:w-64">
								<select
									value={jobFilter}
									onChange={(e) => handleJobFilterChange(e.target.value)}
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								>
									<option value="ALL">Todas las búsquedas</option>
									{uniqueJobs.map((job) => (
										<option key={job.id} value={job.id}>
											{job.title}
										</option>
									))}
								</select>
							</div>

							{/* Filtro por etapa */}
							<div className="lg:w-64">
								<select
									value={stageFilter}
									onChange={(e) => handleStageFilterChange(e.target.value as Stage | 'ALL' | 'DISCARDED')}
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								>
									<option value="ALL">Todas las etapas</option>
									{Object.entries(StageLabels)
										.filter(([stage]) => stage !== 'CV_RECEIVED')
										.map(([stage, label]) => (
											<option key={stage} value={stage}>
												{label}
											</option>
										))}
									<option value="DISCARDED">Descartados</option>
								</select>
							</div>
						</div>
					</div>

					{/* Lista de candidatos */}
					<ul className="divide-y divide-zinc-200">
						{paginatedApplications.length > 0 ? (
							paginatedApplications.map(({ candidate, application }) => (
								<li key={application.id} className="px-6 py-4 transition-colors hover:bg-zinc-50">
									<div className="flex items-center justify-between gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2.5 flex-wrap">
												<h3 className="text-base font-semibold text-zinc-900">{candidate.name}</h3>
												<span className="text-sm text-zinc-400">·</span>
												<span className="text-sm font-medium text-zinc-600">{application.job_title}</span>
												{application.job_department && (
													<>
														<span className="text-xs text-zinc-400">·</span>
														<span className="text-xs text-zinc-500">{application.job_department}</span>
													</>
												)}
												
												{/* Badge de etapa y estado */}
												<span className="text-xs text-zinc-400">·</span>
												{application.current_stage && application.current_stage_status ? (
													<span
														className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
															application.current_stage_status === 'DISCARDED_IN_STAGE'
																? 'bg-red-100 text-red-700'
																: application.current_stage_status === 'COMPLETED'
																? 'bg-green-100 text-green-700'
																: application.current_stage_status === 'PENDING'
																? 'bg-yellow-100 text-yellow-700'
																: 'bg-zinc-100 text-zinc-700'
														}`}
													>
														{StageLabels[application.current_stage]} - {StageStatusLabels[application.current_stage_status]}
													</span>
												) : (
													<span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
														{application.status || 'Sin estado'}
													</span>
												)}
												
												{/* AI Score */}
												{application.ai_score !== null && (
													<>
														<span className="text-xs text-zinc-400">·</span>
														<span className="text-xs font-medium text-zinc-600">
															Score: <span className="font-semibold text-black">{application.ai_score}/100</span>
														</span>
													</>
												)}
											</div>
											<div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
												<span>{candidate.email}</span>
												<span className="text-zinc-300">·</span>
												
												{/* Tiempo desde que aplicó */}
												<span className="inline-flex items-center gap-1">
													<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
													</svg>
													Aplicó hace {getTimeAgo(application.created_at)}
												</span>
												
												{/* Tiempo en etapa actual */}
												{application.current_stage && (
													<>
														<span className="text-zinc-300">·</span>
														<span className="inline-flex items-center gap-1">
															<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
															</svg>
															En etapa {getTimeInCurrentStage(application)}
														</span>
													</>
												)}
											</div>
										</div>
										<button
											type="button"
											onClick={() => setSelectedCandidate(candidate)}
											className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-black"
										>
											Ver candidato
										</button>
									</div>
								</li>
							))
						) : (
							<li className="px-6 py-12 text-center">
								<p className="text-sm font-medium text-zinc-500">
									{flattenedApplications.length === 0
										? 'No hay candidatos registrados todavía'
										: 'No se encontraron candidatos con los filtros aplicados'}
								</p>
								<p className="mt-1 text-xs text-zinc-400">
									{flattenedApplications.length === 0
										? 'Los candidatos aparecerán aquí cuando se postulen desde la landing'
										: 'Intenta cambiar los filtros de búsqueda'}
								</p>
							</li>
						)}
					</ul>

					{/* Paginación inferior */}
					{totalPages > 1 && (
						<div className="border-t border-zinc-200 px-6 py-3 bg-zinc-50">
							<div className="flex items-center justify-between">
								<div className="text-sm text-zinc-600">
									Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredApplications.length)} de {filteredApplications.length} resultados
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage === 1}
										className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
									>
										Anterior
									</button>
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
										disabled={currentPage === totalPages}
										className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
									>
										Siguiente
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Modal de detalle del candidato */}
			{selectedCandidate && (
				<CandidateDetailModal
					candidate={selectedCandidate}
					onClose={() => setSelectedCandidate(null)}
				/>
			)}

			{/* Modal para agregar candidato */}
			<AddCandidateModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
				jobs={jobs}
			/>
		</>
	);
}

