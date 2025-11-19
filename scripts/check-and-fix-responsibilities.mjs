import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
	console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkAndFix() {
	console.log('🔍 Verificando columna responsibilities...\n');

	try {
		// Intentar seleccionar la columna responsibilities
		const { data, error } = await supabase
			.from('jobs')
			.select('id,title,responsibilities')
			.limit(1);

		if (error) {
			if (error.message.includes('column') && error.message.includes('responsibilities')) {
				console.log('❌ La columna responsibilities NO existe en la base de datos');
				console.log('\n📝 Necesitas ejecutar esta migración SQL en Supabase:\n');
				console.log('─'.repeat(60));
				console.log(`-- Add responsibilities column to jobs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'responsibilities'
  ) THEN
    ALTER TABLE public.jobs 
    ADD COLUMN responsibilities text;
  END IF;
END $$;`);
				console.log('─'.repeat(60));
				console.log('\n📍 Ve a tu proyecto de Supabase → SQL Editor → Ejecuta el SQL de arriba');
			} else {
				console.error('❌ Error:', error.message);
			}
		} else {
			console.log('✅ La columna responsibilities existe');
			console.log('\n📊 Verificando datos de ejemplo:');
			if (data && data.length > 0) {
				console.log(JSON.stringify(data[0], null, 2));
			} else {
				console.log('No hay datos de ejemplo');
			}
		}
	} catch (err) {
		console.error('❌ Error:', err.message);
	}
}

checkAndFix();

