'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type BenefitItem = {
	id?: string;
	text: string;
	display_order: number;
};

export function BenefitsForm() {
	const router = useRouter();
	const [loading, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [benefits, setBenefits] = useState<BenefitItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		loadBenefits();
	}, []);

	async function loadBenefits() {
		try {
			const res = await fetch('/api/admin/benefits');
			if (res.ok) {
				const data = await res.json();
				setBenefits(data.items || []);
			}
		} catch (err) {
			console.error('Error loading benefits:', err);
		} finally {
			setIsLoading(false);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(false);

		try {
			const res = await fetch('/api/admin/benefits', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: benefits })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				setError(data?.error ?? 'Error al guardar los beneficios');
				return;
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

	function addBenefit() {
		setBenefits([...benefits, { text: '', display_order: benefits.length + 1 }]);
	}

	function removeBenefit(index: number) {
		setBenefits(benefits.filter((_, i) => i !== index).map((item, i) => ({ ...item, display_order: i + 1 })));
	}

	function updateBenefit(index: number, text: string) {
		const updated = [...benefits];
		updated[index] = { ...updated[index], text };
		setBenefits(updated);
	}

	if (isLoading) {
		return <div className="p-6 text-center text-sm text-zinc-500">Cargando beneficios...</div>;
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-3">
				{benefits.map((benefit, index) => (
					<div key={index} className="flex gap-2">
						<input
							type="text"
							value={benefit.text}
							onChange={(e) => updateBenefit(index, e.target.value)}
							placeholder="Ej: 3 semanas de vacaciones"
							className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
							required
						/>
						<button
							type="button"
							onClick={() => removeBenefit(index)}
							className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							Eliminar
						</button>
					</div>
				))}
			</div>

			<button
				type="button"
				onClick={addBenefit}
				className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
			>
				+ Agregar beneficio
			</button>

			{error && (
				<div className="rounded-lg border border-red-200 bg-red-50 p-3">
					<p className="text-xs font-medium text-red-700">{error}</p>
				</div>
			)}

			{success && (
				<div className="rounded-lg border border-green-200 bg-green-50 p-3">
					<p className="text-xs font-medium text-green-700">Beneficios guardados exitosamente</p>
				</div>
			)}

			<div className="flex gap-3 pt-2">
				<button
					type="submit"
					disabled={loading}
					className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Guardando…' : 'Guardar beneficios'}
				</button>
			</div>
		</form>
	);
}

