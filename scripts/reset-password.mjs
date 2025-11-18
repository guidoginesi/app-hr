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
	const email = process.argv[2];
	const newPassword = process.argv[3];

	if (!url || !serviceKey) {
		console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		process.exit(1);
	}
	
	if (!email || !newPassword) {
		console.error('❌ Usage: node scripts/reset-password.mjs <email> <new-password>');
		console.error('\nEjemplo:');
		console.error('   node scripts/reset-password.mjs admin@pow.com nuevaPassword123');
		process.exit(1);
	}

	const supabase = createClient(url, serviceKey);
	
	console.log(`🔍 Buscando usuario: ${email}...\n`);
	
	// Buscar el usuario
	const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
	
	if (listError) {
		console.error('❌ Error al listar usuarios:', listError.message);
		process.exit(1);
	}

	const user = usersData?.users?.find(u => u.email === email);
	
	if (!user) {
		console.error(`❌ Usuario ${email} no encontrado`);
		console.error('\n💡 Para crear un nuevo usuario admin, ejecuta:');
		console.error('   node scripts/create-admin.mjs <email> <password>');
		process.exit(1);
	}

	console.log(`✅ Usuario encontrado: ${user.id}`);
	console.log(`🔄 Reseteando contraseña...\n`);

	// Actualizar la contraseña
	const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
		password: newPassword
	});

	if (error) {
		console.error('❌ Error al resetear contraseña:', error.message);
		process.exit(1);
	}

	console.log('✅ Contraseña actualizada exitosamente');
	console.log(`\n📧 Email: ${email}`);
	console.log(`🔑 Nueva contraseña: ${newPassword}`);
	console.log('\n💡 Ahora puedes iniciar sesión con estas credenciales');
}

main().catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});

