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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkData() {
  try {
    console.log('📊 Verificando datos en la base de datos...\n');
    console.log(`🔗 URL: ${supabaseUrl}\n`);

    // Verificar búsquedas
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, department, location, is_published, created_at')
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('❌ Error al obtener búsquedas:', jobsError.message);
    } else {
      console.log(`📋 Búsquedas (${jobs?.length || 0}):`);
      if (jobs && jobs.length > 0) {
        jobs.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.title} (${job.department || 'Sin área'}) - ${job.location || 'Sin ubicación'} - ${job.is_published ? 'Publicada' : 'Oculta'}`);
        });
      } else {
        console.log('   No hay búsquedas');
      }
    }

    console.log('\n');

    // Verificar candidatos
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (candidatesError) {
      console.error('❌ Error al obtener candidatos:', candidatesError.message);
    } else {
      console.log(`👥 Candidatos (mostrando últimos 10 de ${candidates?.length || 0}):`);
      if (candidates && candidates.length > 0) {
        candidates.forEach((candidate, index) => {
          console.log(`   ${index + 1}. ${candidate.name} (${candidate.email})`);
        });
      } else {
        console.log('   No hay candidatos');
      }
    }

    console.log('\n');

    // Verificar aplicaciones
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, created_at')
      .order('created_at', { ascending: false });

    if (appsError) {
      console.error('❌ Error al obtener aplicaciones:', appsError.message);
    } else {
      console.log(`📝 Aplicaciones: ${applications?.length || 0}`);
    }

    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();

