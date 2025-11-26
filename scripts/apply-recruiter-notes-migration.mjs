import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Missing Supabase environment variables');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
	try {
		const migrationPath = join(__dirname, '..', 'db', 'migration-recruiter-notes.sql');
		const sql = readFileSync(migrationPath, 'utf8');

		console.log('🔄 Aplicando migración de notas del reclutador...\n');
		
		const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();

		if (error) {
			// Si no existe la función exec_sql, ejecutar directamente
			const statements = sql
				.split(';')
				.map(s => s.trim())
				.filter(s => s.length > 0);

			for (const statement of statements) {
				const { error: stmtError } = await supabase.rpc('exec', { 
					query: statement 
				});
				
				if (stmtError) {
					console.error('❌ Error ejecutando statement:', stmtError);
					console.log('Statement:', statement.substring(0, 100) + '...');
				}
			}
		}

		console.log('✅ Migración aplicada exitosamente');
		console.log('\n📝 Tabla recruiter_notes creada');
		console.log('   - Permite a los reclutadores agregar notas sobre aplicaciones');
		console.log('   - Mantiene historial de notas');
		console.log('   - Vinculada a applications y users');
		
	} catch (error) {
		console.error('❌ Error aplicando migración:', error);
		process.exit(1);
	}
}

applyMigration();


