/**
 * Importa el histórico del Google Form "Entrevista de Salida" a la app.
 *
 * El equipo de People viene tomando entrevistas de salida desde 2022 en un
 * Form, con 25 respuestas. La pantalla de People → Salidas lee
 * `offboarding_responses`, así que sin esto arrancaría vacía y los promedios de
 * las siete escalas no dirían nada.
 *
 * La mayoría de esa gente no tiene legajo: se fueron antes de que el módulo
 * existiera. Como `offboarding_responses.employee_id` es NOT NULL, hay que
 * crearles el legajo para poder guardar lo que contestaron. Se crean como
 * desvinculados y con una nota que dice de dónde salieron, para que dentro de
 * un año se entienda por qué están tan vacíos.
 *
 * Uso:
 *   npx tsx scripts/import-entrevistas-de-salida.mts            # simula
 *   npx tsx scripts/import-entrevistas-de-salida.mts --aplicar  # escribe
 *
 * Es idempotente: si el legajo ya existe se reusa, y si ya tiene respuesta
 * cargada no se pisa.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const RUTA_CSV = process.argv[2]?.endsWith('.csv') ? process.argv[2] : 'salidas.csv';
const APLICAR = process.argv.includes('--aplicar');

// ---------------------------------------------------------------- CSV

/** Parser mínimo con comillas dobles escapadas, que es lo que exporta Sheets. */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\r') { /* se ignora */ }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// ------------------------------------------------------- Normalizaciones

/**
 * Las escalas del Form concuerdan distinto según la pregunta ("Buena",
 * "Buenos", "Buenas"). Adentro se guarda un único valor por nivel, que es lo
 * que después permite promediar las siete juntas.
 */
function nivel(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  if (t.startsWith('excelente')) return 'excelente';
  if (t.startsWith('buen')) return 'bueno';
  if (t.startsWith('regular')) return 'regular';
  if (t.startsWith('mal')) return 'malo';
  return null;
}

/** "22/08/2022 12:33:21" → "2022-08-22". */
function fechaDeMarca(marca: string): string | null {
  const m = marca.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mes, a] = m;
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * La antigüedad que escribió cada uno, a meses. Viene a mano alzada: "10
 * meses", "1 año, 10 meses", "+2 años", "1.5", "2años y medios". Lo que no se
 * entiende devuelve null y el legajo queda sin fecha de ingreso, que es mejor
 * que inventarla.
 */
function antiguedadEnMeses(texto: string): number | null {
  const t = texto.trim().toLowerCase();
  if (!t) return null;

  // "1.5" suelto = años con decimales.
  if (/^\+?\d+([.,]\d+)?$/.test(t)) {
    return Math.round(parseFloat(t.replace(',', '.').replace('+', '')) * 12);
  }

  const anios = t.match(/(\d+)\s*a[ñn]os?/);
  const meses = t.match(/(\d+)\s*meses?/);
  const medio = /\bmedios?\b/.test(t);

  if (!anios && !meses) return null;
  let total = (anios ? parseInt(anios[1], 10) * 12 : 0) + (meses ? parseInt(meses[1], 10) : 0);
  if (medio && !meses) total += 6;
  return total || null;
}

function restarMeses(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().split('T')[0];
}

/**
 * "Melina Ibañez" → ["Melina", "Ibañez"].
 *
 * Seis personas dejaron el nombre en blanco —era opcional en el Form— así que
 * se deduce del mail. Para una casilla como `juliana@pow.la` sale bien; para
 * `gmonzonsierra@gmail.com` sale "Gmonzonsierra", que es feo pero es lo único
 * que sabemos. Inventar un apellido sería peor. El apellido vacío va como "",
 * no como un guión: el guión parece un dato y esto es la ausencia de uno.
 */
function partirNombre(nombre: string, mail: string): [string, string] {
  const limpio = nombre.trim().replace(/\.$/, '');
  if (limpio) {
    const partes = limpio.split(/\s+/);
    return [partes[0], partes.slice(1).join(' ')];
  }
  const usuario = mail.split('@')[0].replace(/\d+/g, '');
  const partes = usuario.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return [cap(partes[0] ?? 'Sin'), partes.slice(1).map(cap).join(' ')];
}

// ------------------------------------------------------------- Columnas

/**
 * Columna del Form → pregunta de la app.
 *
 * Antigüedad y Nombre no están: no son preguntas de la encuesta, se usan para
 * armar el legajo (fecha de ingreso y nombre).
 */
