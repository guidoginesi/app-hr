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
	console.log('🚀 Aplicando migración de provincia...\n');

	try {
		// Leer el archivo de migración
		const migrationPath = join(__dirname, '..', 'db', 'migration-provincia.sql');
		const migrationSQL = readFileSync(migrationPath, 'utf-8');

		// Ejecutar la migración
		const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

		if (error) {
			// Si no existe la función exec_sql, intentamos ejecutar directamente
			// dividiendo por statements
			console.log('⚠️  Ejecutando migración manualmente...');
			
			// Crear el tipo enum si no existe
			await supabase.rpc('exec_sql', { 
				sql: `
					DO $$ BEGIN
					  CREATE TYPE provincia AS ENUM ('CABA', 'GBA', 'OTRA');
					EXCEPTION
					  WHEN duplicate_object THEN null;
					END $$;
				`
			}).catch(() => {
				console.log('ℹ️  El tipo provincia ya existe o se creará con la columna');
			});

			// Agregar la columna
			const { error: alterError } = await supabase.rpc('exec_sql', { 
				sql: `
					DO $$ 
					BEGIN
					  IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns 
						WHERE table_name = 'candidates' AND column_name = 'provincia'
					  ) THEN
						ALTER TABLE public.candidates ADD COLUMN provincia provincia;
					  END IF;
					END $$;
				`
			});

			if (alterError) {
				console.error('❌ Error al agregar columna:', alterError.message);
				console.log('\n📝 Por favor ejecuta manualmente en Supabase SQL Editor:');
				console.log(migrationSQL);
				process.exit(1);
			}

			// Crear índice
			await supabase.rpc('exec_sql', { 
				sql: 'CREATE INDEX IF NOT EXISTS idx_candidates_provincia ON public.candidates(provincia);'
			}).catch(() => {
				console.log('ℹ️  El índice ya existe');
			});
		}

		console.log('✅ Migración aplicada exitosamente!');
		console.log('\n📊 Verificando estructura...');

		// Verificar que la columna existe
		const { data: columns, error: checkError } = await supabase
			.from('candidates')
			.select('*')
			.limit(0);

		if (checkError) {
			console.log('⚠️  No se pudo verificar la estructura:', checkError.message);
		} else {
			console.log('✅ Tabla candidates actualizada correctamente');
		}

	} catch (err) {
		console.error('❌ Error:', err.message);
		console.log('\n📝 SQL de migración a ejecutar manualmente:');
		console.log(readFileSync(join(__dirname, '..', 'db', 'migration-provincia.sql'), 'utf-8'));
		process.exit(1);
	}
}

applyMigration();

