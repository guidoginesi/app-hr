'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { JobForm } from '../JobForm';
import { BenefitsForm } from './BenefitsForm';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Button } from '@pow/ui/components/ui/button';

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
			<div className="space-y-6">
				<div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
					<div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
						<div>
							<h2 className="text-base font-semibold text-foreground">Búsquedas activas</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								{jobs?.filter((j) => j.is_published).length ?? 0} publicadas · {jobs?.length ?? 0} total
							</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => setIsBenefitsModalOpen(true)}>
								Beneficios
							</Button>
							<Button onClick={() => setIsCreateModalOpen(true)}>
								Crear nueva búsqueda
							</Button>
						</div>
					</div>
					<ul className="divide-y divide-[var(--border)]">
						{jobs && jobs.length > 0 ? (
							jobs.map((job) => (
								<li key={job.id} className="px-6 py-5 transition-colors hover:bg-muted">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2.5">
												<h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
												{job.is_published ? (
													<span className="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-semibold text-[var(--green-700)]">
														Publicada
													</span>
												) : (
													<span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
														Oculta
													</span>
												)}
											</div>
											<p className="mt-1.5 text-xs text-muted-foreground">
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
										<Button variant="outline" size="sm" onClick={() => setEditingJobId(job.id)}>
											Editar
										</Button>
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

			{/* Sheet de creación */}
			<Sheet open={isCreateModalOpen} onOpenChange={(o) => { if (!o) setIsCreateModalOpen(false); }}>
				<SheetContent side="right" flush title="Crear nueva búsqueda" className="max-w-2xl">
					<div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
						<h2 className="type-title">Crear nueva búsqueda</h2>
						<SheetClose
							aria-label="Cerrar"
							className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X className="h-5 w-5" />
						</SheetClose>
					</div>
					<div className="flex-1 overflow-y-auto p-6">
						<JobForm
							onSuccess={() => setIsCreateModalOpen(false)}
							onCancel={() => setIsCreateModalOpen(false)}
						/>
					</div>
				</SheetContent>
			</Sheet>

			{/* Sheet de edición */}
			<Sheet open={!!editingJobId} onOpenChange={(o) => { if (!o) setEditingJobId(null); }}>
				<SheetContent side="right" flush title="Editar búsqueda" className="max-w-2xl">
					<div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
						<h2 className="type-title">Editar búsqueda</h2>
						<SheetClose
							aria-label="Cerrar"
							className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X className="h-5 w-5" />
						</SheetClose>
					</div>
					<div className="flex-1 overflow-y-auto p-6">
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
					</div>
				</SheetContent>
			</Sheet>

			{/* Sheet de beneficios */}
			<Sheet open={isBenefitsModalOpen} onOpenChange={(o) => { if (!o) setIsBenefitsModalOpen(false); }}>
				<SheetContent side="right" flush title="Gestionar Beneficios">
					<div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
						<h2 className="type-title">Gestionar Beneficios</h2>
						<SheetClose
							aria-label="Cerrar"
							className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X className="h-5 w-5" />
						</SheetClose>
					</div>
					<div className="flex-1 overflow-y-auto p-6">
						<BenefitsForm />
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}

