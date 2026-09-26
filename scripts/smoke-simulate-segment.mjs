// Smoke tests de simulateSegment (orquestador de temporadas del engine).
// Uso: node scripts/smoke-simulate-segment.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { players } from '../src/data.js';
import {
  createCareer, createSeededRng, simulateSeason, simulateSegment,
  generateTransferOffers, acceptTransfer, generateYouthOffers, cloneCareer,
} from '../src/features/career/engine.js';
import { clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { initialOvr } from '../src/features/career/config.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

// Recorrido recursivo: true si ningún número es NaN/Infinity.
const deepScan = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  return Object.values(v).every(deepScan);
};

const STATS_KEYS = ['pj', 'gls', 'ast', 'cleanSheets'];
const PLAYER_NAMES = ['Nahue', 'Rui', 'Mati', 'Alan', 'JJ', 'Gonzi'];
const SEGMENT_SEED = 1000;

// ---------------------------------------------------------------------------
// Club de arranque de estas pruebas.
// createCareer YA NO asigna club: la carrera nueva nace SIN club (club = null) y
// el jugador lo elige en el checkpoint de debut del flow. Este smoke prueba el
// ENGINE puro (sin flow), que SÍ necesita un club para simular temporadas, así
// que lo pide explícito con el override initialClubSlug: el club de la división
// más alta que habilita el OVR inicial del jugador (el "mejor club que te
// acepta", igual que el arranque real), priorizando clubes argentinos.
// ---------------------------------------------------------------------------
const engineCreateCareer = createCareer;
const starterSlug = (player) => {
  const division = startingDivisionsForOvr(initialOvr(player.rating))[0] || 2;
  const pool = clubsByDivision(division);
  const home = pool.filter((club) => club.countryCode === 'AR');
  return (home[0] || pool[0]).slug;
};
const careerWithClub = (player, options = {}) =>
  engineCreateCareer(player, { ...options, initialClubSlug: starterSlug(player) });

// ============================================================================
// A. Sintaxis
// ============================================================================
console.log('\n== A. Sintaxis (node --check) ==');
const root = fileURLToPath(new URL('..', import.meta.url));
const enginePath = fileURLToPath(new URL('../src/features/career/engine.js', import.meta.url));
const check = spawnSync(process.execPath, ['--check', enginePath], { cwd: root, encoding: 'utf8' });
assert(check.status === 0, `node --check src/features/career/engine.js (status ${check.status})`);
if (check.status !== 0) console.error(check.stderr);

// ============================================================================
// B/C/D/E. Jugadores reales: simulación básica + secuencia + historial + stats
// ============================================================================
console.log('\n== B/C/D/E. Simulación básica, secuencia, historial y stats ==');
for (const name of PLAYER_NAMES) {
  const player = players.find((p) => p.name === name);
  const base = careerWithClub(player, { difficulty: 'normal' });
  console.log(`-- ${name} (ovr ${base.ovr}, pos ${base.position}, edad ${base.age}) --`);

  for (const n of [1, 2, 4]) {
    const seg = simulateSegment(base, n, { seed: SEGMENT_SEED + n });
    const label = `${name} [${n} temp]`;

    // B) Simulación básica: resultado usable.
    assert(seg && typeof seg.career === 'object' && seg.career !== base, `${label}: devuelve una NUEVA career`);
    assert(seg.seasonsSimulated === n, `${label}: seasonsSimulated === ${n}`);
    assert(seg.stoppedReason === null, `${label}: stoppedReason null (sin retiro)`);
    assert(deepScan(seg.career), `${label}: sin NaN/Infinity en la career`);

    // C) Secuencia: edad/temporada avanzan exactamente lo simulado.
    assert(seg.career.age === base.age + n, `${label}: edad ${base.age} → ${seg.career.age}`);
    assert(seg.career.season === base.season + n, `${label}: temporada ${base.season} → ${seg.career.season}`);

    // D) Historial: crece lo simulado y en orden cronológico.
    assert(seg.career.seasonHistory.length === base.seasonHistory.length + n, `${label}: seasonHistory crece ${n}`);
    const slice = seg.career.seasonHistory.slice(base.seasonHistory.length);
    assert(slice.every((rep, i) => rep.season === base.season + i && rep.age === base.age + i),
      `${label}: temporadas archivadas en orden (season/age consecutivos)`);
    assert(seg.seasonReports.length === n
      && JSON.stringify(seg.seasonReports) === JSON.stringify(slice),
      `${label}: seasonReports cronológicos == porción nueva de seasonHistory`);
    assert(seg.career.lastSeasonReport === slice[slice.length - 1], `${label}: lastSeasonReport == última temporada`);
    assert(deepScan(seg.seasonReports), `${label}: sin NaN/Infinity en seasonReports`);

    // E) Stats: careerStats acumula exactamente lo de las temporadas simuladas.
    const sumRep = (k) => slice.reduce((acc, rep) => acc + rep[k], 0);
    for (const k of STATS_KEYS) {
      assert(seg.career.careerStats[k] - base.careerStats[k] === sumRep(k), `${label}: careerStats.${k} acumula los reportes`);
    }
    assert(seg.career.careerStats.matches.length === base.careerStats.matches.length + n, `${label}: matches archivadas por temporada`);

    // Evolución real entre temporadas (consistencia del invariante global).
    const totalSum = (k) => seg.career.seasonHistory.reduce((acc, rep) => acc + rep[k], 0);
    for (const k of STATS_KEYS) {
      assert(seg.career.careerStats[k] === totalSum(k), `${label}: invariante global careerStats.${k} == Σ seasonHistory`);
    }
  }
}

