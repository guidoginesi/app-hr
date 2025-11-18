'use client';

import { useState } from 'react';
import { Stage, STAGE_ORDER, StageLabels } from '@/types/funnel';

type PipelineStats = {
	job_id: string;
	job_title: string;
	job_department: string | null;
	stage_counts: Record<Stage, number>;
	total: number;
};

type PipelineDashboardProps = {
	stats: PipelineStats[];
};

export function PipelineDashboard({ stats }: PipelineDashboardProps) {
	const [selectedJobId, setSelectedJobId] = useState<string>(
		stats.length > 0 ? stats[0].job_id : ''
	);

	if (stats.length === 0) {
		return (
			<div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
				<p className="text-sm text-zinc-500">No hay búsquedas con candidatos todavía</p>
			</div>
		);
	}

	const selectedStat = stats.find((stat) => stat.job_id === selectedJobId) || stats[0];

	return (
		<div className="space-y-6">
			{/* Select de búsquedas */}
			<div>
				<label className="mb-2 block text-sm font-medium text-zinc-700">
					Seleccionar búsqueda
				</label>
				<select
					value={selectedJobId}
					onChange={(e) => setSelectedJobId(e.target.value)}
					className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
				>
					{stats.map((stat) => (
						<option key={stat.job_id} value={stat.job_id}>
							{stat.job_title}
							{stat.job_department && ` - ${stat.job_department}`}
							{` (${stat.total} candidatos)`}
						</option>
					))}
				</select>
			</div>

			{/* Pipeline visual de la búsqueda seleccionada */}
			<div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
				<div className="mb-4">
					<h3 className="text-lg font-semibold text-zinc-900">{selectedStat.job_title}</h3>
					{selectedStat.job_department && (
						<p className="text-sm text-zinc-500 mt-1">{selectedStat.job_department}</p>
					)}
					<p className="text-xs text-zinc-400 mt-1">Total: {selectedStat.total} candidatos</p>
				</div>

				{/* Pipeline visual - Embudo real */}
				<div className="overflow-x-auto pb-4 -mx-6 px-6">
					<div className="flex gap-3 min-w-max">
						{STAGE_ORDER.map((stage, index) => {
							const count = selectedStat.stage_counts[stage] || 0;
							
							// Para la primera etapa, el "anterior" es el total de CVs recibidos
							// Para las demás, es cuántos pasaron por la etapa anterior
							let previousCount = selectedStat.total;
							if (index > 0) {
								const previousStage = STAGE_ORDER[index - 1];
								previousCount = selectedStat.stage_counts[previousStage] || 0;
							}
							
							// Porcentaje de conversión respecto a la etapa anterior
							const conversionRate = previousCount > 0 ? (count / previousCount) * 100 : 0;
							// Porcentaje respecto al total inicial (para la barra visual)
							const percentageOfTotal = selectedStat.total > 0 ? (count / selectedStat.total) * 100 : 0;
							const isLast = index === STAGE_ORDER.length - 1;

							return (
								<div key={stage} className="flex items-center">
									{/* Etapa */}
									<div className="flex flex-col items-center min-w-[140px]">
										<div className="w-full rounded-lg px-3 py-2.5 text-center bg-zinc-50 border border-zinc-200">
											<p className="text-xs font-semibold leading-tight text-zinc-900">
												{StageLabels[stage]}
											</p>
											<p className="text-lg font-bold text-black mt-1">{count}</p>
											{index > 0 && previousCount > 0 && (
												<p className="text-xs text-zinc-600 mt-0.5">
													{conversionRate.toFixed(0)}% de {previousCount}
												</p>
											)}
											{selectedStat.total > 0 && (
												<div className="mt-1.5 h-2 bg-zinc-200 rounded-full overflow-hidden">
													<div
														className="h-full bg-black transition-all"
														style={{ width: `${percentageOfTotal}%` }}
													/>
												</div>
											)}
										</div>
									</div>
									{/* Flecha conectora */}
									{!isLast && (
										<div className="flex items-center mx-1">
											<div className="h-0.5 w-8 bg-zinc-300" />
											<div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-zinc-300" />
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

