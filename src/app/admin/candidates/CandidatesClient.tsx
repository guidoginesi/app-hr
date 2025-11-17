'use client';

import { useState } from 'react';
import { Modal } from '../Modal';
import { CandidateDetailModal } from './CandidateDetailModal';
import { AddCandidateModal } from './AddCandidateModal';

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

type Job = {
	id: string;
	title: string;
	department?: string | null;
};

type CandidatesClientProps = {
	candidates: Candidate[];
	jobs: Job[];
};

export function CandidatesClient({ candidates, jobs }: CandidatesClientProps) {
	const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
					<div className="border-b border-zinc-200 px-6 py-4">
						<h2 className="text-base font-semibold text-zinc-900">Lista de candidatos</h2>
						<p className="mt-1 text-xs text-zinc-500">
							{candidates.reduce((acc, c) => acc + c.applications.length, 0)} aplicaciones totales
						</p>
					</div>
					<ul className="divide-y divide-zinc-200">
						{candidates.length > 0 ? (
							candidates.flatMap((candidate) =>
								candidate.applications.length > 0
									? candidate.applications.map((app) => (
											<li key={app.id} className="px-6 py-4 transition-colors hover:bg-zinc-50">
												<div className="flex items-center justify-between gap-4">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2.5">
															<h3 className="text-base font-semibold text-zinc-900">{candidate.name}</h3>
															<span className="text-sm text-zinc-400">·</span>
															<span className="text-sm font-medium text-zinc-600">{app.job_title}</span>
															{app.job_department && (
																<>
																	<span className="text-xs text-zinc-400">·</span>
																	<span className="text-xs text-zinc-500">{app.job_department}</span>
																</>
															)}
														</div>
														<div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
															<span>{candidate.email}</span>
															<span
																className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
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
																<span className="font-medium text-zinc-600">
																	Score: <span className="font-semibold text-black">{app.ai_score}/100</span>
																</span>
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
									: []
							)
						) : (
							<li className="px-6 py-12 text-center">
								<p className="text-sm font-medium text-zinc-500">No hay candidatos registrados todavía</p>
								<p className="mt-1 text-xs text-zinc-400">Los candidatos aparecerán aquí cuando se postulen desde la landing</p>
							</li>
						)}
					</ul>
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