// ============================================================================
// Secuencia profunda: simulateSegment(n) == encadenar simulateSeason n veces
// ============================================================================
console.log('\n== Secuencia profunda ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'Alan'), { difficulty: 'normal' });
  const rng = createSeededRng(12345);
  let manual = cloneCareer(base);
  const manualReports = [];
  for (let i = 0; i < 4; i += 1) {
    manual = simulateSeason(manual, { rng });
    manualReports.push(manual.lastSeasonReport);
  }
  const seg = simulateSegment(base, 4, { rng: createSeededRng(12345) });
  assert(JSON.stringify(seg.career) === JSON.stringify(manual), 'segmento de 4 == encadenar simulateSeason 4 veces (misma cadena RNG)');
  assert(JSON.stringify(seg.seasonReports) === JSON.stringify(manualReports), 'seasonReports == reportes del encadenado manual');
}

// ============================================================================
// F. Pureza
// ============================================================================
console.log('\n== F. Pureza ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'Rui'), { difficulty: 'normal' });
  const snap = JSON.stringify(base);
  const seg = simulateSegment(base, 4, { seed: 77 });
  assert(JSON.stringify(base) === snap, 'career original idéntica tras simular (snapshot JSON)');
  assert(seg.career.seasonHistory !== base.seasonHistory, 'sin referencias compartidas: seasonHistory');
  assert(seg.career.careerStats !== base.careerStats, 'sin referencias compartidas: careerStats');
  assert(seg.career.club !== base.club, 'sin referencias compartidas: club');
  assert(seg.career.events !== base.events, 'sin referencias compartidas: events');
  // events, trofeos, lesiones y último reporte se preservan entre temporadas.
  assert(Array.isArray(seg.career.events) && Array.isArray(seg.career.trophies), 'events/trophies preservados como arrays');
  assert(Array.isArray(seg.career.injuryHistory) && seg.career.injuryHistory.length >= base.injuryHistory.length, 'injuryHistory acumula (nunca se pisa)');
}

// ============================================================================
// G. Determinismo
// ============================================================================
console.log('\n== G. Determinismo ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'Mati'), { difficulty: 'normal' });
  const r1 = simulateSegment(cloneCareer(base), 4, { seed: 321 });
  const r2 = simulateSegment(cloneCareer(base), 4, { seed: 321 });
  assert(JSON.stringify(r1) === JSON.stringify(r2), 'mismo seed + misma career + mismas temporadas → mismo resultado');
}

// ============================================================================
// H. RNG inyectado
// ============================================================================
console.log('\n== H. RNG ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'JJ'), { difficulty: 'normal' });
  const rSeed = simulateSegment(base, 4, { seed: 321 });
  const rRng = simulateSegment(base, 4, { rng: createSeededRng(321) });
  assert(JSON.stringify(rRng) === JSON.stringify(rSeed), '{ rng: createSeededRng(321) } produce el mismo resultado que { seed: 321 }');
  assert(deepScan(rRng.career), '{ rng }: resultado sin NaN/Infinity');
}

// ============================================================================
// seasons inválidos y decimales
// ============================================================================
console.log('\n== seasons inválidos / decimales ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'Alan'), { difficulty: 'normal' });
  const snap = JSON.stringify(base);
  for (const bad of [null, undefined, NaN, Infinity, -Infinity, 0, -1, -3.5]) {
    const out = simulateSegment(base, bad, { seed: 1 });
    const label = `seasons=${String(bad)}`;
    assert(out.career !== base && JSON.stringify(out.career) === snap, `${label}: copia intacta sin simular`);
    assert(out.seasonsSimulated === 0 && out.seasonReports.length === 0, `${label}: 0 temporadas simuladas`);
    assert(out.stoppedReason === null, `${label}: stoppedReason null`);
  }
  assert(simulateSegment(base, 2.9, { seed: 1 }).seasonsSimulated === 2, 'seasons=2.9 → 2 temporadas (Math.floor determinista)');
  assert(simulateSegment(base, 4.7, { seed: 1 }).seasonsSimulated === 4, 'seasons=4.7 → 4 temporadas');
  assert(simulateSegment(base, 0.5, { seed: 1 }).seasonsSimulated === 0, 'seasons=0.5 → 0 temporadas');
}

