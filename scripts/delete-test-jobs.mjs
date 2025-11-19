import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const testJobTitles = [
  'Product Designer',
  'Product Design Lead',
  'Lead Developer',
  'Digital Project Manager'
];

async function deleteTestJobs() {
  try {
    console.log('🗑️  Buscando búsquedas de prueba...\n');

    // Buscar las búsquedas por título
    const { data: jobs, error: searchError } = await supabase
      .from('jobs')
      .select('id, title')
      .in('title', testJobTitles);

    if (searchError) {
      console.error('❌ Error al buscar búsquedas:', searchError.message);
      process.exit(1);
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ No se encontraron búsquedas de prueba para eliminar');
      process.exit(0);
    }

    console.log(`📋 Encontradas ${jobs.length} búsquedas de prueba:`);
    jobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.title} (ID: ${job.id})`);
    });

    console.log('\n🗑️  Eliminando búsquedas...\n');

    // Eliminar las búsquedas
    const jobIds = jobs.map(j => j.id);
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .in('id', jobIds);

    if (deleteError) {
      console.error('❌ Error al eliminar búsquedas:', deleteError.message);
      process.exit(1);
    }

    console.log(`✅ Se eliminaron ${jobs.length} búsquedas de prueba exitosamente`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteTestJobs();

