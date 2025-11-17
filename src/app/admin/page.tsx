import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { AdminShell } from './AdminShell';

export default async function AdminHome() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		redirect('/admin/login');
	}

	const supabase = getSupabaseServer();
	const { data: jobs } = await supabase
		.from('jobs')
		.select('id,title,department,location,is_published,created_at')
		.order('created_at', { ascending: false });

	return (
		<AdminShell active="dashboard">
			<div className="space-y-8">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
					<p className="mt-1 text-sm text-zinc-500">
						Resumen general del sistema de gestión de CV
					</p>
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					<div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
						<p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Candidatos activos</p>
						<p className="mt-3 text-4xl font-bold text-zinc-900">—</p>
						<p className="mt-2 text-xs text-zinc-500">Pronto mostraremos estos datos</p>
					</div>
					<div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
						<p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Búsquedas abiertas</p>
						<p className="mt-3 text-4xl font-bold text-black">{jobs?.filter((j) => j.is_published).length ?? 0}</p>
						<p className="mt-2 text-xs text-zinc-500">Publicadas en la landing</p>
					</div>
					<div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
						<p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">CVs procesados</p>
						<p className="mt-3 text-4xl font-bold text-zinc-900">—</p>
						<p className="mt-2 text-xs text-zinc-500">Integraremos el análisis con IA en el próximo paso</p>
					</div>
				</div>

				<div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-zinc-900">Resumen rápido</h2>
					<p className="mt-1 text-sm text-zinc-500">
						Accede a las secciones del menú lateral para gestionar búsquedas, candidatos y más
					</p>
					<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:bg-zinc-100">
							<p className="text-sm font-semibold text-zinc-900">Búsquedas activas</p>
							<p className="mt-1 text-xs text-zinc-600">
								{jobs?.filter((j) => j.is_published).length ?? 0} publicadas de {jobs?.length ?? 0} total
							</p>
						</div>
						<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:bg-zinc-100">
							<p className="text-sm font-semibold text-zinc-900">Próximamente</p>
							<p className="mt-1 text-xs text-zinc-600">Métricas de candidatos y análisis con IA</p>
						</div>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}


