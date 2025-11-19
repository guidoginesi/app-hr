import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración work_mode...\n');

    // Leer el archivo SQL
    const sqlPath = join(__dirname, '..', 'db', 'migration-work-mode.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Ejecutar la migración
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Si el RPC no existe, intentar ejecutar directamente
      console.log('⚠️  RPC no disponible, intentando método alternativo...\n');
      console.log('📝 Por favor ejecuta este SQL manualmente en Supabase SQL Editor:\n');
      console.log(sql);
      console.log('\n');
      return;
    }

    console.log('✅ Migración aplicada exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Por favor ejecuta este SQL manualmente en Supabase SQL Editor:\n');
    const sqlPath = join(__dirname, '..', 'db', 'migration-work-mode.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    console.log(sql);
  }
}

applyMigration();

