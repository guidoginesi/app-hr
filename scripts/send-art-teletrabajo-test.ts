/**
 * Envío de prueba del PDF Teletrabajo ART.
 *
 * Uso:
 *   npx tsx scripts/send-art-teletrabajo-test.ts
 *   npx tsx scripts/send-art-teletrabajo-test.ts --type post_return
 *   npx tsx scripts/send-art-teletrabajo-test.ts --roster-date 2026-05-25
 *
 * Requiere .env.local con SUPABASE + RESEND (+ migración art_teletrabajo_notifications).
 */
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { sendArtTeletrabajoNotification } from '../src/lib/artTeletrabajo/sendNotification';
import { getArtTeletrabajoConfig } from '../src/lib/artTeletrabajo/roster';
import { getArgentinaDateString, addDaysToDateString } from '../src/lib/artTeletrabajo/timezone';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function parseArgs() {
  const args = process.argv.slice(2);
  let type: 'pre_departure' | 'post_return' = 'pre_departure';
  let rosterDate: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      type = args[i + 1] as 'pre_departure' | 'post_return';
      i++;
    } else if (args[i] === '--roster-date' && args[i + 1]) {
      rosterDate = args[i + 1];
      i++;
    }
  }

  return { type, rosterDate };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ Falta RESEND_API_KEY en .env.local');
    process.exit(1);
  }

  const { type, rosterDate: rosterDateArg } = parseArgs();
  const config = getArtTeletrabajoConfig();
  const today = getArgentinaDateString();
  const rosterDate =
    rosterDateArg ?? (type === 'pre_departure' ? addDaysToDateString(today, 1) : today);

  console.log('📋 Configuración de prueba');
  console.log('   Supabase:', url);
  console.log('   Destinatarios:', config.recipients.join(', '));
  console.log('   Empleador:', config.employerName, config.employerCuit ? `(CUIT ${config.employerCuit})` : '(sin CUIT)');
  console.log('   Tipo:', type);
  console.log('   Fecha listado (roster):', rosterDate);
  console.log('   Trigger date:', today);
  console.log('');

  const supabase = createClient(url, serviceKey);

  const result = await sendArtTeletrabajoNotification({
    supabase,
    notificationType: type,
    triggerDate: today,
    rosterDate,
    triggers: [],
    force: true,
  });

  if (result.skipped) {
    console.log('⏭️  Envío omitido:', result.reason);
    process.exit(0);
  }

  console.log('✅ Mail enviado');
  console.log('   Resend ID:', result.resendId);
  console.log('   Archivo:', result.filename);
  console.log('   Empleados en PDF:', result.employeeCount);
  console.log('   Para:', result.recipients?.join(', '));
  console.log('');
  console.log('Verificá:');
  console.log('   1. Bandeja de entrada (y spam) de los destinatarios');
  console.log('   2. Resend Dashboard → Logs → buscar ID', result.resendId);
  console.log('   3. Supabase → art_teletrabajo_notifications (último registro)');
}

main().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
