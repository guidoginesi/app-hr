'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

type Job = {
	id: string;
	title: string;
	department?: string | null;
};

type AddCandidateModalProps = {
	isOpen: boolean;
	onClose: () => void;
	jobs: Job[];
};

export function AddCandidateModal({ isOpen, onClose, jobs }: AddCandidateModalProps) {
	const router = useRouter();
	const formRef = useRef<HTMLFormElement>(null);
	const [loading, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [jobId, setJobId] = useState('');

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		if (!jobId) {
			setError('Selecciona una búsqueda');
			return;
		}

		const form = event.currentTarget;
		if (!form) return;

		const formData = new FormData(form);

		try {
			const res = await fetch('/api/admin/candidates', {
				method: 'POST',
				body: formData
			});

			const data = await res.json().catch(() => null);

			if (!res.ok) {
				setError(data?.error ?? 'Error al crear el candidato');
				console.error('Error response:', data);
				return;
			}

			if (formRef.current) {
				formRef.current.reset();
			}
			setJobId('');

			startTransition(() => {
				router.refresh();
				onClose();
			});
		} catch (err) {
			console.error('Error creating candidate:', err);
			setError('Error de conexión. Por favor intenta nuevamente.');
		}
	}

	return (
		<Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
			<SheetContent side="right" flush title="Agregar candidato manualmente">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
					<h2 className="type-title">Agregar candidato manualmente</h2>
					<SheetClose
						aria-label="Cerrar"
						className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<X className="h-5 w-5" />
					</SheetClose>
				</div>

				<form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
					<div className="flex-1 space-y-4 overflow-y-auto p-6">
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Nombre completo *</label>
							<input
								className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
								name="name"
								placeholder="Ej: Juan Pérez"
								required
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Email *</label>
							<input
								className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
								type="email"
								name="email"
								placeholder="Ej: juan@example.com"
								required
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">LinkedIn (opcional)</label>
							<input
								className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
								type="url"
								name="linkedinUrl"
								placeholder="https://linkedin.com/in/..."
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Búsqueda *</label>
							<input type="hidden" name="jobId" value={jobId} />
							<SelectMenu
								ariaLabel="Búsqueda"
								className="w-full"
								placeholder="Selecciona una búsqueda"
								value={jobId}
								onChange={setJobId}
								options={jobs.map((job) => ({
									value: job.id,
									label: `${job.title}${job.department ? ` · ${job.department}` : ''}`,
								}))}
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">CV (opcional)</label>
							<input
								className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground hover:file:bg-secondary focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
								type="file"
								name="resume"
								accept=".pdf,.doc,.docx,.txt"
							/>
							<p className="mt-1 text-xs text-muted-foreground">Si no subes un CV, el candidato se creará sin aplicación</p>
						</div>
						{error && (
							<div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
								<p className="text-xs font-medium text-[var(--red-600)]">{error}</p>
							</div>
						)}
					</div>

					{/* Footer */}
					<div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
						<Button type="button" variant="outline" onClick={onClose} disabled={loading}>
							Cancelar
						</Button>
						<Button type="submit" loading={loading}>
							Agregar candidato
						</Button>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}

