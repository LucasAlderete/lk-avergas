// Smoke tests de resolveStay (bloque 6 del engine).
// Uso: node scripts/smoke-resolve-stay.mjs
// Cubre los checks del PASO 4: importación (A), sintaxis (B), export (C),
// pureza (D), club (E), división (F), colecciones del save (G), ofertas
// pendientes (H), loyalty (I), retiro (J), integración (K) y sin NaN (L).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';
import { findClub, clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { OFFER_RULES, AGE, clampOvr, initialOvr } from '../src/features/career/config.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const deepScan = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  return Object.values(v).every(deepScan);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ============================================================================
// A) Sintaxis + importación: si engine.js está roto, nada más puede evaluarse.
// ============================================================================
console.log('== A) Sintaxis e importación del engine ==');
const syntax = spawnSync(process.execPath, ['--check', 'src/features/career/engine.js'], { cwd: root });
assert(syntax.status === 0, 'node --check src/features/career/engine.js (sintaxis válida)');
if (syntax.status !== 0) {
  console.error(String(syntax.stderr || ''));
  console.log(`\n${failures} FALLAS`);
  process.exit(1);
}

let engine = null;
try {
  engine = await import(pathToFileURL(path.join(root, 'src', 'features', 'career', 'engine.js')).href);
} catch (err) {
  console.error('  ✗ FAIL: engine.js se importa →', err && err.message ? err.message : err);
  console.log(`\n${failures} FALLAS`);
  process.exit(1);
}
assert(engine !== null, 'engine.js se importa sin errores');

const {
  createCareer, simulateSeason, generateTransferOffers, acceptTransfer,
  generateYouthOffers, simulateSegment, resolveStay, cloneCareer,
} = engine;

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
// C) Export: resolveStay existe y es función (el resto del engine, intacto).
// ============================================================================
console.log('\n== C) Exports del engine ==');
assert(typeof resolveStay === 'function', 'resolveStay está exportada y es función');
assert(
  typeof createCareer === 'function' && typeof simulateSeason === 'function'
  && typeof generateTransferOffers === 'function' && typeof acceptTransfer === 'function'
  && typeof generateYouthOffers === 'function' && typeof simulateSegment === 'function',
  'el resto de las funciones del engine sigue exportada',
);

// ============================================================================
// 1) Carrera real (D/E/F/G): pureza, club, división y colecciones del save.
// ============================================================================
console.log('\n== D/E/F/G) Carrera real: pureza + club + colecciones ==');
const player = players.find((p) => p.name === 'Alan');
let career = careerWithClub(player, { difficulty: 'normal' });
for (let i = 0; i < 5; i += 1) career = simulateSeason(career, { seed: 3000 + i });
// Contenido histórico sembrado para probar que no se pierde nada del save.
career = cloneCareer(career);
career.trophies.push({ type: 'league', label: 'Liga', icon: '🏆', season: career.season - 1, clubName: career.club.name });
career.injuryHistory.push({ label: 'Prueba', ovrDelta: 0 });
career.clubHistory.push({
  club: { ...career.club },
  division: career.club.division,
  fromAge: AGE.START,
  fromSeason: career.season,
  via: 'career_start',
});

const careerSnapshot = JSON.stringify(career);
const stay = resolveStay(career);

// D) Pureza: objeto nuevo, career original idéntica.
assert(stay && stay !== career && stay.career !== career, 'resolveStay devuelve un objeto NUEVO');
assert(JSON.stringify(career) === careerSnapshot, 'career original NO se muta');

// Contrato de retorno: { career, action: 'stay', loyaltyOvrBonus }.
assert(stay.action === 'stay', `action === 'stay' (real: ${stay.action})`);
assert(Number.isFinite(stay.loyaltyOvrBonus), `loyaltyOvrBonus finito (${stay.loyaltyOvrBonus})`);

// E) Club sin cambios.
assert(stay.career.club.slug === career.club.slug, `club sin cambios (${stay.career.club.name})`);
assert(JSON.stringify(stay.career.club) === JSON.stringify(career.club), 'el club no fue alterado en detalle');

// F) División sin cambios.
assert(stay.career.club.division === career.club.division, `división sin cambios (D${stay.career.club.division})`);

// G) Colecciones del save: nada se pierde (events crece +1: evento 'stay').
for (const key of ['careerStats', 'seasonHistory', 'clubHistory', 'trophies', 'injuryHistory']) {
  if (career[key] !== undefined) {
    assert(JSON.stringify(stay.career[key]) === JSON.stringify(career[key]), `${key} se conserva intacto`);
  }
}
assert(Array.isArray(stay.career.events) && stay.career.events.length === career.events.length + 1,
  'events previos + 1 evento de permanencia');
const stayEvent = stay.career.events[stay.career.events.length - 1];
assert(stayEvent && stayEvent.type === 'stay' && stayEvent.season === career.season,
  'evento stay con la convención { season, type, message }');
assert(typeof stayEvent.message === 'string' && stayEvent.message.includes(career.club.name),
  'el evento menciona el club actual');

// L) Sin NaN/Infinity en la carrera resultante.
assert(deepScan(stay.career), 'sin NaN/Infinity en la carrera resultante');

// ============================================================================
// 2) Ofertas pendientes (H) — los campos reales del engine: pendingOffers,
//    offers y pendingTransfer (la forma que deja events.js).
// ============================================================================
console.log('\n== H) Ofertas pendientes del checkpoint ==');
const checkpointOffers = generateTransferOffers(career, { seed: 4242 });
assert(checkpointOffers.length > 0, 'generateTransferOffers produce ofertas reales para el save');
const pending = cloneCareer(career);
pending.pendingOffers = checkpointOffers;
pending.offers = [checkpointOffers[0]];
pending.pendingTransfer = {
  via: 'career_event',
  reason: 'event_transfer',
  eventId: 'evt-prueba',
  choiceId: 'choice-prueba',
  season: pending.season,
  age: pending.age,
  playerOvr: pending.ovr,
  targetClub: null, // "el motor decide" (forma real de events.js)
};
const pendingSnapshot = JSON.stringify(pending);
const pendingStay = resolveStay(pending);
assert(JSON.stringify(pending) === pendingSnapshot, 'el save original NO se muta');
assert(Array.isArray(pendingStay.career.pendingOffers) && pendingStay.career.pendingOffers.length === 0,
  'pendingOffers → limpiadas');
assert(Array.isArray(pendingStay.career.offers) && pendingStay.career.offers.length === 0,
  'offers → limpiadas');
assert(pendingStay.career.pendingTransfer === null,
  'pendingTransfer → null (decisión resuelta: no transferirse)');
assert(pendingStay.action === 'stay' && Number.isFinite(pendingStay.loyaltyOvrBonus),
  'contrato de retorno intacto con ofertas pendientes');

// Carrera sin campos de checkpoint: resolveStay no inventa campos.
assert(!('pendingOffers' in stay.career), 'career sin pendingOffers → no se inventa el campo');
assert(!('offers' in stay.career), 'career sin offers → no se inventa el campo');
assert(!('pendingTransfer' in stay.career), 'career sin pendingTransfer → no se inventa el campo');

// ============================================================================
// 3) Loyalty (I) — seed determinista, rango de OFFER_RULES.loyaltyOvrBonus,
//    coherencia con el OVR y career original sin mutación.
// ============================================================================
console.log('\n== I) Bonus de lealtad (OFFER_RULES.loyaltyOvrBonus) ==');
const [minBonus, maxBonus] = OFFER_RULES.loyaltyOvrBonus;
const lo = Math.min(minBonus, maxBonus);
const hi = Math.max(minBonus, maxBonus);
const seededA = resolveStay(career, { seed: 777 });
const seededB = resolveStay(career, { seed: 777 });
assert(seededA.loyaltyOvrBonus === seededB.loyaltyOvrBonus, `mismo seed → mismo bonus (${seededA.loyaltyOvrBonus})`);
assert(JSON.stringify(seededA.career) === JSON.stringify(seededB.career), 'mismo seed → carrera resultante idéntica');
assert(JSON.stringify(career) === careerSnapshot, 'career original sin mutación en el barrido de seeds');

const bonuses = [];
let loyalCoherent = true;
for (let s = 1; s <= 20; s += 1) {
  const out = resolveStay(career, { seed: s });
  const bonus = out.loyaltyOvrBonus;
  bonuses.push(bonus);
  if (!Number.isInteger(bonus) || bonus < lo || bonus > hi) loyalCoherent = false;
  // El OVR resultante refleja el bonus aplicado (con clampOvr).
  if (out.career.ovr !== clampOvr(career.ovr + bonus)) loyalCoherent = false;
  // El evento de permanencia registra el mismo bonus.
  const ev = out.career.events[out.career.events.length - 1];
  if (!ev || ev.loyaltyOvrBonus !== bonus) loyalCoherent = false;
}
assert(loyalCoherent, `20 seeds: bonus entero en [${lo}, ${hi}], OVR y evento coherentes`);
console.log(`   Bonus muestreados (seeds 1..20): ${bonuses.join(', ')}`);

// ============================================================================
// 4) Retirada (J) — copia intacta, sin bonus ni eventos (misma guarda que
//    simulateSeason): ya retirada o con la edad de retiro alcanzada.
// ============================================================================
console.log('\n== J) Carrera retirada ==');
const retired = cloneCareer(career);
retired.retired = true;
const retiredSnapshot = JSON.stringify(retired);
const retiredStay = resolveStay(retired);
assert(JSON.stringify(retiredStay.career) === retiredSnapshot, 'retired: copia intacta, sin bonus ni eventos');
assert(retiredStay.action === 'stay' && retiredStay.loyaltyOvrBonus === 0, 'retired: contrato con loyaltyOvrBonus 0');
assert(JSON.stringify(retired) === retiredSnapshot, 'retired: la carrera original no se muta');

const agedOut = cloneCareer(career);
agedOut.age = AGE.RETIRE;
const agedOutSnapshot = JSON.stringify(agedOut);
const agedOutStay = resolveStay(agedOut);
assert(JSON.stringify(agedOutStay.career) === agedOutSnapshot, `edad ${AGE.RETIRE} (retiro obligatorio): copia intacta`);
assert(agedOutStay.loyaltyOvrBonus === 0, 'edad de retiro: sin bonus');

// ============================================================================
// 5) Entradas inválidas — nunca lanza (misma estrategia del resto del engine).
// ============================================================================
console.log('\n== Entradas inválidas ==');
assert(resolveStay(null) && resolveStay(null).action === 'stay', 'resolveStay(null) no lanza');
assert(resolveStay(undefined) && resolveStay(undefined).action === 'stay', 'resolveStay(undefined) no lanza');

const ghost = cloneCareer(career);
ghost.club = { ...ghost.club, slug: 'club-fantasma' };
const ghostSnapshot = JSON.stringify(ghost);
const ghostStay = resolveStay(ghost);
assert(JSON.stringify(ghostStay.career) === ghostSnapshot && ghostStay.loyaltyOvrBonus === 0,
  'club inexistente: copia intacta, sin bonus');

const clubless = cloneCareer(career);
delete clubless.club;
const clublessStay = resolveStay(clubless);
assert(JSON.stringify(clublessStay.career) === JSON.stringify(clubless) && clublessStay.loyaltyOvrBonus === 0,
  'sin club: copia intacta, sin bonus');

// ============================================================================
// 6) Integración (K) — el resultado sigue siendo materia prima válida del
//    engine: simulateSeason, generateTransferOffers, simulateSegment y
//    acceptTransfer (que sigue intacto tras la reparación).
// ============================================================================
console.log('\n== K) Integración con el resto del engine ==');
const stayed = resolveStay(career, { seed: 9 }).career;
const nextSeason = simulateSeason(stayed, { seed: 5001 });
assert(nextSeason && nextSeason.season === stayed.season + 1, 'simulateSeason corre sobre el resultado de resolveStay');
assert(deepScan(nextSeason), 'simulateSeason sin NaN/Infinity');

const marketOffers = generateTransferOffers(stayed, { seed: 5002 });
assert(Array.isArray(marketOffers) && marketOffers.length > 0,
  'generateTransferOffers corre sobre el resultado de resolveStay');
assert(deepScan(marketOffers), 'generateTransferOffers sin NaN/Infinity');

const segment = simulateSegment(stayed, 2, { seed: 5003 });
assert(segment && segment.seasonsSimulated === 2 && segment.seasonReports.length === 2,
  'simulateSegment corre sobre el resultado de resolveStay');
assert(deepScan(segment.career), 'simulateSegment sin NaN/Infinity');

if (marketOffers.length > 0) {
  const moved = acceptTransfer(stayed, marketOffers[0]);
  assert(moved && moved.club.slug === marketOffers[0].club.slug,
    'acceptTransfer sigue funcionando tras resolveStay');
  assert(deepScan(moved), 'acceptTransfer sin NaN/Infinity');
}

// La career original sigue intacta al cierre de todas las pruebas.
assert(JSON.stringify(career) === careerSnapshot, 'career original intacta al final de todas las pruebas');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);


