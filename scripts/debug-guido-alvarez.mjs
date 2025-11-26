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

async function debugGuidoAlvarez() {
	console.log('🔍 Buscando candidato Guido Alvarez...\n');

	// Buscar candidato
	const { data: candidate, error: candError } = await supabase
		.from('candidates')
		.select('*')
		.ilike('name', '%Guido%Alvarez%')
		.maybeSingle();

	if (candError || !candidate) {
		console.log('❌ No se encontró el candidato');
		console.error(candError);
		process.exit(1);
	}

	console.log('✅ Candidato encontrado:');
	console.log(`   ID: ${candidate.id}`);
	console.log(`   Nombre: ${candidate.name}`);
	console.log(`   Email: ${candidate.email}`);
	console.log(`   Creado: ${candidate.created_at}\n`);

	// Buscar aplicaciones
	const { data: applications, error: appError } = await supabase
		.from('applications')
		.select('*')
		.eq('candidate_id', candidate.id);

	if (appError) {
		console.error('Error obteniendo aplicaciones:', appError);
		process.exit(1);
	}

	console.log(`📊 Aplicaciones: ${applications.length}\n`);

	for (const app of applications) {
		console.log(`\n📋 Aplicación ${app.id}:`);
		console.log(`   Job ID: ${app.job_id}`);
		console.log(`   Etapa actual: ${app.current_stage}`);
		console.log(`   Estado: ${app.current_stage_status}`);
		console.log(`   Creado: ${app.created_at}`);
		console.log(`   Actualizado: ${app.updated_at}`);

		// Obtener historial
		const { data: history, error: histError } = await supabase
			.from('stage_history')
			.select('*')
			.eq('application_id', app.id)
			.order('changed_at', { ascending: true });

		if (histError) {
			console.error('   Error obteniendo historial:', histError);
			continue;
		}

		console.log(`\n   📜 Historial de etapas (${history.length} entradas):`);
		history.forEach((h, i) => {
			console.log(`\n   ${i + 1}. ${h.from_stage || 'INICIO'} → ${h.to_stage}`);
			console.log(`      Estado: ${h.status}`);
			console.log(`      Fecha: ${h.changed_at}`);
			if (h.notes) console.log(`      Notas: ${h.notes}`);
		});

		// Calcular tiempo en etapa actual
		const now = new Date();
		const hrReviewEntry = history.find(h => h.to_stage === app.current_stage);
		if (hrReviewEntry) {
			const entryDate = new Date(hrReviewEntry.changed_at);
			const diffMs = now.getTime() - entryDate.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
			
			console.log(`\n   ⏱️  Tiempo en ${app.current_stage}:`);
			console.log(`      Entrada: ${hrReviewEntry.changed_at}`);
			console.log(`      Ahora: ${now.toISOString()}`);
			console.log(`      Diferencia: ${diffDays} días, ${diffHours} horas`);
		}
	}
}

debugGuidoAlvarez().catch(console.error);


