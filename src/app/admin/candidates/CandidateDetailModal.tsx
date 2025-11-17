'use client';

import { Modal } from '../Modal';

type Application = {
	id: string;
	job_id: string;
	job_title: string;
	job_department: string | null;
	status: string;
	ai_score: number | null;
	resume_url: string;
	created_at: string;
	ai_extracted?: any;
	ai_reasons?: string[] | null;
	ai_match_highlights?: string[] | null;
};

type Candidate = {
	id: string;
	name: string;
	email: string;
	linkedin_url: string | null;
	created_at: string;
	applications: Application[];
};

type CandidateDetailModalProps = {
	candidate: Candidate;
	onClose: () => void;
};

export function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
	return (
		<Modal isOpen={true} onClose={onClose} title={`Candidato: ${candidate.name}`}>
			<div className="space-y-6">
				{/* Información personal */}
				<div>
					<h3 className="text-sm font-semibold text-zinc-900">Información personal</h3>
					<div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-500">Nombre</span>
							<span className="text-sm font-medium text-zinc-900">{candidate.name}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-500">Email</span>
							<a
								href={`mailto:${candidate.email}`}
								className="text-sm font-medium text-black hover:underline"
							>
								{candidate.email}
							</a>
						</div>
						{candidate.linkedin_url && (
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-zinc-500">LinkedIn</span>
								<a
									href={candidate.linkedin_url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium text-black hover:underline"
								>
									Ver perfil
								</a>
							</div>
						)}
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-500">Registrado</span>
							<span className="text-sm font-medium text-zinc-900">
								{new Date(candidate.created_at).toLocaleDateString('es-AR', {
									day: 'numeric',
									month: 'long',
									year: 'numeric'
								})}
							</span>
						</div>
					</div>
				</div>

				{/* Aplicaciones */}
				<div>
					<h3 className="text-sm font-semibold text-zinc-900">
						Aplicaciones ({candidate.applications.length})
					</h3>
					<div className="mt-3 space-y-4">
						{candidate.applications.map((app) => (
							<div
								key={app.id}
								className="rounded-lg border border-zinc-200 bg-white p-4"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2.5">
											<h4 className="text-base font-semibold text-zinc-900">{app.job_title}</h4>
											{app.job_department && (
												<span className="text-xs text-zinc-500">· {app.job_department}</span>
											)}
										</div>
										<div className="mt-2 flex items-center gap-3">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
													app.status === 'Analizado por IA'
														? 'bg-black text-white'
														: app.status === 'Recibido'
														? 'bg-zinc-100 text-zinc-700'
														: 'bg-zinc-50 text-zinc-600'
												}`}
											>
												{app.status}
											</span>
											{app.ai_score !== null && (
												<span className="text-xs font-medium text-zinc-600">
													Score IA: <span className="font-semibold text-black">{app.ai_score}/100</span>
												</span>
											)}
										</div>
										{app.ai_extracted && (
											<div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
												<p className="mb-2 text-xs font-semibold text-zinc-700">Información extraída por IA:</p>
												<div className="space-y-1 text-xs text-zinc-600">
													{app.ai_extracted.cargo_actual && (
														<p><span className="font-medium">Cargo actual:</span> {app.ai_extracted.cargo_actual}</p>
													)}
													{app.ai_extracted.anos_experiencia && (
														<p><span className="font-medium">Años de experiencia:</span> {app.ai_extracted.anos_experiencia}</p>
													)}
													{app.ai_extracted.nivel_ingles && (
														<p><span className="font-medium">Nivel de inglés:</span> {app.ai_extracted.nivel_ingles}</p>
													)}
													{app.ai_extracted.provincia && (
														<p><span className="font-medium">Provincia:</span> {app.ai_extracted.provincia}</p>
													)}
													{app.ai_extracted.expectativa_salarial && (
														<p><span className="font-medium">Expectativa salarial:</span> {app.ai_extracted.expectativa_salarial}</p>
													)}
												</div>
											</div>
										)}
										{app.ai_reasons && app.ai_reasons.length > 0 && (
											<div className="mt-3">
												<p className="mb-1 text-xs font-semibold text-zinc-700">Razones del score:</p>
												<ul className="space-y-1 text-xs text-zinc-600">
													{app.ai_reasons.map((reason, idx) => (
														<li key={idx} className="flex items-start gap-2">
															<span className="mt-0.5">•</span>
															<span>{reason}</span>
														</li>
													))}
												</ul>
											</div>
										)}
										<p className="mt-3 text-xs text-zinc-400">
											Aplicó el {new Date(app.created_at).toLocaleDateString('es-AR', {
												day: 'numeric',
												month: 'long',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
									</div>
									<div className="ml-4">
										<a
											href={app.resume_url}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-black"
										>
											Ver CV
										</a>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</Modal>
	);
}