// ============================================================================
// I. Retiro
// ============================================================================
console.log('\n== I. Retiro ==');
{
  // Carrera llevada a la edad 39 (a una temporada del retiro obligatorio).
  let c = careerWithClub(players.find((p) => p.name === 'Gonzi'), { difficulty: 'normal' });
  let guard = 0;
  while (c.age < 39 && guard < 40) { c = simulateSeason(c, { seed: 4242 + c.age }); guard += 1; }
  assert(c.age === 39, 'preparación: carrera en edad 39');

  const seg = simulateSegment(c, 4, { seed: 99 });
  assert(seg.seasonsSimulated === 1, 'simula SOLO la temporada 39→40 y se detiene');
  assert(seg.stoppedReason === 'retirement', 'stoppedReason === "retirement"');
  assert(seg.career.age === 40 && seg.career.season === c.season + 1, 'estado conservado: edad 40, sin temporadas extra');
  assert(seg.career.seasonHistory.length === c.seasonHistory.length + 1, 'seasonHistory crece exactamente 1');
  assert(seg.seasonReports.length === 1 && seg.seasonReports[0].mandatoryRetirement === true, 'reporte marca mandatoryRetirement');
  assert(deepScan(seg.career), 'sin NaN/Infinity en la carrera retirada');

  // Carrera ya retirada: cero simulaciones, copia intacta.
  const retiredIn = cloneCareer(c);
  retiredIn.retired = true;
  const snapR = JSON.stringify(retiredIn);
  const segR = simulateSegment(retiredIn, 3, { seed: 5 });
  assert(segR.seasonsSimulated === 0 && segR.seasonReports.length === 0, 'retirada: 0 temporadas simuladas');
  assert(segR.stoppedReason === 'retirement', 'retirada: stoppedReason "retirement"');
  assert(segR.career !== retiredIn && JSON.stringify(segR.career) === snapR, 'retirada: copia intacta');

  // Carrera en la edad de retiro exacta (retired aún false): nada que simular.
  const at40 = cloneCareer(c);
  at40.age = 40;
  const seg40 = simulateSegment(at40, 2, { seed: 6 });
  assert(seg40.seasonsSimulated === 0 && seg40.stoppedReason === 'retirement' && seg40.career.age === 40, 'edad 40: no simula y reporta retiro');
}

// ============================================================================
// J. Sin NaN (barrido de todas las carreras generadas) — se refuerza con un
// barrido multi-seed sobre los 6 jugadores reales.
// ============================================================================
console.log('\n== J. Sin NaN (barrido multi-seed) ==');
for (const name of PLAYER_NAMES) {
  const base = careerWithClub(players.find((p) => p.name === name), { difficulty: 'normal' });
  let allFinite = true;
  for (let s = 1; s <= 5 && allFinite; s += 1) {
    const seg = simulateSegment(base, 4, { seed: s * 1337 });
    allFinite = deepScan(seg.career) && deepScan(seg.seasonReports);
  }
  assert(allFinite, `${name}: 5 seeds × 4 temporadas sin NaN/Infinity`);
}

// ============================================================================
// K. Compatibilidad con el flujo existente
// ============================================================================
console.log('\n== K. Compatibilidad (ofertas / traspaso / cantera) ==');
{
  const base = careerWithClub(players.find((p) => p.name === 'JJ'), { difficulty: 'normal' });
  const seg = simulateSegment(base, 2, { seed: 555 });

  const offers = generateTransferOffers(seg.career, { seed: 556 });
  assert(Array.isArray(offers) && offers.length > 0, 'generateTransferOffers: ofertas válidas tras el segmento');
  const accepted = acceptTransfer(seg.career, offers[0]);
  assert(accepted && accepted.club.slug === offers[0].club.slug, 'acceptTransfer: traspaso aplicable al resultado del segmento');
  assert(deepScan(accepted), 'acceptTransfer: resultado sin NaN/Infinity');
  const after = simulateSegment(accepted, 1, { seed: 557 });
  assert(after.seasonsSimulated === 1 && after.career.club.slug === accepted.club.slug, 'segmento posterior conserva el club transferido');

  // Cantera: una carrera recién debutada (1 temporada simulada, edad 17)
  // sigue pudiendo recibir ofertas de debut cuando corresponda.
  const youthBase = careerWithClub(players.find((p) => p.name === 'Mati'), { difficulty: 'normal' });
  const segY = simulateSegment(youthBase, 1, { seed: 558 });
  const youth = generateYouthOffers(segY.career, { seed: 559 });
  assert(Array.isArray(youth) && youth.length > 0, 'generateYouthOffers: ofertas de cantera tras el segmento');
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-simulate-segment: TODO OK'
  : `\n❌ smoke-simulate-segment: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;
