import { Check } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function BenefitsSection() {
	const supabase = getSupabaseServer();
	
	let benefits: { text: string }[] = [];

	try {
		// Get the first (and only) benefits record
		const { data: benefitsRecord } = await supabase
			.from('benefits')
			.select('id')
			.limit(1)
			.single();

		if (benefitsRecord) {
			const { data: benefitItems } = await supabase
				.from('benefit_items')
				.select('text')
				.eq('benefit_id', benefitsRecord.id)
				.order('display_order', { ascending: true });

			if (benefitItems) {
				benefits = benefitItems;
			}
		}
	} catch (err) {
		// Fallback to default benefits if table doesn't exist or error
		benefits = [
			{ text: '3 semanas de vacaciones' },
			{ text: 'Horarios flexibles' },
			{ text: 'Trabajo remoto' },
			{ text: 'Revisión salarial cada 6 meses' }
		];
	}

	if (benefits.length === 0) {
		return null;
	}

	return (
		<section className="rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
			<h2 className="text-base font-semibold text-foreground">Beneficios</h2>
			<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
				{benefits.map((benefit, index) => (
					<div key={index} className="flex items-start gap-2">
						<Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
						<span className="text-sm text-secondary-foreground">{benefit.text}</span>
					</div>
				))}
			</div>
		</section>
	);
}

