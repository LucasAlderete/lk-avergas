// Smoke tests de retireCareer (bloque 9 del engine).
// Uso: node scripts/smoke-retire-career.mjs
// Cubre los checks del PASO 5: sintaxis (A), export (B), pureza (C), estado
// de retiro (D), estadísticas (E), peak (F), logros (G), idempotencia (H),
// edad (I), temporada (J), ofertas pendientes (K), sin NaN (L), careers
// reales (M) y compatibilidad con el resto del engine (N).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';
import { clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { ACHIEVEMENTS, initialOvr } from '../src/features/career/config.js';

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
  generateYouthOffers, simulateSegment, resolveStay, cloneCareer, retireCareer,
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
// B) Export: retireCareer existe y es función (el resto del engine, intacto).
// ============================================================================
console.log('\n== B) Exports del engine ==');
assert(typeof retireCareer === 'function', 'retireCareer está exportada y es función');
assert(
  typeof createCareer === 'function' && typeof simulateSeason === 'function'
  && typeof generateTransferOffers === 'function' && typeof acceptTransfer === 'function'
  && typeof generateYouthOffers === 'function' && typeof simulateSegment === 'function'
  && typeof resolveStay === 'function',
  'el resto de las funciones del engine sigue exportada',
);

// Carrera real base (Alan): 6 temporadas simuladas + contenido histórico
// sembrado para probar que el retiro no pierde ni altera nada del save.
const player = players.find((p) => p.name === 'Alan');
let career = careerWithClub(player, { difficulty: 'normal' });
for (let i = 0; i < 6; i += 1) career = simulateSeason(career, { seed: 6000 + i });
career = cloneCareer(career);
career.trophies.push({ type: 'league', label: 'Liga', icon: '🏆', season: career.season - 1, clubName: career.club.name });
career.injuryHistory.push({ label: 'Prueba', ovrDelta: 0 });
career.clubHistory.push({
  club: { key: '2/club-historico', slug: 'club-historico', name: 'Club Histórico', short: 'CH', barrio: 'Barrio', stadium: 'Estadio', division: 2, colors: { primary: '#000000', secondary: '#ffffff' } },
  division: 2,
  fromAge: 16,
  fromSeason: career.season - (career.age - 16),
  via: 'youth',
});
career.achievements.push({ id: 'centurion', label: 'Centurión del Barrio' });
career.pendingOffers = [{ id: 'offer-pendiente' }];
career.offers = [{ id: 'offer-pendiente' }];
career.pendingTransfer = { targetClub: { name: 'Club Pendiente' } };
const careerSnapshot = JSON.stringify(career);

// ============================================================================
// C) Pureza: JSON.stringify(career) idéntico antes y después de retireCareer.
// ============================================================================
console.log('\n== C) Pureza ==');
const retired = retireCareer(career);
assert(JSON.stringify(career) === careerSnapshot, 'la career original queda idéntica (snapshot JSON)');
assert(retired && typeof retired === 'object' && retired !== career, 'devuelve una NUEVA career (otra referencia)');
assert(Object.keys(career).every((key) => key in retired), 'no se borra ningún campo existente del save');

// ============================================================================
// D) Estado de retiro: retired === true y toda la información conservada.
// ============================================================================
console.log('\n== D) Estado de retiro ==');
assert(retired.retired === true, 'retired === true');
assert(retired.name === career.name && retired.playerId === career.playerId, 'player/name preservados');
assert(JSON.stringify(retired.snapshot) === JSON.stringify(career.snapshot), 'snapshot del jugador preservado');
assert(retired.age === career.age, 'edad preservada');
assert(retired.season === career.season, 'temporada preservada');
assert(retired.ovr === career.ovr, 'ovr preservado');
assert(retired.club && retired.club.slug === career.club.slug, 'club preservado');
assert(retired.club.division === career.club.division, 'división preservada');
assert(retired.clubBaseline === career.clubBaseline && retired.domesticRep === career.domesticRep, 'baseline y reputación preservados');
assert(retired.marketValue === career.marketValue, 'marketValue preservado (sin recálculo)');
assert(JSON.stringify(retired.attrs) === JSON.stringify(career.attrs), 'attrs preservados');
assert(JSON.stringify(retired.injuryHistory) === JSON.stringify(career.injuryHistory), 'injuryHistory preservada');
assert(retired.injuries === career.injuries, 'injuries preservado');
assert(JSON.stringify(retired.profile) === JSON.stringify(career.profile), 'profile preservado');
assert(retired.lastSeasonReport !== undefined, 'lastSeasonReport sigue presente');

// ============================================================================
// E) Estadísticas: el cierre usa las YA acumuladas, sin tocarlas.
// ============================================================================
console.log('\n== E) Estadísticas ==');
assert(JSON.stringify(retired.careerStats) === JSON.stringify(career.careerStats), 'careerStats intactas');
assert(JSON.stringify(retired.seasonHistory) === JSON.stringify(career.seasonHistory), 'seasonHistory intacta');
assert(JSON.stringify(retired.trophies) === JSON.stringify(career.trophies), 'trophies intactos');
assert(JSON.stringify(retired.clubHistory) === JSON.stringify(career.clubHistory), 'clubHistory intacta');
assert(JSON.stringify(retired.seasonStats) === JSON.stringify(career.seasonStats), 'seasonStats intacta');

// ============================================================================
// F) Peak OVR: overallPeak se conserva (no se reemplaza por el OVR actual).
// ============================================================================
console.log('\n== F) Peak OVR ==');
assert(retired.overallPeak === career.overallPeak, 'overallPeak se conserva tal cual');
assert(Number.isFinite(retired.overallPeak), 'overallPeak sigue siendo un número finito');

// ============================================================================
// Evento de retiro: convención { season, type, message } del engine.
// ============================================================================
console.log('\n== Evento de retiro ==');
assert(retired.events.length === career.events.length + 1, 'se agrega exactamente un evento');
assert(JSON.stringify(retired.events.slice(0, -1)) === JSON.stringify(career.events), 'eventos previos intactos');
const retirementEvents = retired.events.filter((e) => e && e.type === 'retirement');
assert(retirementEvents.length === 1, 'exactamente un evento de retiro');
const ev = retirementEvents[0];
assert(ev.season === career.season, "evento { season, type: 'retirement' } (misma convención que injury/trophy/transfer/stay)");
assert(typeof ev.message === 'string' && ev.message.length > 0, 'evento con message legible');
assert(ev.pj === career.careerStats.pj && ev.gls === career.careerStats.gls && ev.ast === career.careerStats.ast, 'evento con el cierre estadístico ya acumulado');
assert(ev.trophies === career.trophies.length, 'evento con la cantidad de títulos acumulados');
assert(ev.clubSlug === career.club.slug && ev.clubKey === `${career.club.division}/${career.club.slug}`, 'evento con clubKey/clubSlug del último club');
assert(ev.playerOvr === career.ovr && ev.overallPeak === career.overallPeak, 'evento con ovr y overallPeak del cierre');

// ============================================================================
// I/J) Edad y temporada: NO avanza nada, NO simula nada.
// ============================================================================
console.log('\n== I/J) Edad y temporada ==');
assert(retired.age === career.age, 'la edad NO avanza');
assert(retired.season === career.season, 'la temporada NO avanza');
assert(retired.seasonHistory.length === career.seasonHistory.length, 'NO agrega una nueva temporada al historial');
assert(JSON.stringify(retired.lastSeasonReport) === JSON.stringify(career.lastSeasonReport), 'lastSeasonReport sin cambios (no re-simula)');

// ============================================================================
// K) Ofertas/decisiones pendientes: una retirada no conserva decisiones.
// ============================================================================
console.log('\n== K) Ofertas pendientes ==');
assert(Array.isArray(retired.pendingOffers) && retired.pendingOffers.length === 0, 'pendingOffers existente → limpiada');
assert(Array.isArray(retired.offers) && retired.offers.length === 0, 'offers existente → limpiada');
assert(retired.pendingTransfer === null, 'pendingTransfer existente → null');

// ============================================================================
// L) Sin NaN: deep scan de la career resultante.
// ============================================================================
console.log('\n== L) Sin NaN ==');
assert(deepScan(retired), 'career retirada sin NaN/Infinity (deep scan)');

// ============================================================================
// G) Logros: el catálogo ACHIEVEMENTS de config.js, evaluado al retirar.
// ============================================================================
console.log('\n== G) Logros (catálogo ACHIEVEMENTS de config.js) ==');
const craftCareer = (overrides = {}) => {
  const base = careerWithClub(player, { difficulty: 'normal' });
  const merged = { ...base, ...overrides };
  merged.careerStats = { pj: 0, gls: 0, ast: 0, cleanSheets: 0, matches: [], ...(overrides.careerStats || {}) };
  return merged;
};
const idsOf = (c) => (c.achievements || []).map((a) => a.id).sort();
const histClubs = (count) => Array.from({ length: count }, (_, i) => ({
  club: { key: `2/hist-${i + 1}`, slug: `hist-${i + 1}`, name: `Histórico ${i + 1}` },
  division: 2,
  fromAge: 16 + i,
  fromSeason: 2026 + i,
  via: 'transfer',
}));

// Carrera virgen: sin stats ni títulos → ningún logro del catálogo.
assert(idsOf(retireCareer(craftCareer())).length === 0, 'carrera virgen: ningún logro');

// Umbrales del catálogo, regla por regla (borde justo: cumple / no cumple).
// (injuries: 1 aísla las reglas de PJ de 'indestructible', que exige 0 lesiones.)
assert(idsOf(retireCareer(craftCareer({ injuries: 1, careerStats: { pj: 100 } }))).join(',') === 'centurion', 'PJ 100 → centurion');
assert(!idsOf(retireCareer(craftCareer({ careerStats: { pj: 99 } }))).includes('centurion'), 'PJ 99 → sin centurion');
assert(idsOf(retireCareer(craftCareer({ careerStats: { gls: 80 } }))).join(',') === 'goleador', 'goles 80 → goleador');
assert(!idsOf(retireCareer(craftCareer({ careerStats: { gls: 79 } }))).includes('goleador'), 'goles 79 → sin goleador');
assert(idsOf(retireCareer(craftCareer({ careerStats: { ast: 60 } }))).join(',') === 'asistidor', 'asistencias 60 → asistidor');
assert(!idsOf(retireCareer(craftCareer({ careerStats: { ast: 59 } }))).includes('asistidor'), 'asistencias 59 → sin asistidor');
assert(idsOf(retireCareer(craftCareer({ overallPeak: 88 }))).join(',') === 'leyenda', 'peak OVR 88 → leyenda');
assert(!idsOf(retireCareer(craftCareer({ overallPeak: 87 }))).includes('leyenda'), 'peak OVR 87 → sin leyenda');
assert(idsOf(retireCareer(craftCareer({ trophies: [{}, {}, {}] }))).join(',') === 'campeon', '3 títulos → campeon');
assert(!idsOf(retireCareer(craftCareer({ trophies: [{}, {}] }))).includes('campeon'), '2 títulos → sin campeon');
assert(idsOf(retireCareer(craftCareer({ clubHistory: histClubs(3) }))).join(',') === 'trotamundos', '4 clubes (historial + actual) → trotamundos');
assert(!idsOf(retireCareer(craftCareer({ clubHistory: histClubs(2) }))).includes('trotamundos'), '3 clubes → sin trotamundos');
assert(idsOf(retireCareer(craftCareer({ injuries: 0, careerStats: { pj: 50 } }))).join(',') === 'indestructible', '0 lesiones + PJ 50 → indestructible');
assert(!idsOf(retireCareer(craftCareer({ injuries: 1, careerStats: { pj: 50 } }))).includes('indestructible'), '1 lesión → sin indestructible');
assert(!idsOf(retireCareer(craftCareer({ injuries: 0, careerStats: { pj: 49 } }))).includes('indestructible'), 'PJ 49 → sin indestructible');

// Combinación completa: las reglas del catálogo todas juntas.
const allIds = retireCareer(craftCareer({
  careerStats: { pj: 120, gls: 90, ast: 70 },
  overallPeak: 90,
  trophies: [{}, {}, {}, {}],
  clubHistory: histClubs(3),
  injuries: 0,
}));
assert(
  JSON.stringify(idsOf(allIds)) === JSON.stringify(ACHIEVEMENTS.map((a) => a.id).sort()),
  `combinación completa: los ${ACHIEVEMENTS.length} logros del catálogo`,
);

// Acumulativo: los logros previos se conservan y no se duplican.
const seeded = craftCareer({ careerStats: { pj: 150, gls: 90 }, injuries: 1 });
seeded.achievements = [{ id: 'centurion', label: 'Centurión del Barrio' }];
const seededRetired = retireCareer(seeded);
assert(idsOf(seededRetired).join(',') === 'centurion,goleador', 'logros previos + nuevos (acumulativo)');
assert(seededRetired.achievements.filter((a) => a.id === 'centurion').length === 1, 'sin duplicar el logro previo');
assert(
  seededRetired.achievements.every((a) => ACHIEVEMENTS.some((cat) => cat.id === a.id && cat.label === a.label)),
  'id + label salen del catálogo (nada inventado)',
);
assert(
  seededRetired.achievements.every((a) => (a.id === 'centurion'
    ? a.season === undefined
    : a.season === seeded.season)),
  'logro nuevo con la season del cierre (el previo sembrado queda intacto)',
);
assert(deepScan(seededRetired), 'logros evaluados sin NaN');

// ============================================================================
// H) No duplicación: retireCareer(retireCareer(c)) === retireCareer(c).
// ============================================================================
console.log('\n== H) No duplicación (idempotencia) ==');
const once = retireCareer(career);
const twice = retireCareer(once);
assert(JSON.stringify(twice) === JSON.stringify(once), 'retireCareer(retireCareer(c)) === retireCareer(c)');
assert(twice.events.length === once.events.length, 'no duplica eventos');
assert(twice.events.filter((e) => e.type === 'retirement').length === 1, 'un solo evento de retiro');
assert(JSON.stringify(twice.achievements) === JSON.stringify(once.achievements), 'no duplica logros');
assert(JSON.stringify(twice.careerStats) === JSON.stringify(once.careerStats), 'no toca estadísticas');
assert(JSON.stringify(twice.seasonHistory) === JSON.stringify(once.seasonHistory), 'no toca el historial de temporadas');
assert(twice.retired === true && twice.age === once.age && twice.season === once.season, 'estado de cierre estable');

// Carrera ya retirada (save externo): copia intacta, sin cambios.
const alreadyRetired = {
  retired: true,
  name: 'X',
  events: [{ season: 2030, type: 'retirement', message: 'Ya retirado' }],
  achievements: [{ id: 'leyenda', label: 'Leyenda del Universo' }],
};
assert(JSON.stringify(retireCareer(alreadyRetired)) === JSON.stringify(alreadyRetired), 'career ya retirada: copia intacta sin cambios');

// ============================================================================
// Entradas inválidas — nunca lanza (misma estrategia del resto del engine).
// ============================================================================
console.log('\n== Entradas inválidas ==');
assert(retireCareer(null) !== undefined && typeof retireCareer(null) === 'object', 'retireCareer(null) no lanza → copia segura');
assert(typeof retireCareer(undefined) === 'object', 'retireCareer(undefined) no lanza');
assert(typeof retireCareer('carrera') === 'object', 'retireCareer(string) no lanza');
assert(typeof retireCareer(42) === 'object', 'retireCareer(number) no lanza');
assert(deepScan(retireCareer(null)) && deepScan(retireCareer('carrera')) && deepScan(retireCareer(42)), 'copias seguras sin NaN');
const partial = { name: 'Fantasma' };
const partialRetired = retireCareer(partial);
assert(partialRetired.retired === true, 'objeto incompleto: se marca retired sin lanzar');
assert(deepScan(partialRetired), 'objeto incompleto: sin NaN');
assert(JSON.stringify(partial) === JSON.stringify({ name: 'Fantasma' }), 'objeto incompleto: el original no se muta');
const freshRetired = retireCareer(craftCareer());
assert(!('pendingOffers' in freshRetired) && !('offers' in freshRetired) && !('pendingTransfer' in freshRetired), 'no inventa campos de ofertas si el save no los tiene');

// ============================================================================
// M) Careers reales: Nahue, Mati, Alan, JJ y Gonzi.
// ============================================================================
console.log('\n== M) Careers reales (Nahue, Mati, Alan, JJ, Gonzi) ==');
for (const name of ['Nahue', 'Mati', 'Alan', 'JJ', 'Gonzi']) {
  const p = players.find((q) => q.name === name);
  let c = careerWithClub(p, { difficulty: 'normal' });
  for (let i = 0; i < 8; i += 1) c = simulateSeason(c, { seed: 7000 + i });
  const snapshotC = JSON.stringify(c);
  const rc = retireCareer(c);
  const okName = (
    rc.retired === true
    && JSON.stringify(c) === snapshotC
    && rc.age === c.age
    && rc.season === c.season
    && rc.overallPeak === c.overallPeak
    && JSON.stringify(rc.careerStats) === JSON.stringify(c.careerStats)
    && JSON.stringify(rc.seasonHistory) === JSON.stringify(c.seasonHistory)
    && JSON.stringify(rc.trophies) === JSON.stringify(c.trophies)
    && JSON.stringify(rc.clubHistory) === JSON.stringify(c.clubHistory)
    && rc.events.length === c.events.length + 1
    && rc.events[rc.events.length - 1].type === 'retirement'
    && deepScan(rc)
    && (rc.achievements || []).every((a) => ACHIEVEMENTS.some((cat) => cat.id === a.id))
  );
  assert(okName, `${name}: retiro puro, cierre completo, logros del catálogo y sin NaN`);
  assert(JSON.stringify(retireCareer(rc)) === JSON.stringify(rc), `${name}: idempotente`);
}

// ============================================================================
// N) Compatibilidad: el resto del engine ante una career retirada.
//    (Sin cambios en esas funciones: si rechazan una retirada, es correcto.)
// ============================================================================
console.log('\n== N) Compatibilidad con el resto del engine ==');
const simSeason = simulateSeason(retired, { seed: 7777 });
assert(JSON.stringify(simSeason) === JSON.stringify(retired), 'simulateSeason: carrera retirada NO simula (copia intacta)');
const segment = simulateSegment(retired, 3, { seed: 7778 });
assert(segment && segment.seasonsSimulated === 0 && segment.stoppedReason === 'retirement', 'simulateSegment: 0 temporadas y stoppedReason retirement');
const marketOffers = generateTransferOffers(retired, { seed: 7779 });
assert(Array.isArray(marketOffers) && marketOffers.length === 0, 'generateTransferOffers: sin ofertas para una career retirada');
const offerForTransfer = generateTransferOffers(career, { seed: 7780 })[0];
const moved = offerForTransfer ? acceptTransfer(retired, offerForTransfer) : retired;
assert(JSON.stringify(moved) === JSON.stringify(retired), 'acceptTransfer: rechaza una career retirada (sin cambios)');
const stay = resolveStay(retired, { seed: 7781 });
assert(stay && stay.action === 'stay' && stay.loyaltyOvrBonus === 0 && JSON.stringify(stay.career) === JSON.stringify(retired), 'resolveStay: carrera retirada → copia intacta, sin bonus');
const youthOffers = generateYouthOffers(retired, { seed: 7782 });
assert(Array.isArray(youthOffers) && youthOffers.length === 0, 'generateYouthOffers: sin ofertas de debut para una career retirada');
assert(deepScan(segment.career || {}) && deepScan(moved) && deepScan(stay.career), 'resultados de compatibilidad sin NaN');

// La career original sigue intacta al cierre de todas las pruebas.
assert(JSON.stringify(career) === careerSnapshot, 'career original intacta al final de todas las pruebas');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);