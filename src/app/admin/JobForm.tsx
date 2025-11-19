'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Job = {
	id?: string;
	title: string;
	department?: string | null;
	location?: string | null;
	work_mode?: string | null;
	description?: string | null;
	responsibilities?: string | null;
	requirements?: string | null;
	is_published: boolean;
};

type JobFormProps = {
	job?: Job | null;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
	const router = useRouter();
	const formRef = useRef<HTMLFormElement>(null);
	const [loading, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const isEditing = !!job?.id;
	
	// Log al montar el componente
	console.log('📋 JobForm mounted, isEditing:', isEditing, 'job:', job?.id);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		console.log('🚀 DEBUG: Form submit triggered!');
		setError(null);

		const form = event.currentTarget;
		if (!form) {
			console.error('❌ Form not found');
			return;
		}

		const formData = new FormData(form);
		
		// Verificar que responsibilities esté en el formData
		const responsibilitiesCheck = formData.get('responsibilities');
		console.log('🔍 DEBUG: responsibilities value from form:', responsibilitiesCheck);
		console.log('🔍 DEBUG: responsibilities type:', typeof responsibilitiesCheck);
		console.log('🔍 DEBUG: All form data:', Object.fromEntries(formData.entries()));
		
		// Verificar también directamente desde el DOM
		const responsibilitiesInput = form.querySelector<HTMLTextAreaElement>('textarea[name="responsibilities"]');
		if (responsibilitiesInput) {
			console.log('🔍 DEBUG: responsibilities from DOM:', responsibilitiesInput.value);
		} else {
			console.error('❌ Responsibilities textarea not found in form!');
		}

		try {
			const url = isEditing ? `/api/admin/jobs/${job.id}` : '/api/admin/jobs';
			const method = isEditing ? 'PUT' : 'POST';

			console.log('🔍 DEBUG: Sending request to:', url, 'Method:', method);

			const res = await fetch(url, {
				method,
				body: formData
			});

			console.log('🔍 DEBUG: Response status:', res.status);

			const responseData = await res.json().catch((err) => {
				console.error('🔍 DEBUG: Error parsing response:', err);
				return null;
			});

			console.log('🔍 DEBUG: Response data:', responseData);

			if (!res.ok) {
				const errorMsg = responseData?.error ?? `Error al ${isEditing ? 'actualizar' : 'crear'} la búsqueda`;
				setError(errorMsg);
				console.error('❌ Error response:', errorMsg);
				return;
			}

			// Mostrar advertencia si existe
			if (responseData?.warning) {
				console.warn('⚠️ Warning:', responseData.warning);
				alert(responseData.warning);
			}
			
			console.log('✅ Success! Job saved');

			// No resetear el formulario si estamos editando (para mantener los valores)
			if (!isEditing && formRef.current) {
				formRef.current.reset();
			}

			// Llamar onSuccess primero para cerrar el modal
			onSuccess?.();
			
			// Luego refrescar los datos
			startTransition(() => {
				router.refresh();
			});
		} catch (err) {
			console.error('Error submitting form:', err);
			setError('Error de conexión. Por favor intenta nuevamente.');
		}
	}

	return (
		<form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
			<div className="grid grid-cols-1 gap-4">
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Título *</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="title"
						placeholder="Ej: Desarrollador Backend Senior"
						defaultValue={job?.title || ''}
						required
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Área</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="department"
						placeholder="Ej: Tecnología"
						defaultValue={job?.department || ''}
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Modalidad *</label>
					<select
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="work_mode"
						defaultValue={job?.work_mode || 'Remota'}
						required
					>
						<option value="Remota">Remota</option>
						<option value="Híbrida">Híbrida</option>
						<option value="Presencial">Presencial</option>
					</select>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Ubicación</label>
					<input
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="location"
						placeholder="Ej: Buenos Aires"
						defaultValue={job?.location || ''}
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-zinc-700">Estado</label>
					<select
						className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="is_published"
						defaultValue={job?.is_published ? 'true' : 'false'}
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
					placeholder="Describe la posición..."
					defaultValue={job?.description || ''}
				/>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-zinc-700">Responsabilidades</label>
				<textarea
					className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
					name="responsibilities"
					rows={4}
					placeholder="Lista las responsabilidades del puesto..."
					defaultValue={job?.responsibilities || ''}
				/>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-zinc-700">Requerimientos</label>
				<textarea
					className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
					name="requirements"
					rows={4}
					placeholder="Lista los requisitos y habilidades necesarias..."
					defaultValue={job?.requirements || ''}
				/>
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
					{loading ? (isEditing ? 'Guardando…' : 'Creando…') : isEditing ? 'Guardar cambios' : 'Crear búsqueda'}
				</button>
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						disabled={loading}
						className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50"
					>
						Cancelar
					</button>
				)}
			</div>
		</form>
	);
}

