import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyNewEmailsMigration() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Leer el archivo de migración
    const migrationPath = join(__dirname, '..', 'db', 'migration-new-emails.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('📧 Applying new emails migration...');
    console.log('\n=== SQL a ejecutar ===\n');
    console.log(migrationSql);
    console.log('\n===================\n');

    console.log('\n⚠️  IMPORTANTE: Copia el SQL de arriba y ejecútalo manualmente en Supabase SQL Editor');
    console.log('🔗 Ve a: Supabase Dashboard > SQL Editor');
    console.log('\nEsto agregará:');
    console.log('  ✓ Campo is_active a email_templates');
    console.log('  ✓ Campo max_salary a jobs');
    console.log('  ✓ Plantilla: Email de Confirmación de Aplicación');
    console.log('  ✓ Plantilla: Email de Rechazo por Sueldo\n');

    console.log('\nDespués de ejecutar el SQL, verifica con:');
    console.log(`
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_templates' AND column_name = 'is_active';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'max_salary';

SELECT template_key, is_active FROM email_templates ORDER BY template_key;
    `);
}

applyNewEmailsMigration();



