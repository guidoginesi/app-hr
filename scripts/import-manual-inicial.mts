/**
 * Carga inicial del Manual RRHH desde una exportación en texto del Google Doc.
 *
 * Es para arrancar sin esperar a que el Apps Script esté instalado en el
 * documento. De ahí en adelante sincroniza el script y esto no se usa más: la
 * exportación en texto pierde fidelidad (encabezados repetidos, emojis rotos)
 * que el Apps Script no pierde porque lee la estructura real del documento.
 *
 *   npx tsx scripts/import-manual-inicial.mts <archivo.json> [--dry-run]
 *
 * El archivo es {fileContent: string} con el Doc renderizado en markdown.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { importarManual, slugDeRuta, type SeccionEntrante } from '../src/lib/manual/ingest';
import { audienciaSugerida } from '../src/lib/manual/audienciaSugerida';

const archivo = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!archivo) {
  console.error('Falta el archivo. Uso: npx tsx scripts/import-manual-inicial.mts <archivo.json> [--dry-run]');
  process.exit(1);
}

const texto: string = JSON.parse(readFileSync(archivo, 'utf8')).fileContent;
const lineas = texto.split('\n');

// El índice del Doc son links; el cuerpo empieza donde dejan de aparecer.
const finIndice = lineas.reduce((ultimo, l, i) => (l.startsWith('[') ? i : ultimo), 0) + 1;

const secciones: SeccionEntrante[] = [];
let ruta: string[] = [];
let actual: (SeccionEntrante & { lineas: string[] }) | null = null;

const cerrar = () => {
  if (!actual) return;
  const { lineas: cuerpo, ...resto } = actual;
  secciones.push({ ...resto, texto: cuerpo.join('\n').replace(/\n{3,}/g, '\n\n').trim() });
};

for (const linea of lineas.slice(finIndice)) {
  const m = linea.match(/^(#{1,4}) (.*)/);
  if (m) {
    cerrar();
    const nivel = m[1].length;
    const titulo = m[2].replace(/[*#]/g, '').trim();
    if (!titulo) continue;
    ruta = [...ruta.slice(0, nivel - 1), titulo];
    actual = { ruta: [...ruta], titulo, nivel, orden: secciones.length, texto: '', lineas: [] };
    continue;
  }
  // Restos de formato de la exportación: líneas que son sólo asteriscos.
  if (actual && linea.replace(/[*\s]/g, '') !== '') actual.lineas.push(linea);
  else if (actual) actual.lineas.push('');
}
cerrar();
secciones.forEach((s, i) => { s.orden = i; });

console.log(`Parseadas ${secciones.length} secciones (~${Math.round(secciones.reduce((a, s) => a + s.texto.length, 0) / 4)} tokens)`);

const conteo = { EMPLEADO: 0, SOLO_HR: 0, SIN_REGLA: 0 };
const sinRegla: string[] = [];
for (const s of secciones) {
  const sug = audienciaSugerida(s.ruta);
  if (!sug) { conteo.SIN_REGLA++; sinRegla.push(s.ruta.join(' › ')); }
  else conteo[sug.audiencia]++;
}
console.log('Propuesta de audiencia:', conteo);
if (sinRegla.length) {
  console.log(`\nSin regla (quedan SIN_DEFINIR y no se citan):`);
  sinRegla.forEach((r) => console.log('  ' + r));
}

if (dryRun) {
  console.log('\n[DRY RUN] no se guardó nada.');
  console.log('Ejemplo de slug:', slugDeRuta(secciones[1]?.ruta ?? []));
  process.exit(0);
}

const resultado = await importarManual(secciones, 'carga-inicial');
console.log('\nImportado:', {
  recibidas: resultado.recibidas,
  nuevas: resultado.nuevas.length,
  modificadas: resultado.modificadas.length,
  sinCambios: resultado.sinCambios,
  jubiladas: resultado.jubiladas.length,
  sinRevisar: resultado.sinRevisar,
});
