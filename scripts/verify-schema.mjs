import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://galmfdqysnhmvzefidma.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbG1mZHF5c25obXZ6ZWZpZG1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMwOTk3NiwiZXhwIjoyMDc4ODg1OTc2fQ.ovFqFgdQurPRDEHb_YohIQkvrwu9NdcPfz2_qxkTE7o';

const supabase = createClient(supabaseUrl, serviceKey);

const expectedTables = {
  jobs: ['id', 'title', 'department', 'location', 'description', 'requirements', 'is_published', 'created_at'],
  candidates: ['id', 'name', 'email', 'linkedin_url', 'created_at'],
  applications: ['id', 'candidate_id', 'job_id', 'resume_url', 'status', 'ai_extracted', 'ai_score', 'ai_reasons', 'ai_match_highlights', 'created_at'],
  admins: ['user_id', 'created_at']
};

async function verifySchema() {
  console.log('🔍 Verificando esquema de base de datos...\n');

  let allOk = true;

  for (const [tableName, expectedColumns] of Object.entries(expectedTables)) {
    try {
      // Intentar hacer una query simple para verificar que la tabla existe
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        console.log(`❌ Tabla '${tableName}': ERROR - ${error.message}`);
        allOk = false;
        continue;
      }

      // Si la query funciona, la tabla existe
      console.log(`✅ Tabla '${tableName}': Existe`);
      
      // Intentar verificar columnas con una query de muestra
      const { data: sampleData } = await supabase.from(tableName).select('*').limit(1);
      if (sampleData !== null && sampleData.length > 0) {
        const actualColumns = Object.keys(sampleData[0]);
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
        if (missingColumns.length > 0) {
          console.log(`   ⚠️  Faltan columnas: ${missingColumns.join(', ')}`);
          allOk = false;
        } else {
          console.log(`   ✅ Columnas correctas (${expectedColumns.length} esperadas)`);
        }
      } else {
        console.log(`   ℹ️  Tabla vacía (no se pueden verificar columnas, pero existe)`);
      }
    } catch (err) {
      console.log(`❌ Tabla '${tableName}': ERROR - ${err.message}`);
      allOk = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allOk) {
    console.log('✅ Todas las tablas están correctamente configuradas');
  } else {
    console.log('❌ Hay problemas con el esquema. Revisa los errores arriba.');
  }
  console.log('='.repeat(50));
}

verifySchema().catch(console.error);

