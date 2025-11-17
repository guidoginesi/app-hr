'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../Modal';

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

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

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
		<Modal isOpen={isOpen} onClose={onClose} title="Agregar candidato manualmente">
			<form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Nombre completo *</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="name"
						placeholder="Ej: Juan Pérez"
						required
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Email *</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						type="email"
						name="email"
						placeholder="Ej: juan@example.com"
						required
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">LinkedIn (opcional)</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						type="url"
						name="linkedinUrl"
						placeholder="https://linkedin.com/in/..."
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Búsqueda *</label>
					<select
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="jobId"
						required
					>
						<option value="">Selecciona una búsqueda</option>
						{jobs.map((job) => (
							<option key={job.id} value={job.id}>
								{job.title} {job.department ? `· ${job.department}` : ''}
							</option>
						))}
					</select>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">CV (opcional)</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						type="file"
						name="resume"
						accept=".pdf,.doc,.docx,.txt"
					/>
					<p className="mt-1 text-xs text-zinc-500">Si no subes un CV, el candidato se creará sin aplicación</p>
				</div>
				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-3">
						<p className="text-xs font-medium text-red-700">{error}</p>
					</div>
				)}
				<div className="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={loading}
						className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? 'Creando…' : 'Agregar candidato'}
					</button>
					<button
						type="button"
						onClick={onClose}
						disabled={loading}
						className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50"
					>
						Cancelar
					</button>
				</div>
			</form>
		</Modal>
	);
}

