'use client';

import { useState } from 'react';
import { Modal } from '../Modal';
import { JobForm } from '../JobForm';
import { BenefitsForm } from './BenefitsForm';

type Job = {
	id: string;
	title: string;
	department?: string | null;
	location?: string | null;
	work_mode?: string | null;
	description?: string | null;
	responsibilities?: string | null;
	requirements?: string | null;
	max_salary?: number | null;
	is_published: boolean;
	created_at: string;
};

type JobsClientProps = {
	jobs: Job[];
};

export function JobsClient({ jobs }: JobsClientProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isBenefitsModalOpen, setIsBenefitsModalOpen] = useState(false);
	const [editingJobId, setEditingJobId] = useState<string | null>(null);
	
	// Buscar el job actualizado desde los props cuando cambia editingJobId
	const editingJob = editingJobId ? jobs.find(j => j.id === editingJobId) || null : null;

	return (
		<>
			<div className="space-y-8">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">Búsquedas</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Gestiona todas las posiciones abiertas y crea nuevas búsquedas
						</p>
					</div>
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => setIsBenefitsModalOpen(true)}
							className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md"
						>
							Beneficios
						</button>
						<button
							type="button"
							onClick={() => setIsCreateModalOpen(true)}
							className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-secondary hover:shadow-md"
						>
							Crear Nueva búsqueda
						</button>
					</div>
				</div>

				<div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
					<div className="border-b border-[var(--border)] px-6 py-4">
						<h2 className="text-base font-semibold text-foreground">Búsquedas activas</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{jobs?.filter((j) => j.is_published).length ?? 0} publicadas · {jobs?.length ?? 0} total
						</p>
					</div>
					<ul className="divide-y divide-[var(--border)]">
						{jobs && jobs.length > 0 ? (
							jobs.map((job) => (
								<li key={job.id} className="px-6 py-5 transition-colors hover:bg-muted">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2.5">
												<h3 className="text-base font-semibold text-foreground">{job.title}</h3>
												{job.is_published ? (
													<span className="inline-flex items-center rounded-full bg-black px-2.5 py-0.5 text-xs font-semibold text-white">
														Publicada
													</span>
												) : (
													<span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
														Oculta
													</span>
												)}
											</div>
											<p className="mt-1.5 text-sm font-medium text-muted-foreground">
												{job.department ? `${job.department} · ` : ''}
												{job.location ?? 'Remoto'}
											</p>
											{job.description && (
												<p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
											)}
											<p className="mt-3 text-xs font-medium text-muted-foreground">
												Creada el {new Date(job.created_at).toLocaleDateString('es-AR', {
													day: 'numeric',
													month: 'long',
													year: 'numeric'
												})}
											</p>
										</div>
										<button
											type="button"
											onClick={() => setEditingJobId(job.id)}
											className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-black"
										>
											Editar
										</button>
									</div>
								</li>
							))
						) : (
							<li className="px-6 py-12 text-center">
								<p className="text-sm font-medium text-muted-foreground">No hay búsquedas creadas todavía</p>
								<p className="mt-1 text-xs text-muted-foreground">Crea una nueva usando el botón de arriba</p>
							</li>
						)}
					</ul>
				</div>
			</div>

			{/* Modal de creación */}
			<Modal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				title="Crear nueva búsqueda"
			>
				<JobForm
					onSuccess={() => setIsCreateModalOpen(false)}
					onCancel={() => setIsCreateModalOpen(false)}
				/>
			</Modal>

			{/* Modal de edición */}
			<Modal
				isOpen={!!editingJobId}
				onClose={() => setEditingJobId(null)}
				title="Editar búsqueda"
			>
				{editingJob && (
					<JobForm
						key={`edit-${editingJob.id}-${Date.now()}`}
						job={editingJob}
						onSuccess={() => {
							setEditingJobId(null);
							setTimeout(() => {
								window.location.reload();
							}, 100);
						}}
						onCancel={() => setEditingJobId(null)}
					/>
				)}
			</Modal>

			{/* Modal de beneficios */}
			<Modal
				isOpen={isBenefitsModalOpen}
				onClose={() => setIsBenefitsModalOpen(false)}
				title="Gestionar Beneficios"
			>
				<BenefitsForm />
			</Modal>
		</>
	);
}

