/**
 * Acredita las vacaciones y los Días Pow del período anual (desde el 1/10) en
 * las filas que quedaron en 0. Es lo mismo que hace el cron diario, para
 * correrlo a mano: por ejemplo el día que se agregó, o para revisar qué haría.
 *
 *   TZ=UTC npx tsx scripts/acreditar-periodo-anual.mts            # muestra el plan
 *   TZ=UTC npx tsx scripts/acreditar-periodo-anual.mts --aplicar  # lo aplica
 *   ... --excluir <employee_id>[,<employee_id>]                    # deja afuera a alguien
 *
 * TZ=UTC para que calcule igual que en Vercel.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@supabase/supabase-js';
import { acreditarPeriodoAnual, planDeApertura } from '../src/lib/aperturaPeriodoAnual';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const aplicar = process.argv.includes('--aplicar');
const i = process.argv.indexOf('--excluir');
const excluir = new Set(i >= 0 ? (process.argv[i + 1] ?? '').split(',').filter(Boolean) : []);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const r = aplicar ? await acreditarPeriodoAnual(db, undefined, excluir) : await planDeApertura(db);
if (!aplicar) r.acreditaciones = r.acreditaciones.filter((a) => !excluir.has(a.employee_id));

if (!r.abierto) {
  console.log(`El período ${r.anio} todavía no abrió (abre el 1/10). No hay nada que acreditar.`);
  process.exit(0);
}
for (const a of r.acreditaciones) {
  console.log(`${a.nombre.padEnd(34)} ${a.tipo.padEnd(9)} ${String(a.dias).padStart(3)} días`);
}
const total = (tipo: string) => r.acreditaciones.filter((a) => a.tipo === tipo).reduce((n, a) => n + a.dias, 0);
console.log(`\n${aplicar ? 'APLICADO' : 'PLAN (agregá --aplicar para escribir)'} — período ${r.anio}`);
console.log(`  vacaciones: ${total('vacation')} días en ${r.acreditaciones.filter((a) => a.tipo === 'vacation').length} personas`);
console.log(`  Días Pow:   ${total('pow_days')} días en ${r.acreditaciones.filter((a) => a.tipo === 'pow_days').length} personas`);
if (excluir.size) console.log(`  excluidos: ${[...excluir].join(', ')}`);
if (r.errores.length) console.log('  errores:\n   - ' + r.errores.join('\n   - '));
