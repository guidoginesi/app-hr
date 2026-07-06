'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@pow/ui/components/ui/button';

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
		return <div className="p-6 text-center text-sm text-muted-foreground">Cargando beneficios...</div>;
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
							className="flex-1 rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
							required
						/>
						<Button
							type="button"
							variant="outline"
							onClick={() => removeBenefit(index)}
							className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle"
						>
							Eliminar
						</Button>
					</div>
				))}
			</div>

			<button
				type="button"
				onClick={addBenefit}
				className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
			>
				+ Agregar beneficio
			</button>

			{error && (
				<div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
					<p className="text-xs font-medium text-[var(--red-600)]">{error}</p>
				</div>
			)}

			{success && (
				<div className="rounded-lg border border-success/20 bg-success-subtle p-3">
					<p className="text-xs font-medium text-[var(--green-700)]">Beneficios guardados exitosamente</p>
				</div>
			)}

			<div className="flex gap-3 pt-2">
				<Button type="submit" loading={loading} className="flex-1">
					Guardar beneficios
				</Button>
			</div>
		</form>
	);
}

