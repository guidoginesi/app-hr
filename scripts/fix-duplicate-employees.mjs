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

// Count non-null fields in an employee record
function countFilledFields(emp) {
	const fieldsToCheck = [
		'work_email', 'nationality', 'birth_date', 'phone', 'marital_status',
		'photo_url', 'cuil', 'dni', 'address', 'city', 'postal_code', 'country',
		'education_level', 'education_title', 'languages',
		'emergency_contact_relationship', 'emergency_contact_first_name',
		'emergency_contact_last_name', 'emergency_contact_address', 'emergency_contact_phone',
		'legal_entity_id', 'department_id', 'manager_id', 'job_title', 'seniority_level',
		'hire_date'
	];
	
	return fieldsToCheck.filter(field => emp[field] !== null && emp[field] !== '').length;
}

async function findAndFixDuplicates() {
	console.log('🔍 Buscando empleados duplicados...\n');

	// 1. Obtener todos los empleados
	const { data: employees, error } = await supabase
		.from('employees')
		.select('*')
		.order('created_at', { ascending: true });

	if (error) {
		console.error('❌ Error al obtener empleados:', error);
		process.exit(1);
	}

	console.log(`📋 Total de empleados: ${employees.length}\n`);

	// 2. Agrupar por nombre completo normalizado
	const groups = {};
	employees.forEach(emp => {
		const key = `${emp.first_name.toLowerCase().trim()} ${emp.last_name.toLowerCase().trim()}`;
		if (!groups[key]) {
			groups[key] = [];
		}
		groups[key].push(emp);
	});

	// 3. Encontrar duplicados
	const duplicateGroups = Object.entries(groups).filter(([_, emps]) => emps.length > 1);

	if (duplicateGroups.length === 0) {
		console.log('✅ No se encontraron empleados duplicados.');
		return;
	}

	console.log(`⚠️ Se encontraron ${duplicateGroups.length} grupos de duplicados:\n`);

	const toDelete = [];

	for (const [name, emps] of duplicateGroups) {
		console.log(`👤 ${emps[0].first_name} ${emps[0].last_name} (${emps.length} registros)`);
		
		// Sort by filled fields (most complete first), then by created_at (oldest first as tiebreaker)
		const sorted = emps.map(emp => ({
			...emp,
			filledCount: countFilledFields(emp)
		})).sort((a, b) => {
			if (b.filledCount !== a.filledCount) {
				return b.filledCount - a.filledCount; // More fields = keep
			}
			return new Date(a.created_at) - new Date(b.created_at); // Older = keep
		});

		const keep = sorted[0];
		const remove = sorted.slice(1);

		console.log(`   ✅ Mantener: ID ${keep.id} (${keep.filledCount} campos, email: ${keep.personal_email})`);
		remove.forEach(emp => {
			console.log(`   🗑️ Eliminar: ID ${emp.id} (${emp.filledCount} campos, email: ${emp.personal_email})`);
			toDelete.push(emp);
		});
		console.log('');
	}

	if (toDelete.length === 0) {
		console.log('✅ No hay duplicados para eliminar.');
		return;
	}

	// 4. Eliminar duplicados
	console.log(`\n🗑️ Eliminando ${toDelete.length} registros duplicados...\n`);

	for (const emp of toDelete) {
		// First, update any employees that have this as manager
		const { data: subordinates } = await supabase
			.from('employees')
			.select('id, first_name, last_name')
			.eq('manager_id', emp.id);

		if (subordinates && subordinates.length > 0) {
			console.log(`   ⚠️ ${emp.first_name} ${emp.last_name} tiene ${subordinates.length} subordinados`);
			
			// Find the kept duplicate to transfer subordinates
			const keptDuplicate = employees.find(e => 
				e.first_name.toLowerCase() === emp.first_name.toLowerCase() &&
				e.last_name.toLowerCase() === emp.last_name.toLowerCase() &&
				e.id !== emp.id &&
				!toDelete.find(d => d.id === e.id)
			);

			if (keptDuplicate) {
				console.log(`   🔄 Transfiriendo subordinados a ID ${keptDuplicate.id}`);
				await supabase
					.from('employees')
					.update({ manager_id: keptDuplicate.id })
					.eq('manager_id', emp.id);
			} else {
				console.log(`   ⚠️ Dejando subordinados sin manager`);
				await supabase
					.from('employees')
					.update({ manager_id: null })
					.eq('manager_id', emp.id);
			}
		}

		// Delete the duplicate
		const { error: deleteError } = await supabase
			.from('employees')
			.delete()
			.eq('id', emp.id);

		if (deleteError) {
			console.error(`   ❌ Error al eliminar ${emp.first_name} ${emp.last_name}:`, deleteError.message);
		} else {
			console.log(`   ✅ Eliminado: ${emp.first_name} ${emp.last_name}`);
		}
	}

	// 5. Resultado final
	const { data: finalEmployees } = await supabase
		.from('employees')
		.select('id')
		.eq('status', 'active');

	console.log(`\n✅ ¡Proceso completado! Empleados activos: ${finalEmployees?.length || 0}`);
}

findAndFixDuplicates().catch(console.error);
