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

async function fixDepartments() {
	console.log('🔍 Obteniendo datos...\n');

	// 1. Obtener la legal entity de Pow S.A.
	const { data: legalEntities } = await supabase
		.from('legal_entities')
		.select('*')
		.order('created_at', { ascending: true });

	const powEntity = legalEntities[0];
	console.log(`✅ Legal entity principal: ${powEntity.name} (ID: ${powEntity.id})\n`);

	// 2. Obtener todos los departamentos
	const { data: departments } = await supabase
		.from('departments')
		.select('*')
		.order('name', { ascending: true });

	const powDepts = departments.filter(d => d.legal_entity_id === powEntity.id);
	const otherDepts = departments.filter(d => d.legal_entity_id !== powEntity.id);

	console.log(`✅ Departamentos de Pow S.A. (mantener): ${powDepts.length}`);
	powDepts.forEach(d => console.log(`   - ${d.name}`));
	console.log(`\n🗑️ Departamentos a eliminar: ${otherDepts.length}`);
	otherDepts.forEach(d => console.log(`   - ${d.name}`));

	// 3. Poner department_id = null a empleados con departamentos no de Pow S.A.
	const otherDeptIds = otherDepts.map(d => d.id);
	
	const { data: employees } = await supabase
		.from('employees')
		.select('id, first_name, last_name, department_id');

	const employeesToUpdate = employees.filter(e => otherDeptIds.includes(e.department_id));
	
	console.log(`\n👥 Empleados a dejar sin departamento: ${employeesToUpdate.length}`);
	
	for (const emp of employeesToUpdate) {
		const dept = otherDepts.find(d => d.id === emp.department_id);
		console.log(`   - ${emp.first_name} ${emp.last_name} (tenía: ${dept?.name})`);
		
		await supabase
			.from('employees')
			.update({ department_id: null })
			.eq('id', emp.id);
	}

	// 4. Eliminar departamentos que no son de Pow S.A.
	console.log(`\n🗑️ Eliminando ${otherDepts.length} departamentos...`);
	
	for (const dept of otherDepts) {
		const { error } = await supabase
			.from('departments')
			.delete()
			.eq('id', dept.id);

		if (error) {
			console.error(`   ❌ Error al eliminar ${dept.name}:`, error.message);
		} else {
			console.log(`   ✅ Eliminado: ${dept.name}`);
		}
	}

	// 5. Resultado final
	const { data: finalDepts } = await supabase
		.from('departments')
		.select('*')
		.order('name', { ascending: true });

	console.log('\n📋 Departamentos finales:');
	finalDepts.forEach((d, idx) => {
		console.log(`   ${idx + 1}. ${d.name}`);
	});

	console.log('\n✅ ¡Proceso completado!');
}

fixDepartments().catch(console.error);
