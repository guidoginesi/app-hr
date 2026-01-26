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

async function fixDepartments() {
	console.log('🔍 Buscando legal entity de Pow S.A....\n');

	// 1. Obtener la legal entity de Pow S.A.
	const { data: legalEntities, error: leError } = await supabase
		.from('legal_entities')
		.select('*')
		.order('created_at', { ascending: true });

	if (leError) {
		console.error('❌ Error al obtener legal entities:', leError);
		process.exit(1);
	}

	const powEntity = legalEntities[0];
	console.log(`✅ Legal entity principal: ${powEntity.name} (ID: ${powEntity.id})\n`);

	// 2. Obtener todos los departamentos
	const { data: departments, error: deptError } = await supabase
		.from('departments')
		.select('*')
		.order('name', { ascending: true });

	if (deptError) {
		console.error('❌ Error al obtener departamentos:', deptError);
		process.exit(1);
	}

	console.log('📋 Departamentos encontrados:');
	departments.forEach(d => {
		const isPow = d.legal_entity_id === powEntity.id;
		console.log(`   ${isPow ? '✅' : '❌'} ${d.name} (ID: ${d.id}) - Legal Entity: ${d.legal_entity_id}`);
	});
	console.log('');

	// Separar departamentos de Pow S.A. y otros
	const powDepts = departments.filter(d => d.legal_entity_id === powEntity.id);
	const otherDepts = departments.filter(d => d.legal_entity_id !== powEntity.id);

	console.log(`✅ Departamentos de Pow S.A.: ${powDepts.length}`);
	console.log(`🗑️ Departamentos de otras entidades: ${otherDepts.length}\n`);

	if (otherDepts.length === 0) {
		console.log('⚠️ No hay departamentos de otras entidades, nada que hacer.');
		process.exit(0);
	}

	// 3. Obtener empleados con departamentos de otras entidades
	const { data: employees, error: empError } = await supabase
		.from('employees')
		.select('id, first_name, last_name, department_id');

	if (empError) {
		console.error('❌ Error al obtener empleados:', empError);
		process.exit(1);
	}

	const otherDeptIds = otherDepts.map(d => d.id);
	const employeesWithOtherDepts = employees.filter(e => otherDeptIds.includes(e.department_id));

	console.log(`👥 Empleados con departamentos de otras entidades: ${employeesWithOtherDepts.length}`);
	
	// 4. Reasignar empleados a departamentos de Pow S.A.
	for (const emp of employeesWithOtherDepts) {
		const currentDept = otherDepts.find(d => d.id === emp.department_id);
		if (!currentDept) continue;

		// Buscar departamento equivalente en Pow S.A. por nombre
		const powDept = powDepts.find(d => d.name.toLowerCase() === currentDept.name.toLowerCase());
		
		if (powDept) {
			console.log(`   🔄 ${emp.first_name} ${emp.last_name}: ${currentDept.name} → ${powDept.name}`);
			
			const { error: updateError } = await supabase
				.from('employees')
				.update({ department_id: powDept.id })
				.eq('id', emp.id);

			if (updateError) {
				console.error(`   ❌ Error al actualizar ${emp.first_name}:`, updateError);
			}
		} else {
			console.log(`   ⚠️ ${emp.first_name} ${emp.last_name}: No se encontró departamento equivalente para "${currentDept.name}"`);
		}
	}
	console.log('');

	// 5. Verificar que no hay más empleados con departamentos de otras entidades
	const { data: remainingEmps } = await supabase
		.from('employees')
		.select('id, department_id')
		.in('department_id', otherDeptIds);

	if (remainingEmps && remainingEmps.length > 0) {
		console.log(`⚠️ Aún hay ${remainingEmps.length} empleados con departamentos de otras entidades.`);
		console.log('   No se eliminarán esos departamentos para evitar errores.\n');
		
		// Filtrar los departamentos que aún tienen empleados
		const deptIdsWithEmployees = remainingEmps.map(e => e.department_id);
		const deptsToDelete = otherDepts.filter(d => !deptIdsWithEmployees.includes(d.id));
		
		if (deptsToDelete.length > 0) {
			console.log(`🗑️ Eliminando ${deptsToDelete.length} departamentos sin empleados...`);
			for (const dept of deptsToDelete) {
				const { error: deleteError } = await supabase
					.from('departments')
					.delete()
					.eq('id', dept.id);

				if (deleteError) {
					console.error(`   ❌ Error al eliminar ${dept.name}:`, deleteError);
				} else {
					console.log(`   ✅ Eliminado: ${dept.name}`);
				}
			}
		}
	} else {
		// 6. Eliminar departamentos de otras entidades
		console.log(`🗑️ Eliminando ${otherDepts.length} departamentos de otras entidades...`);
		
		for (const dept of otherDepts) {
			const { error: deleteError } = await supabase
				.from('departments')
				.delete()
				.eq('id', dept.id);

			if (deleteError) {
				console.error(`   ❌ Error al eliminar ${dept.name}:`, deleteError);
			} else {
				console.log(`   ✅ Eliminado: ${dept.name}`);
			}
		}
	}

	console.log('');

	// 7. Verificar resultado final
	const { data: finalDepts } = await supabase
		.from('departments')
		.select('*')
		.order('name', { ascending: true });

	console.log('📋 Departamentos finales:');
	finalDepts.forEach((d, idx) => {
		console.log(`   ${idx + 1}. ${d.name}`);
	});

	console.log('\n✅ ¡Proceso completado!');
}

fixDepartments().catch(console.error);
