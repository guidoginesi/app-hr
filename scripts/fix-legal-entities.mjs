import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
	console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixLegalEntities() {
	console.log('🔍 Buscando legal entities...\n');

	// 1. Obtener todas las legal entities
	const { data: legalEntities, error: leError } = await supabase
		.from('legal_entities')
		.select('*')
		.order('created_at', { ascending: true });

	if (leError) {
		console.error('❌ Error al obtener legal entities:', leError);
		process.exit(1);
	}

	console.log('📋 Legal entities encontradas:');
	legalEntities.forEach((le, idx) => {
		console.log(`   ${idx + 1}. ${le.name} (ID: ${le.id})`);
	});
	console.log('');

	if (legalEntities.length < 2) {
		console.log('⚠️ Solo hay una legal entity, nada que hacer.');
		process.exit(0);
	}

	const firstEntity = legalEntities[0];
	const lastEntity = legalEntities[legalEntities.length - 1];

	console.log(`✅ Primera entidad (mantener): ${firstEntity.name}`);
	console.log(`🗑️ Última entidad (eliminar): ${lastEntity.name}\n`);

	// 2. Contar empleados por legal entity
	const { data: employeesByEntity, error: countError } = await supabase
		.from('employees')
		.select('id, first_name, last_name, legal_entity_id');

	if (countError) {
		console.error('❌ Error al contar empleados:', countError);
		process.exit(1);
	}

	const employeesInLast = employeesByEntity.filter(e => e.legal_entity_id === lastEntity.id);
	console.log(`👥 Empleados en "${lastEntity.name}": ${employeesInLast.length}`);
	if (employeesInLast.length > 0) {
		employeesInLast.forEach(e => console.log(`   - ${e.first_name} ${e.last_name}`));
	}
	console.log('');

	// 3. Reasignar empleados de la última entidad a la primera
	if (employeesInLast.length > 0) {
		console.log(`🔄 Reasignando ${employeesInLast.length} empleados a "${firstEntity.name}"...`);
		
		const { error: updateError } = await supabase
			.from('employees')
			.update({ legal_entity_id: firstEntity.id })
			.eq('legal_entity_id', lastEntity.id);

		if (updateError) {
			console.error('❌ Error al reasignar empleados:', updateError);
			process.exit(1);
		}
		console.log('✅ Empleados reasignados correctamente.\n');
	}

	// 4. Eliminar la última legal entity
	console.log(`🗑️ Eliminando legal entity "${lastEntity.name}"...`);
	
	const { error: deleteError } = await supabase
		.from('legal_entities')
		.delete()
		.eq('id', lastEntity.id);

	if (deleteError) {
		console.error('❌ Error al eliminar legal entity:', deleteError);
		console.error('   Puede que haya otras dependencias (jobs, etc.)');
		process.exit(1);
	}

	console.log('✅ Legal entity eliminada correctamente.\n');

	// 5. Verificar resultado final
	const { data: finalEntities } = await supabase
		.from('legal_entities')
		.select('*')
		.order('created_at', { ascending: true });

	console.log('📋 Legal entities finales:');
	finalEntities.forEach((le, idx) => {
		console.log(`   ${idx + 1}. ${le.name}`);
	});

	console.log('\n✅ ¡Proceso completado!');
}

fixLegalEntities().catch(console.error);
