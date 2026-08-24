/**
 * Pone el calendario del equipo al día con las licencias que ya están en la base.
 *
 * Sirve para dos cosas: el backfill inicial —todo lo aprobado antes de que
 * existiera la integración— y el reintento de lo que quedó afuera si Google
 * estuvo caído un rato.
 *
 *   npx tsx scripts/sync-leave-calendar.mts --dry-run    # sólo informa
 *   npx tsx scripts/sync-leave-calendar.mts              # sincroniza
 *   npx tsx scripts/sync-leave-calendar.mts --desde 2026-01-01
 *
 * Por defecto toma las licencias que terminan de hoy en adelante: publicar
 * ausencias que ya pasaron llena el calendario de historia que nadie va a mirar.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { sincronizarLicencia } from '../src/lib/leaveCalendar';
import { calendarioConfigurado } from '../src/lib/googleCalendar';

const dryRun = process.argv.includes('--dry-run');
const iDesde = process.argv.indexOf('--desde');
const desde = iDesde >= 0 ? process.argv[iDesde + 1] : new Date().toISOString().slice(0, 10);

if (!calendarioConfigurado()) {
  console.error('Faltan GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY.');
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: licencias, error } = await db
  .from('leave_requests_with_details')
  .select('id, employee_name, leave_type_name, start_date, end_date, status, google_event_id')
  .eq('status', 'approved')
  .gte('end_date', desde)
  .order('start_date');

if (error) {
  console.error('No se pudieron leer las licencias:', error.message);
  process.exit(1);
}

const pendientes = (licencias ?? []).filter((l) => !l.google_event_id);
console.log(`${licencias?.length ?? 0} licencias aprobadas que terminan desde ${desde}.`);
console.log(`${pendientes.length} sin evento en el calendario.\n`);

if (dryRun) {
  for (const l of pendientes) {
    console.log(`  · ${l.start_date} → ${l.end_date}  ${l.leave_type_name} — ${l.employee_name}`);
  }
  console.log('\n(dry-run: no se tocó nada)');
  process.exit(0);
}

const conteo = { creado: 0, actualizado: 0, borrado: 0, sin_cambios: 0, error: 0 };

for (const l of licencias ?? []) {
  try {
    const r = await sincronizarLicencia(l.id as string);
    conteo[r]++;
    if (r === 'creado') console.log(`  ✅ ${l.start_date}  ${l.leave_type_name} — ${l.employee_name}`);
  } catch (e) {
    conteo.error++;
    console.error(`  ❌ ${l.leave_type_name} — ${l.employee_name}:`, e instanceof Error ? e.message : e);
  }
}

console.log('\n', conteo);
process.exit(conteo.error > 0 ? 1 : 0);
