import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://galmfdqysnhmvzefidma.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbG1mZHF5c25obXZ6ZWZpZG1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMwOTk3NiwiZXhwIjoyMDc4ODg1OTc2fQ.ovFqFgdQurPRDEHb_YohIQkvrwu9NdcPfz2_qxkTE7o';

const supabase = createClient(supabaseUrl, serviceKey);

async function deleteAllCandidates() {
	console.log('🔍 Buscando todos los candidatos...\n');

	// Buscar todos los candidatos
	const { data: candidates, error: searchError } = await supabase
		.from('candidates')
		.select('id, name, email');

	if (searchError) {
		console.error('❌ Error al buscar candidatos:', searchError.message);
		process.exit(1);
	}

	if (!candidates || candidates.length === 0) {
		console.log('✅ No se encontraron candidatos');
		process.exit(0);
	}

	console.log(`📋 Encontrados ${candidates.length} candidatos:`);
	candidates.forEach((candidate, index) => {
		console.log(`   ${index + 1}. ${candidate.name} (${candidate.email}) - ID: ${candidate.id}`);
	});

	console.log('\n⚠️  ADVERTENCIA: Esto también eliminará todas las aplicaciones asociadas (por CASCADE)');
	console.log('🗑️  Eliminando candidatos...\n');

	// Eliminar todos los candidatos (esto también eliminará las aplicaciones por CASCADE)
	const candidateIds = candidates.map(c => c.id);
	const { error: deleteError } = await supabase
		.from('candidates')
		.delete()
		.in('id', candidateIds);

	if (deleteError) {
		console.error('❌ Error al eliminar candidatos:', deleteError.message);
		process.exit(1);
	}

	console.log(`✅ Se eliminaron ${candidates.length} candidatos exitosamente`);
	console.log('   (Las aplicaciones asociadas también fueron eliminadas por CASCADE)');
}

deleteAllCandidates().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

