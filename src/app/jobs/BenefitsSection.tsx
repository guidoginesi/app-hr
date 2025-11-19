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
		<section className="mb-12 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
			<h2 className="mb-6 text-2xl font-bold text-zinc-900">Beneficios</h2>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{benefits.map((benefit, index) => (
					<div key={index} className="flex items-start gap-2">
						<svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						<span className="text-sm text-zinc-700">{benefit.text}</span>
					</div>
				))}
			</div>
		</section>
	);
}

