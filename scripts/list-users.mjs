import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function main() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		console.error('Asegúrate de tener un archivo .env.local con estas variables');
		process.exit(1);
	}

	const supabase = createClient(url, serviceKey);
	
	console.log('🔍 Buscando usuarios en Supabase Auth...\n');
	
	const { data: usersData, error } = await supabase.auth.admin.listUsers();
	
	if (error) {
		console.error('❌ Error al listar usuarios:', error.message);
		process.exit(1);
	}

	if (!usersData?.users || usersData.users.length === 0) {
		console.log('⚠️  No hay usuarios registrados en Supabase Auth');
		console.log('\n💡 Para crear un usuario admin, ejecuta:');
		console.log('   node scripts/create-admin.mjs <email> <password>');
		process.exit(0);
	}

	console.log(`✅ Encontrados ${usersData.users.length} usuario(s):\n`);
	
	for (const user of usersData.users) {
		// Verificar si es admin
		const { data: adminData } = await supabase
			.from('admins')
			.select('user_id')
			.eq('user_id', user.id)
			.single();
		
		const isAdmin = !!adminData;
		const adminStatus = isAdmin ? '✅ Admin' : '❌ No es admin';
		
		console.log(`📧 ${user.email}`);
		console.log(`   ID: ${user.id}`);
		console.log(`   Estado: ${adminStatus}`);
		console.log(`   Creado: ${new Date(user.created_at).toLocaleString('es-AR')}`);
		console.log('');
	}
	
	console.log('\n💡 Si necesitas crear un nuevo admin:');
	console.log('   node scripts/create-admin.mjs <email> <password>');
}

main().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

