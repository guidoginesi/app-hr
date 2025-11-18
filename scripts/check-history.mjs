import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function main() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		process.exit(1);
	}

	const supabase = createClient(url, serviceKey);
	
	console.log('🔍 Buscando candidato "Manuela Perez"...\n');
	
	// Buscar el candidato
	const { data: candidates, error: candError } = await supabase
		.from('candidates')
		.select('id, name, email')
		.ilike('name', '%Manuela%');

	if (candError) {
		console.error('❌ Error al buscar candidato:', candError.message);
		process.exit(1);
	}

	if (!candidates || candidates.length === 0) {
		console.log('❌ No se encontró el candidato "Manuela Perez"');
		process.exit(1);
	}

	for (const candidate of candidates) {
		console.log(`\n📋 Candidato: ${candidate.name} (${candidate.email})`);
		console.log(`   ID: ${candidate.id}\n`);

		// Obtener aplicaciones
		const { data: applications, error: appError } = await supabase
			.from('applications')
			.select('id, job_id, current_stage, current_stage_status, created_at')
			.eq('candidate_id', candidate.id);

		if (appError) {
			console.error('❌ Error al obtener aplicaciones:', appError.message);
			continue;
		}

		if (!applications || applications.length === 0) {
			console.log('   ⚠️  No tiene aplicaciones');
			continue;
		}

		for (const app of applications) {
			console.log(`   📄 Aplicación: ${app.id}`);
			console.log(`      Etapa actual: ${app.current_stage} - ${app.current_stage_status}`);
			console.log(`      Creada: ${new Date(app.created_at).toLocaleString('es-AR')}`);

			// Obtener historial
			const { data: history, error: histError } = await supabase
				.from('stage_history')
				.select('*')
				.eq('application_id', app.id)
				.order('changed_at', { ascending: false });

			if (histError) {
				console.error(`      ❌ Error al obtener historial: ${histError.message}`);
				continue;
			}

			if (!history || history.length === 0) {
				console.log(`      ⚠️  No tiene historial`);
				console.log(`      🔧 Creando historial...`);
				
				// Crear historial
				const historyEntries = [
					{
						application_id: app.id,
						from_stage: null,
						to_stage: 'CV_RECEIVED',
						status: 'COMPLETED',
						changed_by_user_id: null,
						notes: 'CV recibido - historial creado automáticamente',
						changed_at: app.created_at
					},
					{
						application_id: app.id,
						from_stage: 'CV_RECEIVED',
						to_stage: app.current_stage || 'HR_REVIEW',
						status: app.current_stage_status || 'PENDING',
						changed_by_user_id: null,
						notes: 'Avance automático',
						changed_at: app.created_at
					}
				];

				const { error: insertError } = await supabase
					.from('stage_history')
					.insert(historyEntries);

				if (insertError) {
					console.error(`      ❌ Error al crear historial: ${insertError.message}`);
				} else {
					console.log(`      ✅ Historial creado (${historyEntries.length} entradas)`);
				}
			} else {
				console.log(`      ✅ Historial encontrado (${history.length} entradas):`);
				history.forEach((entry, idx) => {
					console.log(`         ${idx + 1}. ${entry.from_stage || 'Inicio'} → ${entry.to_stage} (${entry.status})`);
					console.log(`            ${new Date(entry.changed_at).toLocaleString('es-AR')}`);
				});
			}
		}
	}
}

main().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