const COLUMNAS: Array<{ i: number; id: string; escala?: boolean }> = [
  { i: 3, id: 'separation_reason' },
  { i: 4, id: 'would_recommend_why' },
  { i: 5, id: 'boss_would_change' },
  { i: 6, id: 'improvements' },
  { i: 7, id: 'peer_relationship', escala: true },
  { i: 8, id: 'manager_relationship', escala: true },
  { i: 9, id: 'onboarding_training', escala: true },
  { i: 10, id: 'work_conditions', escala: true },
  { i: 11, id: 'salary_benefits', escala: true },
  { i: 12, id: 'promotion_opportunities', escala: true },
  { i: 13, id: 'fair_treatment', escala: true },
];

const NOTA_IMPORTADO =
  'Legajo creado al importar el histórico del Form "Entrevista de Salida". ' +
  'La persona se fue antes de que el módulo de offboarding existiera, así que ' +
  'sólo se conocen la fecha, el motivo y lo que contestó.';

// ------------------------------------------------------------------ Main

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key);

  const filas = parseCsv(readFileSync(RUTA_CSV, 'utf8')).slice(1).filter((f) => f[1]?.trim());
  console.log(`${filas.length} respuestas en la planilla\n`);

  const { data: empleados } = await supabase
    .from('employees')
    .select('id, first_name, last_name, personal_email, work_email, status');
  const porMail = new Map<string, any>();
  for (const e of empleados ?? []) {
    for (const m of [e.personal_email, e.work_email]) {
      if (m?.trim()) porMail.set(m.trim().toLowerCase(), e);
    }
  }

  const { data: yaCargadas } = await supabase.from('offboarding_responses').select('employee_id');
  const conRespuesta = new Set((yaCargadas ?? []).map((r) => r.employee_id));

  let creados = 0, reusados = 0, saltados = 0, importadas = 0;

  for (const fila of filas) {
    const mail = fila[1].trim().toLowerCase();
    const fecha = fechaDeMarca(fila[0]);
    const [nombre, apellido] = partirNombre(fila[14] ?? '', mail);

    // Las respuestas, en el formato que guarda la app.
    const respuestas: Record<string, string> = {};
    for (const col of COLUMNAS) {
      const bruto = (fila[col.i] ?? '').trim();
      if (!bruto) continue;
      const valor = col.escala ? nivel(bruto) : bruto;
      if (valor) respuestas[col.id] = valor;
    }

    let empleado = porMail.get(mail);

    if (empleado) {
      reusados++;
      console.log(`  reusa  ${mail.padEnd(30)} ${empleado.first_name} ${empleado.last_name} (${empleado.status})`);
    } else {
      const meses = antiguedadEnMeses(fila[2] ?? '');
      const ingreso = fecha && meses ? restarMeses(fecha, meses) : null;
      const nuevo = {
        first_name: nombre,
        last_name: apellido,
        // `personal_email` es NOT NULL y es lo único que tenemos, así que va
        // el mail del Form aunque sea el de trabajo. Si era @pow.la se repite
        // en `work_email`, que es lo que realmente era.
        personal_email: mail,
        work_email: mail.endsWith('@pow.la') ? mail : null,
        status: 'terminated',
        hire_date: ingreso,
        termination_date: fecha,
        // Las 25 respuestas describen salidas voluntarias, sin excepción.
        termination_reason: 'resignation',
        termination_notes: NOTA_IMPORTADO,
        offboarding_enabled: true,
      };
      console.log(`  CREA   ${mail.padEnd(30)} ${nombre} ${apellido} · baja ${fecha} · ingreso ${ingreso ?? '—'}`);
      if (APLICAR) {
        const { data, error } = await supabase.from('employees').insert(nuevo).select('id').single();
        if (error) { console.log(`         ERROR: ${error.message}`); continue; }
        empleado = data;
      } else {
        empleado = { id: `(simulado-${creados})` };
      }
      creados++;
    }

    if (conRespuesta.has(empleado.id)) {
      console.log(`         ya tenía respuesta cargada, no se pisa`);
      saltados++;
      continue;
    }

    const cuando = fecha ? `${fecha}T12:00:00.000Z` : new Date().toISOString();
    console.log(`         ${Object.keys(respuestas).length} respuestas`);
    if (APLICAR) {
      const { error } = await supabase.from('offboarding_responses').insert({
        employee_id: empleado.id,
        status: 'submitted',
        responses: respuestas,
        submitted_at: cuando,
      });
      if (error) { console.log(`         ERROR: ${error.message}`); continue; }
      await supabase
        .from('employees')
        .update({ offboarding_enabled: true, offboarding_completed_at: cuando })
        .eq('id', empleado.id);
    }
    importadas++;
  }

  console.log(`\n${APLICAR ? 'APLICADO' : 'SIMULACIÓN (agregá --aplicar para escribir)'}`);
  console.log(`  legajos creados:  ${creados}`);
  console.log(`  legajos reusados: ${reusados}`);
  console.log(`  respuestas importadas: ${importadas}`);
  console.log(`  saltadas (ya estaban): ${saltados}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
