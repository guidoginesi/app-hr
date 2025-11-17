import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://galmfdqysnhmvzefidma.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbG1mZHF5c25obXZ6ZWZpZG1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMwOTk3NiwiZXhwIjoyMDc4ODg1OTc2fQ.ovFqFgdQurPRDEHb_YohIQkvrwu9NdcPfz2_qxkTE7o';

const supabase = createClient(supabaseUrl, serviceKey);

async function deleteMarketingJobs() {
	console.log('🔍 Buscando búsquedas de Marketing Digital...\n');

	// Buscar todas las búsquedas con department = "Marketing Digital"
	const { data: jobs, error: searchError } = await supabase
		.from('jobs')
		.select('id, title, department')
		.eq('department', 'Marketing Digital');

	if (searchError) {
		console.error('❌ Error al buscar búsquedas:', searchError.message);
		process.exit(1);
	}

	if (!jobs || jobs.length === 0) {
		console.log('✅ No se encontraron búsquedas de Marketing Digital');
		process.exit(0);
	}

	console.log(`📋 Encontradas ${jobs.length} búsquedas de Marketing Digital:`);
	jobs.forEach((job, index) => {
		console.log(`   ${index + 1}. ${job.title} (ID: ${job.id})`);
	});

	console.log('\n🗑️  Eliminando búsquedas...\n');

	// Eliminar todas las búsquedas encontradas
	const jobIds = jobs.map(job => job.id);
	const { error: deleteError } = await supabase
		.from('jobs')
		.delete()
		.in('id', jobIds);

	if (deleteError) {
		console.error('❌ Error al eliminar búsquedas:', deleteError.message);
		process.exit(1);
	}

	console.log(`✅ Se eliminaron ${jobs.length} búsquedas de Marketing Digital exitosamente`);
}

deleteMarketingJobs().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

