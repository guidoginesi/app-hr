import { createClient } from '@supabase/supabase-js';

async function main() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const email = process.argv[2];
	const password = process.argv[3];

	if (!url || !serviceKey) {
		console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		process.exit(1);
	}
	if (!email || !password) {
		console.error('Usage: node scripts/create-admin.mjs <email> <password>');
		process.exit(1);
	}

	const supabase = createClient(url, serviceKey);
	
	// Primero buscar si el usuario ya existe
	const { data: existingUsers } = await supabase.auth.admin.listUsers();
	const existingUser = existingUsers?.users?.find(u => u.email === email);
	
	let userId;
	if (existingUser) {
		console.log('Usuario ya existe, usando el existente...');
		userId = existingUser.id;
	} else {
		// Crear nuevo usuario
		const { data, error } = await supabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true
		});
		if (error) {
			console.error('Error creating user:', error.message);
			process.exit(1);
		}
		userId = data.user.id;
		console.log('Usuario creado:', userId);
	}
	
	// Verificar si ya es admin
	const { data: existingAdmin } = await supabase
		.from('admins')
		.select('user_id')
		.eq('user_id', userId)
		.single();
	
	if (existingAdmin) {
		console.log('✅ El usuario ya es admin:', userId, email);
	} else {
		// Registrar como admin
		const { error: insertErr } = await supabase.from('admins').insert({ user_id: userId });
		if (insertErr) {
			console.error('Error al registrar como admin:', insertErr.message);
			process.exit(1);
		}
		console.log('✅ Admin registrado:', userId, email);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});


