import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Missing Supabase environment variables');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStageHistoryTimestamps() {
	console.log('🔍 Buscando aplicaciones con timestamps incorrectos en stage_history...\n');

	// Obtener todas las aplicaciones
	const { data: applications, error: appError } = await supabase
		.from('applications')
		.select('id, created_at, candidate_id, job_id')
		.order('created_at', { ascending: false });

	if (appError) {
		console.error('Error obteniendo aplicaciones:', appError);
		process.exit(1);
	}

	console.log(`📊 Total aplicaciones: ${applications.length}\n`);

	for (const app of applications) {
		// Obtener historial de la aplicación
		const { data: history, error: histError } = await supabase
			.from('stage_history')
			.select('*')
			.eq('application_id', app.id)
			.order('changed_at', { ascending: true }); // Ordenar ASC para procesar en orden cronológico

		if (histError) {
			console.error(`Error obteniendo historial de ${app.id}:`, histError);
			continue;
		}

		if (!history || history.length === 0) continue;

		// Buscar entradas iniciales (CV_RECEIVED y HR_REVIEW)
		const cvReceived = history.find(h => h.to_stage === 'CV_RECEIVED' && h.from_stage === null);
		const hrReview = history.find(h => h.to_stage === 'HR_REVIEW' && h.from_stage === 'CV_RECEIVED');

		// Si ambas existen y tienen timestamps muy cercanos (menos de 1 segundo de diferencia)
		// pero no coinciden con created_at, necesitan corrección
		if (cvReceived && hrReview) {
			const cvDate = new Date(cvReceived.changed_at);
			const hrDate = new Date(hrReview.changed_at);
			const createdDate = new Date(app.created_at);
			const diffMs = Math.abs(hrDate.getTime() - cvDate.getTime());

			// Si las fechas están muy cercanas (menos de 1 segundo) y son diferentes de created_at
			if (diffMs < 1000 && Math.abs(cvDate.getTime() - createdDate.getTime()) > 1000) {
				console.log(`⚠️  Aplicación ${app.id}:`);
				console.log(`   created_at: ${app.created_at}`);
				console.log(`   CV_RECEIVED changed_at: ${cvReceived.changed_at}`);
				console.log(`   HR_REVIEW changed_at: ${hrReview.changed_at}`);
				console.log(`   → Corrigiendo timestamps a created_at...\n`);

				// Actualizar ambas entradas al created_at de la aplicación
				const { error: updateError1 } = await supabase
					.from('stage_history')
					.update({ changed_at: app.created_at })
					.eq('id', cvReceived.id);

				const { error: updateError2 } = await supabase
					.from('stage_history')
					.update({ changed_at: app.created_at })
					.eq('id', hrReview.id);

				if (updateError1 || updateError2) {
					console.error('   ❌ Error actualizando:', updateError1 || updateError2);
				} else {
					console.log('   ✅ Corregido exitosamente\n');
				}
			}
		}
	}

	console.log('✅ Proceso completado');
}

fixStageHistoryTimestamps().catch(console.error);


