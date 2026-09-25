/**
 * El perfil Administración entra a Novedades de licencias, y a nada más de Time Off.
 *
 * Correr: npx tsx --tsconfig ./tsconfig.json ./scripts/check-administracion-novedades.ts
 *
 * Lo que fija: la lista única de rutas deja pasar Novedades (y sus subrutas) y
 * sigue rebotando el resto de Time Off. Si alguien agrega Time Off entero "para
 * que ande", este chequeo se pone rojo: solicitudes, balances y certificados no
 * son de Administración.
 */
import { administracionPuedeEntrar } from '@/lib/administracionRoutes';

let pass = 0;
let fail = 0;
function eq(label: string, got: unknown, exp: unknown) {
  const ok = got === exp;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${String(got)}${ok ? '' : `  ESPERADO ${String(exp)}`}`);
  ok ? pass++ : fail++;
}

eq('entra a Novedades', administracionPuedeEntrar('/admin/time-off/novedades'), true);
eq('y a sus subrutas', administracionPuedeEntrar('/admin/time-off/novedades/export'), true);
eq('NO al dashboard de Time Off', administracionPuedeEntrar('/admin/time-off'), false);
eq('NO a Solicitudes', administracionPuedeEntrar('/admin/time-off/requests'), false);
eq('NO a Balances', administracionPuedeEntrar('/admin/time-off/balances'), false);
eq('NO a Certificados', administracionPuedeEntrar('/admin/time-off/certificates'), false);
eq('NO a Configuración de Time Off', administracionPuedeEntrar('/admin/time-off/settings'), false);
eq('un prefijo parecido no cuela', administracionPuedeEntrar('/admin/time-off/novedadesX'), false);
eq('sigue entrando a Adelantos', administracionPuedeEntrar('/admin/salary-advances'), true);
eq('sigue entrando a Liquidaciones', administracionPuedeEntrar('/admin/payroll'), true);
eq('sigue sin entrar a People', administracionPuedeEntrar('/admin/people'), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
