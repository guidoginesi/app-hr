import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
	console.error('❌ Missing Supabase environment variables');
	console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Función para leer input del usuario
function askQuestion(query) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(query, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

async function deleteGuidoGinesiCandidates() {
	console.log('🔍 Buscando candidatos de prueba "Guido Ginesi"...\n');

	// Buscar candidatos con ese nombre (case insensitive)
	const { data: candidates, error: searchError } = await supabase
		.from('candidates')
		.select('id, name, email, created_at')
		.ilike('name', '%Guido Ginesi%');

	if (searchError) {
		console.error('❌ Error al buscar candidatos:', searchError.message);
		process.exit(1);
	}

	if (!candidates || candidates.length === 0) {
		console.log('✅ No se encontraron candidatos con el nombre "Guido Ginesi"');
		process.exit(0);
	}

	console.log(`📋 Encontrados ${candidates.length} candidato(s) de prueba:`);
	console.log('');

	// Obtener información detallada de cada candidato y sus aplicaciones
	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		console.log(`   ${i + 1}. ${candidate.name}`);
		console.log(`      Email: ${candidate.email}`);
		console.log(`      ID: ${candidate.id}`);
		console.log(`      Creado: ${new Date(candidate.created_at).toLocaleString('es-AR')}`);

		// Obtener aplicaciones del candidato
		const { data: applications, error: appsError } = await supabase
			.from('applications')
			.select('id, job_id, created_at, current_stage, current_stage_status, jobs(title)')
			.eq('candidate_id', candidate.id);

		if (appsError) {
			console.log(`      ⚠️  Error al obtener aplicaciones: ${appsError.message}`);
		} else if (applications && applications.length > 0) {
			console.log(`      Aplicaciones (${applications.length}):`);
			applications.forEach((app, idx) => {
				const jobTitle = app.jobs?.title || 'Búsqueda eliminada';
				console.log(`         - ${jobTitle} (${app.current_stage || 'N/A'})`);
			});
		} else {
			console.log(`      Sin aplicaciones`);
		}
		console.log('');
	}

	console.log('⚠️  ADVERTENCIA: Esto eliminará:');
	console.log('   - Los candidatos listados arriba');
	console.log('   - Todas sus aplicaciones asociadas (por CASCADE)');
	console.log('   - Todo el historial de etapas, notas y emails relacionados');
	console.log('');

	// Pedir confirmación
	const answer = await askQuestion('¿Estás seguro de que quieres eliminar estos candidatos? (escribe "SI" para confirmar): ');

	if (answer.trim().toUpperCase() !== 'SI') {
		console.log('\n❌ Operación cancelada');
		process.exit(0);
	}

	console.log('\n🗑️  Eliminando candidatos...\n');

	// Eliminar candidatos (esto también eliminará las aplicaciones por CASCADE)
	const candidateIds = candidates.map(c => c.id);
	const { error: deleteError } = await supabase
		.from('candidates')
		.delete()
		.in('id', candidateIds);

	if (deleteError) {
		console.error('❌ Error al eliminar candidatos:', deleteError.message);
		process.exit(1);
	}

	console.log(`✅ Se eliminaron ${candidates.length} candidato(s) exitosamente`);
	console.log('   (Las aplicaciones asociadas también fueron eliminadas por CASCADE)');
}

deleteGuidoGinesiCandidates().catch((e) => {
	console.error('❌ Error:', e);
	process.exit(1);
});

