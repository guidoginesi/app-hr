import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
	console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function applyMigration() {
	console.log('📋 Aplicando migración: responsibilities column...\n');

	try {
		// Leer el archivo SQL
		const sqlPath = join(__dirname, '../db/migration-responsibilities.sql');
		const sql = readFileSync(sqlPath, 'utf-8');

		// Ejecutar el SQL usando RPC (si está disponible) o directamente
		const { data, error } = await supabase.rpc('exec_sql', { sql }).catch(async () => {
			// Si RPC no está disponible, intentar ejecutar directamente
			// Nota: Supabase no permite ejecutar SQL arbitrario desde el cliente
			// Necesitamos usar el SQL Editor de Supabase
			console.log('⚠️  No se puede ejecutar SQL directamente desde el cliente.');
			console.log('📝 Por favor, ejecuta el siguiente SQL en el SQL Editor de Supabase:\n');
			console.log('─'.repeat(60));
			console.log(sql);
			console.log('─'.repeat(60));
			return { data: null, error: null };
		});

		if (error) {
			console.error('❌ Error:', error.message);
			console.log('\n📝 Por favor, ejecuta el siguiente SQL manualmente en el SQL Editor de Supabase:\n');
			console.log('─'.repeat(60));
			console.log(sql);
			console.log('─'.repeat(60));
			return;
		}

		console.log('✅ Migración aplicada correctamente');
	} catch (err) {
		console.error('❌ Error al aplicar migración:', err.message);
		console.log('\n📝 Por favor, ejecuta el siguiente SQL manualmente en el SQL Editor de Supabase:\n');
		const sqlPath = join(__dirname, '../db/migration-responsibilities.sql');
		const sql = readFileSync(sqlPath, 'utf-8');
		console.log('─'.repeat(60));
		console.log(sql);
		console.log('─'.repeat(60));
	}
}

applyMigration();

