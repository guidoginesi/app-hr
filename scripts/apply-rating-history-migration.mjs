import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyRatingHistoryMigration() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Leer el archivo de migración
    const migrationPath = join(__dirname, '..', 'db', 'migration-rating-history.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying rating_history migration...');
    console.log('SQL:', migrationSql);

    // Ejecutar cada statement por separado
    const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
            console.error('Error executing statement:', statement);
            console.error('Error:', error);
            // Continuar con los demás statements
        }
    }

    console.log('Rating history migration completed.');
    console.log('\nVerifying table creation...');
    
    const { data, error } = await supabase
        .from('rating_history')
        .select('count');
    
    if (error) {
        console.error('Verification failed:', error.message);
        console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
        console.log(migrationSql);
    } else {
        console.log('✅ Table rating_history created successfully!');
    }
}

applyRatingHistoryMigration();


