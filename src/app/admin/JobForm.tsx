'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from './RichTextEditor';

type Job = {
	id?: string;
	title: string;
	department?: string | null;
	location?: string | null;
	work_mode?: string | null;
	description?: string | null;
	responsibilities?: string | null;
	requirements?: string | null;
	max_salary?: number | null;
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
	
	// Estado para el salario formateado
	const [salaryDisplay, setSalaryDisplay] = useState<string>(() => {
		if (job?.max_salary) {
			return Number(job.max_salary).toLocaleString('es-AR');
		}
		return '';
	});
	
	// Estados para los campos de texto enriquecido
	const [description, setDescription] = useState<string>(job?.description || '');
	const [responsibilities, setResponsibilities] = useState<string>(job?.responsibilities || '');
	const [requirements, setRequirements] = useState<string>(job?.requirements || '');

	function handleSalaryChange(e: React.ChangeEvent<HTMLInputElement>) {
		const value = e.target.value.replace(/\D/g, '');
		if (!value) {
			setSalaryDisplay('');
			return;
		}
		const num = Number(value);
		const formatted = num.toLocaleString('es-AR');
		setSalaryDisplay(formatted);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const form = event.currentTarget;
		if (!form) return;

		const formData = new FormData(form);
		
		// Convertir salaryDisplay a número puro antes de enviar
		const salaryValue = salaryDisplay.replace(/\D/g, '');
		if (salaryValue) {
			formData.set('max_salary', salaryValue);
		} else {
			formData.delete('max_salary');
		}
		
		// Agregar los contenidos de los editores de texto enriquecido
		formData.set('description', description);
		formData.set('responsibilities', responsibilities);
		formData.set('requirements', requirements);

		try {
			const url = isEditing ? `/api/admin/jobs/${job.id}` : '/api/admin/jobs';
			const method = isEditing ? 'PUT' : 'POST';

			const res = await fetch(url, {
				method,
				body: formData
			});

			const responseData = await res.json().catch(() => null);

			if (!res.ok) {
				const errorMsg = responseData?.error ?? `Error al ${isEditing ? 'actualizar' : 'crear'} la búsqueda`;
				setError(errorMsg);
				return;
			}

			// Debug: mostrar información de responsibilities en la respuesta
			if (responseData?.debug && isEditing) {
				console.log('🔍 Debug response:', responseData.debug);
				if (responseData.debug.responsibilitiesInDB) {
					console.log('✅ Responsibilities guardadas en DB:', responseData.debug.responsibilitiesInDB);
				} else {
					console.warn('⚠️ Responsibilities NO guardadas en DB');
				}
			}

			// Si hay warning, solo loggearlo (la columna ya existe en producción)
			if (responseData?.warning) {
				console.warn('⚠️ Warning from API:', responseData.warning);
			}

			// No resetear el formulario si estamos editando (para mantener los valores)
			if (!isEditing && formRef.current) {
				formRef.current.reset();
			}

			// Llamar onSuccess para cerrar el modal y refrescar
			onSuccess?.();
		} catch (err) {
			console.error('Error submitting form:', err);
			setError('Error de conexión. Por favor intenta nuevamente.');
		}
	}

	return (
		<form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
			<div className="grid grid-cols-1 gap-4">
				<div>
					<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Título *</label>
					<input
						className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="title"
						placeholder="Ej: Desarrollador Backend Senior"
						defaultValue={job?.title || ''}
						required
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Área</label>
					<input
						className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="department"
						placeholder="Ej: Tecnología"
						defaultValue={job?.department || ''}
					/>
				</div>
				<div>
					<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Modalidad *</label>
					<select
						className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Ubicación</label>
				<input
					className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
					name="location"
					placeholder="Ej: Buenos Aires"
					defaultValue={job?.location || ''}
				/>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">
					Salario Máximo (opcional)
					<span className="ml-1.5 text-xs font-normal text-muted-foreground">
						· Si se completa, candidatos que excedan este monto serán descartados automáticamente
					</span>
				</label>
				<div className="relative">
					<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
					<input
						className="w-full rounded-lg border border-[var(--border)] bg-white pl-7 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="max_salary"
						type="text"
						inputMode="numeric"
						placeholder="Ej: 5.000.000"
						value={salaryDisplay}
						onChange={handleSalaryChange}
					/>
				</div>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Estado</label>
					<select
						className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
						name="is_published"
						defaultValue={job?.is_published ? 'true' : 'false'}
					>
						<option value="true">Publicada</option>
						<option value="false">Oculta</option>
					</select>
				</div>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Descripción</label>
				<RichTextEditor
					content={description}
					onChange={setDescription}
					placeholder="Describe la posición..."
				/>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Responsabilidades</label>
				<RichTextEditor
					content={responsibilities}
					onChange={setResponsibilities}
					placeholder="Lista las responsabilidades del puesto..."
				/>
			</div>
			<div>
				<label className="mb-1.5 block text-xs font-medium text-secondary-foreground">Requerimientos</label>
				<RichTextEditor
					content={requirements}
					onChange={setRequirements}
					placeholder="Lista los requisitos y habilidades necesarias..."
				/>
			</div>
			{error && (
				<div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
					<p className="text-xs font-medium text-[var(--red-600)]">{error}</p>
				</div>
			)}
			<div className="flex gap-3 pt-2">
				<button
					type="submit"
					disabled={loading}
					className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-secondary hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? (isEditing ? 'Guardando…' : 'Creando…') : isEditing ? 'Guardar cambios' : 'Crear búsqueda'}
				</button>
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						disabled={loading}
						className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-all hover:bg-muted disabled:opacity-50"
					>
						Cancelar
					</button>
				)}
			</div>
		</form>
	);
}

