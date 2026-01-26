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
	console.error('❌ Faltan variables de entorno');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function deleteGuidoGinesi() {
	console.log('🔍 Buscando empleados con nombre "Guido" y apellido "Ginesi"...\n');

	const { data: employees, error } = await supabase
		.from('employees')
		.select('*')
		.ilike('last_name', '%ginesi%')
		.order('first_name');

	if (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}

	console.log('📋 Empleados encontrados:');
	employees.forEach((e, idx) => {
		console.log(`   ${idx + 1}. ${e.first_name} ${e.last_name} (ID: ${e.id})`);
	});
	console.log('');

	// Find the one to delete (Guido Ginesi, not Guido Daniel Ginesi)
	const toDelete = employees.find(e => 
		e.first_name === 'Guido' && e.last_name === 'Ginesi'
	);

	const toKeep = employees.find(e => 
		e.first_name.includes('Daniel') || e.first_name === 'Guido Daniel'
	);

	if (!toDelete) {
		console.log('⚠️ No se encontró "Guido Ginesi" para eliminar');
		return;
	}

	console.log(`🗑️ Eliminar: ${toDelete.first_name} ${toDelete.last_name} (ID: ${toDelete.id})`);
	if (toKeep) {
		console.log(`✅ Mantener: ${toKeep.first_name} ${toKeep.last_name} (ID: ${toKeep.id})`);
	}
	console.log('');

	// Check if the one to delete has subordinates
	const { data: subordinates } = await supabase
		.from('employees')
		.select('id, first_name, last_name')
		.eq('manager_id', toDelete.id);

	if (subordinates && subordinates.length > 0) {
		console.log(`⚠️ ${toDelete.first_name} tiene ${subordinates.length} subordinados`);
		if (toKeep) {
			console.log(`🔄 Transfiriendo subordinados a ${toKeep.first_name} ${toKeep.last_name}`);
			await supabase
				.from('employees')
				.update({ manager_id: toKeep.id })
				.eq('manager_id', toDelete.id);
		} else {
			console.log('⚠️ Dejando subordinados sin manager');
			await supabase
				.from('employees')
				.update({ manager_id: null })
				.eq('manager_id', toDelete.id);
		}
	}

	// Delete the employee
	const { error: deleteError } = await supabase
		.from('employees')
		.delete()
		.eq('id', toDelete.id);

	if (deleteError) {
		console.error('❌ Error al eliminar:', deleteError);
		process.exit(1);
	}

	console.log(`✅ Eliminado: ${toDelete.first_name} ${toDelete.last_name}`);
	console.log('\n✅ ¡Proceso completado!');
}

deleteGuidoGinesi().catch(console.error);
