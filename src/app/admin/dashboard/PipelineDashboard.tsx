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

// Componente de embudo visual mejorado
function FunnelVisualization({ stats }: { stats: PipelineStats }) {
	// Calculamos datos para cada etapa
	const stageData = STAGE_ORDER.map((stage, index) => {
		const count = stats.stage_counts[stage] || 0;
		
		let previousCount = stats.total;
		if (index > 0) {
			const previousStage = STAGE_ORDER[index - 1];
			previousCount = stats.stage_counts[previousStage] || 0;
		}
		
		const conversionRate = previousCount > 0 ? (count / previousCount) * 100 : 0;
		const percentageOfTotal = stats.total > 0 ? (count / stats.total) * 100 : 0;
		
		return {
			stage,
			label: StageLabels[stage],
			count,
			previousCount,
			conversionRate,
			percentageOfTotal,
			isFirst: index === 0,
		};
	});

	const totalStages = stageData.length;

	return (
		<div className="space-y-8">
			{/* Estadísticas superiores + Embudo integrado */}
			<div>
				{/* Estadísticas superiores - En una sola línea sin scroll */}
				<div className="flex justify-between gap-2 w-full items-end">
					{stageData.map((data, index) => (
						<div key={data.stage} className="text-center flex-1 min-w-0 flex flex-col">
							<div className="text-xs font-medium text-zinc-500 uppercase tracking-tight mb-2 h-8 flex items-start justify-center">
								{data.label}
							</div>
							<div className="text-3xl font-bold text-zinc-900 leading-none">{data.count}</div>
							<div className="h-6 mt-2 flex items-center justify-center">
								{!data.isFirst && data.previousCount > 0 && (
									<div className="text-sm font-medium text-red-600 flex items-center gap-1">
										<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
										</svg>
										{data.conversionRate.toFixed(0)}%
									</div>
								)}
							</div>
						</div>
					))}
				</div>

				{/* Embudo visual - Alineado con las columnas */}
				<div className="relative w-full mt-6" style={{ height: '150px' }}>
					{/* SVG del embudo como background */}
					<svg 
						className="absolute top-0 left-0 w-full h-full pointer-events-none"
						preserveAspectRatio="none"
						viewBox="0 0 1000 100"
					>
						<path
							d={(() => {
								const points: string[] = [];
								// Calculamos el ancho de cada columna en unidades del viewBox
								const totalWidth = 1000;
								const gap = 2; // gap-2 en porcentaje
								const columnWidth = (totalWidth - (gap * (totalStages - 1))) / totalStages;
								
								// Línea superior (de izquierda a derecha)
								stageData.forEach((data, index) => {
									// Para la primera columna, empezar desde el borde izquierdo
									// Para las demás, usar el centro de la columna
									let x;
									if (index === 0) {
										x = 0; // Empieza desde el borde izquierdo
									} else {
										x = (columnWidth + gap) * index + columnWidth / 2;
									}
									const y = 50 - (data.percentageOfTotal / 3.5);
									points.push(`${index === 0 ? 'M' : 'L'} ${x} ${y}`);
								});
								
								// Línea inferior (de derecha a izquierda)
								for (let i = stageData.length - 1; i >= 0; i--) {
									const data = stageData[i];
									let x;
									if (i === 0) {
										x = 0; // Termina en el borde izquierdo
									} else {
										x = (columnWidth + gap) * i + columnWidth / 2;
									}
									const y = 50 + (data.percentageOfTotal / 3.5);
									points.push(`L ${x} ${y}`);
								}
								
								points.push('Z');
								return points.join(' ');
							})()}
							fill="#d4d4d8"
						/>
					</svg>
					
					{/* Porcentajes alineados con las columnas */}
					<div className="relative flex justify-between gap-2 w-full h-full" style={{ zIndex: 10 }}>
						{stageData.map((data, index) => (
							<div key={`col-${data.stage}`} className="flex-1 min-w-0 flex items-center justify-center">
								<span className="text-base font-bold text-zinc-900">
									{data.percentageOfTotal.toFixed(0)}%
								</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Nota explicativa */}
			<div className="text-center">
				<p className="text-sm text-zinc-500">
					Los porcentajes dentro del embudo muestran la tasa de conversión respecto al total inicial
				</p>
			</div>
		</div>
	);
}

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
			<div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
				<FunnelVisualization stats={selectedStat} />
			</div>
		</div>
	);
}

