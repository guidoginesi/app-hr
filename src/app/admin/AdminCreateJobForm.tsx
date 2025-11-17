'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AdminCreateJobForm() {
	const router = useRouter();
	const formRef = useRef<HTMLFormElement>(null);
	const [loading, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(false);
		
		const form = event.currentTarget;
		if (!form) return;
		
		const formData = new FormData(form);

		try {
			const res = await fetch('/api/admin/jobs', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				setError(data?.error ?? 'Error al crear la búsqueda');
				return;
			}

			// Reset form de forma segura
			if (formRef.current) {
				formRef.current.reset();
			}
			
			setSuccess(true);
			setTimeout(() => setSuccess(false), 3000);
			
			startTransition(() => {
				router.refresh();
			});
		} catch (err) {
			setError('Error de conexión. Por favor intenta nuevamente.');
		}
	}

	return (
		<form ref={formRef} onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
			<h2 className="text-lg font-semibold text-zinc-900">Crear nueva búsqueda</h2>
			<p className="mt-1 text-xs text-zinc-500">Completa los campos para publicar una nueva posición</p>
			
			<div className="mt-6 space-y-4">
				<div className="grid grid-cols-1 gap-4">
					<div>
						<label className="mb-1.5 block text-xs font-medium text-zinc-700">Título *</label>
						<input
							className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							name="title"
							placeholder="Ej: Desarrollador Backend Senior"
							required
						/>
					</div>
					<div>
						<label className="mb-1.5 block text-xs font-medium text-zinc-700">Área</label>
						<input
							className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							name="department"
							placeholder="Ej: Tecnología"
						/>
					</div>
					<div>
						<label className="mb-1.5 block text-xs font-medium text-zinc-700">Ubicación</label>
						<input
							className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							name="location"
							placeholder="Ej: Buenos Aires, Remoto"
						/>
					</div>
					<div>
						<label className="mb-1.5 block text-xs font-medium text-zinc-700">Estado</label>
						<select
							className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							name="is_published"
							defaultValue="true"
						>
							<option value="true">Publicada</option>
							<option value="false">Oculta</option>
						</select>
					</div>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Descripción</label>
					<textarea
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="description"
						rows={4}
						placeholder="Describe la posición y responsabilidades..."
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Requerimientos</label>
					<textarea
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="requirements"
						rows={4}
						placeholder="Lista los requisitos y habilidades necesarias..."
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Creando…' : 'Crear búsqueda'}
				</button>
				{success && (
					<div className="rounded-lg border border-green-200 bg-green-50 p-3">
						<p className="text-xs font-medium text-green-700">✅ Búsqueda creada exitosamente</p>
					</div>
				)}
				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-3">
						<p className="text-xs font-medium text-red-700">{error}</p>
					</div>
				)}
			</div>
		</form>
	);
}


