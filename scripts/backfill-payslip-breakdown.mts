/**
 * Lee los recibos de relación de dependencia que ya estaban subidos y guarda su
 * desglose. De acá en adelante lo hace sola la ruta de subida; esto es para lo
 * que quedó cargado antes.
 *
 *   npx tsx scripts/backfill-payslip-breakdown.mts --dry-run   # sólo informa
 *   npx tsx scripts/backfill-payslip-breakdown.mts             # guarda
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { parsearYGuardarDesglose } from '../src/lib/payslipBreakdown';

const dryRun = process.argv.includes('--dry-run');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: settlements, error } = await db
  .from('payroll_settlements_with_details')
  .select('id, period_key, first_name, last_name, sent_at')
  .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
  .not('sent_at', 'is', null)
  .order('period_key');

if (error) {
  console.error('No se pudieron leer las liquidaciones:', error.message);
  process.exit(1);
}

console.log(`${dryRun ? '[DRY RUN] ' : ''}${settlements!.length} liquidaciones de relación de dependencia enviadas\n`);

const conteo = { OK: 0, PARCIAL: 0, ERROR: 0 } as Record<string, number>;
const descartados: string[] = [];
const sinContribuciones: string[] = [];
const periodoInesperado: string[] = [];
const problemas: string[] = [];
const corrimientos = new Map<number, number>();

for (const s of settlements!) {
  const quien = `${s.period_key} ${s.last_name}, ${s.first_name}`;
  const { estado, desglose } = await parsearYGuardarDesglose(s.id, s.period_key, {
    guardar: !dryRun,
  });
  conteo[estado] = (conteo[estado] ?? 0) + 1;

  for (const recibo of desglose.recibos) {
    if (recibo.descartado_por) {
      descartados.push(`${quien} — archivo ${recibo.slot} p${recibo.pagina} (${recibo.tipo}) → ${recibo.descartado_por}`);
      continue;
    }
    if (recibo.contribuciones_total === null) sinContribuciones.push(`${quien} (plantilla ${recibo.plantilla})`);
    if (recibo.periodo_inesperado) {
      periodoInesperado.push(`${quien} — el PDF dice ${recibo.periodo_pdf}`);
    }
    if (recibo.periodo_pdf) {
      const [ay, am] = s.period_key.split('-').map(Number);
      const [by, bm] = recibo.periodo_pdf.split('-').map(Number);
      const d = (ay - by) * 12 + (am - bm);
      corrimientos.set(d, (corrimientos.get(d) ?? 0) + 1);
    }
    if (recibo.advertencias.length) {
      problemas.push(`${quien} — ${recibo.advertencias.join(' | ')}`);
    }
  }
  for (const e of desglose.errores) problemas.push(`${quien} — ${e}`);
}

console.log('Estado del parseo:', conteo);
console.log('Corrimiento period_key → PERÍODO del PDF (meses):', Object.fromEntries(corrimientos));
console.log(`\nRecibos sin contribuciones en el documento: ${sinContribuciones.length}`);
console.log(`Recibos con un período distinto al esperado: ${periodoInesperado.length}`);
periodoInesperado.forEach((p) => console.log('  ' + p));
console.log(`Recibos descartados: ${descartados.length}`);
descartados.forEach((d) => console.log('  ' + d));
if (problemas.length) {
  console.log(`\nPROBLEMAS (${problemas.length}):`);
  problemas.forEach((p) => console.log('  ' + p));
}
