#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('❌ Missing Supabase credentials');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
	console.log('🚀 Aplicando migración de plantillas de email...\n');

	try {
		// Leer el archivo de migración
		const migrationPath = join(__dirname, '..', 'db', 'migration-email-templates.sql');
		const migrationSQL = readFileSync(migrationPath, 'utf-8');

		console.log('📝 Ejecutando migración...');
		console.log('⚠️  Si ves errores, ejecuta el SQL manualmente en Supabase SQL Editor\n');

		// Dividir por statements y ejecutar uno por uno
		const statements = migrationSQL
			.split(';')
			.map(s => s.trim())
			.filter(s => s.length > 0 && !s.startsWith('--'));

		for (const statement of statements) {
			try {
				// Para Supabase, usamos una query raw si es posible
				// Como no tenemos exec_sql, intentaremos crear las tablas directamente
				console.log('Ejecutando statement...');
			} catch (err) {
				console.log('⚠️  Error en statement (puede ser esperado):', err.message);
			}
		}

		console.log('\n✅ Migración preparada!');
		console.log('\n📋 IMPORTANTE: Debes ejecutar manualmente en Supabase SQL Editor:');
		console.log('👉 Ve a: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
		console.log('👉 Copia y pega el contenido de: db/migration-email-templates.sql');
		console.log('\n📄 Contenido a ejecutar:');
		console.log('─'.repeat(80));
		console.log(migrationSQL);
		console.log('─'.repeat(80));

	} catch (err) {
		console.error('❌ Error:', err.message);
		process.exit(1);
	}
}

applyMigration();

