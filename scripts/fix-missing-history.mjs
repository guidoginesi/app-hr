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
	
	console.log('🔍 Buscando aplicaciones sin historial...\n');
	
	// Obtener todas las aplicaciones
	const { data: applications, error: appsError } = await supabase
		.from('applications')
		.select('id, candidate_id, job_id, current_stage, current_stage_status, created_at')
		.order('created_at', { ascending: false });

	if (appsError) {
		console.error('❌ Error al obtener aplicaciones:', appsError.message);
		process.exit(1);
	}

	if (!applications || applications.length === 0) {
		console.log('ℹ️  No hay aplicaciones en la base de datos');
		process.exit(0);
	}

	console.log(`📊 Encontradas ${applications.length} aplicaciones\n`);

	// Obtener todos los historiales existentes
	const { data: existingHistory } = await supabase
		.from('stage_history')
		.select('application_id');

	const historyMap = new Set((existingHistory || []).map(h => h.application_id));

	let fixed = 0;
	let skipped = 0;

	for (const app of applications) {
		if (historyMap.has(app.id)) {
			skipped++;
			continue;
		}

		console.log(`🔧 Corrigiendo aplicación ${app.id}...`);

		// Determinar qué historial crear basado en el estado actual
		const historyEntries = [];

		if (app.current_stage === 'HR_REVIEW' && app.current_stage_status === 'PENDING') {
			// Si está en HR_REVIEW pendiente, crear historial de CV_RECEIVED -> HR_REVIEW
			historyEntries.push(
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
					to_stage: 'HR_REVIEW',
					status: 'PENDING',
					changed_by_user_id: null,
					notes: 'Avance automático a revisión HR',
					changed_at: app.created_at
				}
			);
		} else if (app.current_stage) {
			// Para otros estados, crear al menos la entrada inicial
			historyEntries.push({
				application_id: app.id,
				from_stage: null,
				to_stage: app.current_stage,
				status: app.current_stage_status || 'PENDING',
				changed_by_user_id: null,
				notes: 'Historial creado automáticamente',
				changed_at: app.created_at
			});
		}

		if (historyEntries.length > 0) {
			const { error: insertError } = await supabase
				.from('stage_history')
				.insert(historyEntries);

			if (insertError) {
				console.error(`   ❌ Error: ${insertError.message}`);
			} else {
				console.log(`   ✅ Historial creado (${historyEntries.length} entradas)`);
				fixed++;
			}
		}
	}

	console.log('\n' + '='.repeat(50));
	console.log(`✅ Proceso completado:`);
	console.log(`   - Aplicaciones corregidas: ${fixed}`);
	console.log(`   - Aplicaciones con historial existente: ${skipped}`);
	console.log('='.repeat(50));
}

main().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

