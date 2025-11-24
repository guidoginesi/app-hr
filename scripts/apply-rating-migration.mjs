import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Missing Supabase environment variables');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
	try {
		console.log('Applying recruiter rating migration...');
		
		const migrationPath = join(__dirname, '..', 'db', 'migration-recruiter-rating.sql');
		const sql = readFileSync(migrationPath, 'utf8');
		
		const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
		
		if (error) {
			console.error('Error applying migration:', error);
			process.exit(1);
		}
		
		console.log('✅ Migration applied successfully!');
		console.log('The recruiter_rating column has been added to the applications table.');
		
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

applyMigration();

