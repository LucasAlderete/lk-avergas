// Smoke tests de acceptTransfer (bloque 5 del engine).
// Uso: node scripts/smoke-accept-transfer.mjs
import { players } from '../src/data.js';
import {
  createCareer, createSeededRng, simulateSeason, generateTransferOffers,
  acceptTransfer, cloneCareer,
} from '../src/features/career/engine.js';
import { allClubs, findClub, clubBaseline, clubKey, domesticReputation, clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { initialOvr, marketValue, roleMargin, roleBucket, AGE } from '../src/features/career/config.js';

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

// Reconstrucción de etapas para la UI: el cierre de cada etapa es el fromAge
// de la etapa siguiente (o la edad actual si es la última). Solo demostración
// de que la estructura alcanza para renderizar "16-18 años · Club · D2".
const renderStints = (career) => {
  const hist = career.clubHistory || [];
  return hist.map((entry, i) => {
    const toAge = hist[i + 1] ? hist[i + 1].fromAge : career.age;
    return `${entry.fromAge}-${toAge} años · ${entry.club.name} · D${entry.division}`;
  });
};

// Devuelve true si acceptTransfer(input, offerInput) devuelve una NUEVA carrera
// sin cambios (estrategia ante entradas inválidas: nunca lanza).
const expectUnchanged = (input, offerInput, label) => {
  const snap = JSON.stringify(input);
  const out = acceptTransfer(input, offerInput);
  if (out !== input && JSON.stringify(out) === snap) {
    console.log('  ✓', label);
    return true;
  }
  failures += 1;
  console.error('  ✗ FAIL:', label);
  return false;
};

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
// 1) Flujo completo: carrera real → ofertas → aceptar una oferta
// ============================================================================
const player = players.find((p) => p.name === 'Alan');
let current = careerWithClub(player, { difficulty: 'normal' });
for (let i = 0; i < 5; i += 1) current = simulateSeason(current, { seed: 1000 + i });

console.log(`\n== Alan (ovr ${current.ovr}, edad ${current.age}, ${current.club.name} D${current.club.division}, temporada ${current.season}) ==`);

// Compatibilidad: una carrera del flujo previo (solo simulateSeason) no tiene
// historial de clubes; acceptTransfer debe lidiar con eso.
assert(Array.isArray(current.clubHistory) && current.clubHistory.length === 0, 'carrera pre-bloque: clubHistory vacío (compatible con saves previos)');

const offers = generateTransferOffers(current, { seed: 42 });
assert(offers.length > 0, 'generateTransferOffers genera ofertas');
const offer = offers[0];

const careerSnapshot = JSON.stringify(current);
const offerSnapshot = JSON.stringify(offer);
const accepted = acceptTransfer(current, offer);

// --- Pureza -----------------------------------------------------------------
assert(accepted && accepted !== current, 'acceptTransfer devuelve un objeto NUEVO');
assert(JSON.stringify(current) === careerSnapshot, 'career original NO se muta');
assert(JSON.stringify(offer) === offerSnapshot, 'offer NO se muta');
assert(deepScan(accepted), 'sin NaN/Infinity en la carrera resultante');

// --- Club y división actualizados -------------------------------------------
const targetClub = findClub(offer.club.slug);
assert(accepted.club.slug === offer.club.slug, `club actualizado a ${offer.club.name}`);
assert(accepted.club.division === offer.division, `división actualizada a D${offer.division}`);
assert(accepted.club !== targetClub && accepted.club.colors !== targetClub.colors, 'club actual es copia fresca (no comparte referencia con el mundo)');
assert(accepted.club.ovr === targetClub.ovr && accepted.club.baseline === targetClub.baseline, 'club actual conserva los datos canónicos del mundo');

// --- Estado derivado recalculado --------------------------------------------
assert(accepted.domesticRep === domesticReputation(targetClub), 'reputación correspondiente al nuevo club');
assert(accepted.clubBaseline === clubBaseline(targetClub), 'baseline actualizado al nuevo club');
assert(accepted.overallVsBaseline === accepted.ovr - accepted.clubBaseline + roleMargin(accepted.attrs), 'overallVsBaseline recalculado');
assert(accepted.role === roleBucket(accepted.ovr - accepted.clubBaseline, accepted.position === 'ARQ'), 'rol recalculado para el nuevo club');
assert(accepted.marketValue === marketValue({ ovr: accepted.ovr, age: accepted.age, reputation: accepted.domesticRep, potential: accepted.overallPeak }), 'marketValue recalculado');
assert(accepted.marketValue === offer.estimatedValue, 'marketValue coincide con el estimatedValue de la oferta');

// --- Historial de clubes ------------------------------------------------------
const hist = accepted.clubHistory;
assert(Array.isArray(hist) && hist.length === 2, 'clubHistory: etapa inicial + etapa del traspaso');
assert(hist[0].club.slug === current.club.slug, `club anterior (${current.club.name}) queda en el historial`);
assert(hist[0].division === current.club.division, 'etapa inicial: división del club anterior');
assert(hist[0].fromAge === AGE.START && hist[0].fromSeason === 2026, 'etapa inicial sembrada desde el debut (16 años / 2026) — compat saves previos');
assert(hist[0].via === 'career_start', 'etapa inicial marcada como career_start');
assert(hist[1].club.slug === offer.club.slug, `etapa nueva: ${offer.club.name}`);
assert(hist[1].division === offer.division, 'etapa nueva: división del destino');
assert(hist[1].fromAge === current.age && hist[1].fromSeason === current.season, 'etapa nueva anclada a edad/temporada del traspaso');
assert(hist[1].via === 'transfer', 'etapa nueva marcada como transfer');
console.log('   Historial reconstruible:');
renderStints(accepted).forEach((line) => console.log('   ·', line));

// --- Evento de carrera (convención del motor: season/type/message) -----------
const ev = accepted.events[accepted.events.length - 1];
assert(accepted.events.length === current.events.length + 1, 'se agregó exactamente un evento');
assert(JSON.stringify(accepted.events.slice(0, -1)) === JSON.stringify(current.events), 'eventos previos intactos');
assert(ev.type === 'transfer' && ev.season === current.season, "evento { type: 'transfer', season } (misma convención que injury/trophy)");
assert(typeof ev.message === 'string' && ev.message.length > 0, 'evento con message legible');
assert(ev.fromClub.slug === current.club.slug && ev.toClub.slug === offer.club.slug, 'evento: fromClub/toClub');
assert(ev.fromDivision === current.club.division && ev.toDivision === offer.division, 'evento: fromDivision/toDivision (movimiento de división registrado)');
assert(ev.playerOvr === current.ovr, 'evento: playerOvr');
assert(ev.estimatedValue === offer.estimatedValue && Number.isFinite(ev.estimatedValue), 'evento: estimatedValue finito');

// --- Estadísticas / trofeos / logros / OVR / atributos intactos --------------
assert(accepted.ovr === current.ovr, 'OVR intacto');
assert(JSON.stringify(accepted.attrs) === JSON.stringify(current.attrs), 'atributos intactos');
assert(JSON.stringify(accepted.careerStats) === JSON.stringify(current.careerStats), 'careerStats intactas');
assert(JSON.stringify(accepted.seasonStats) === JSON.stringify(current.seasonStats), 'seasonStats intactas');
assert(accepted.injuries === current.injuries, 'injuries intacto');
assert(JSON.stringify(accepted.trophies) === JSON.stringify(current.trophies), 'trofeos intactos');
assert(JSON.stringify(accepted.achievements) === JSON.stringify(current.achievements), 'logros intactos');
assert(accepted.age === current.age && accepted.season === current.season, 'edad/temporada intactas (el traspaso no simula nada)');

// --- Doble aceptación de la misma oferta: sin corrupción ---------------------
const acceptedSnapshot = JSON.stringify(accepted);
const double = acceptTransfer(accepted, offer);
assert(double && double !== accepted, 'doble aceptación devuelve objeto nuevo');
assert(JSON.stringify(double) === acceptedSnapshot, 'doble aceptación: carrera sin cambios (mismo club → rechazada)');
assert(double.clubHistory.length === 2, 'doble aceptación: historial sin duplicados');
assert(double.events.length === accepted.events.length, 'doble aceptación: sin eventos duplicados');

// --- simulateSeason sigue funcionando tras el traspaso -----------------------
const sim = simulateSeason(accepted, { seed: 777 });
assert(sim.club.slug === accepted.club.slug, 'simulateSeason: el club transferido se conserva');
assert(sim.age === accepted.age + 1 && sim.season === accepted.season + 1, 'simulateSeason: calendario avanza');
assert(sim.seasonHistory.length === accepted.seasonHistory.length + 1, 'simulateSeason: temporada archivada');
assert(sim.seasonHistory[sim.seasonHistory.length - 1].club.key === clubKey(accepted.club), 'simulateSeason: reporte de temporada con el club nuevo');
assert(sim.careerStats.pj >= accepted.careerStats.pj, 'simulateSeason: estadísticas acumulan');
assert(Number.isFinite(sim.marketValue) && sim.marketValue > 0, 'simulateSeason: valor de mercado finito');
assert(deepScan(sim), 'simulateSeason: sin NaN/Infinity');

// ============================================================================
// 2) Casos inválidos: nueva career sin cambios, sin lanzar errores
// ============================================================================
console.log('\n== Casos inválidos (nueva career sin cambios, sin lanzar) ==');

// Ofertas inválidas / rotas.
expectUnchanged(current, null, 'oferta null → sin cambios');
expectUnchanged(current, undefined, 'oferta undefined → sin cambios');
expectUnchanged(current, {}, 'oferta {} → sin cambios');
expectUnchanged(current, { division: 2, estimatedValue: 1000 }, 'oferta sin club → sin cambios');
expectUnchanged(current, { ...offer, estimatedValue: NaN }, 'estimatedValue NaN → sin cambios');
expectUnchanged(current, { ...offer, estimatedValue: Infinity }, 'estimatedValue Infinity → sin cambios');
expectUnchanged(current, { ...offer, division: NaN }, 'división NaN → sin cambios');
expectUnchanged(current, { ...offer, division: '2' }, 'división como string ("2") → sin cambios');
expectUnchanged(current, { ...offer, division: 7 }, 'división fuera del mundo (7) → sin cambios');
expectUnchanged(current, { ...offer, division: offer.division === 1 ? 2 : 1 }, 'división inconsistente con el club → sin cambios');

// Club inexistente.
expectUnchanged(
  current,
  { ...offer, club: { ...offer.club, slug: 'club-fantasma', name: 'Fantasma FC' }, division: 1 },
  'club inexistente (slug fantasma) → sin cambios',
);

// Oferta del club actual.
expectUnchanged(
  current,
  { ...offer, club: { ...offer.club, slug: current.club.slug, name: current.club.name }, division: current.club.division },
  'oferta del club actual → sin cambios',
);

// Carreras inválidas.
assert(acceptTransfer(null, offer) === null, 'career null → null (sin lanzar)');
assert(acceptTransfer(undefined, offer) === undefined, 'career undefined → undefined (sin lanzar)');
expectUnchanged({ ovr: 70, age: 20 }, offer, 'career incompleta → sin cambios');
const retired = cloneCareer(current);
retired.retired = true;
expectUnchanged(retired, offer, 'career retirada → sin cambios');

// Fallback de resolución por key compuesta ("division/slug").
const keyOnlyOffer = { ...offer, club: { ...offer.club, slug: undefined } };
const viaKey = acceptTransfer(current, keyOnlyOffer);
assert(viaKey.club.slug === offer.club.slug, 'oferta con solo club.key también resuelve (fallback findClubByKey)');

// ============================================================================
// 3) Save con ofertas pendientes guardadas + contenido histórico
// ============================================================================
console.log('\n== Save con ofertas pendientes y contenido histórico ==');
const enriched = cloneCareer(current);
enriched.trophies = [{ type: 'league', label: 'Liga', icon: '🏆', season: current.season - 1, clubName: current.club.name }];
enriched.achievements = [{ id: 'centurion', label: 'Centurión del Barrio' }];
enriched.events = [...(enriched.events || []), { season: current.season - 1, type: 'injury', message: 'Prueba.' }];
enriched.pendingOffers = [offer, offers[1]];
enriched.offers = [offer];
const enrichedSnapshot = JSON.stringify(enriched);
const moved = acceptTransfer(enriched, offer);
assert(JSON.stringify(moved.trophies) === JSON.stringify(enriched.trophies), 'trofeos históricos se conservan');
assert(JSON.stringify(moved.achievements) === JSON.stringify(enriched.achievements), 'logros se conservan');
assert(moved.events.length === enriched.events.length + 1, 'eventos previos + 1 evento de traspaso');
assert(Array.isArray(moved.pendingOffers) && moved.pendingOffers.length === 0, 'pendingOffers existente → limpiada');
assert(Array.isArray(moved.offers) && moved.offers.length === 0, 'offers existente → limpiada');
assert(JSON.stringify(enriched) === enrichedSnapshot, 'el save original NO se muta');

// ============================================================================
// 4) Segundo traspaso: historial acumulativo
// ============================================================================
console.log('\n== Segundo traspaso: historial acumulativo ==');
const offers2 = generateTransferOffers(accepted, { seed: 43 });
const offer2 = offers2[0];
const twice = acceptTransfer(accepted, offer2);
assert(twice.clubHistory.length === 3, 'dos traspasos → tres etapas en clubHistory');
assert(twice.clubHistory[1].club.slug === offer.club.slug && twice.clubHistory[2].club.slug === offer2.club.slug, 'etapas en orden cronológico');
assert(twice.events.filter((e) => e.type === 'transfer').length === 2, 'dos eventos de traspaso registrados');
assert(deepScan(twice), 'sin NaN/Infinity tras el segundo traspaso');
console.log('   Historial reconstruible:');
renderStints(twice).forEach((line) => console.log('   ·', line));

// ============================================================================
// 5) Otros jugadores: la aceptación funciona en distintos rangos de OVR
// ============================================================================
console.log('\n== Otros jugadores ==');
for (const playerName of ['Nahue', 'Mati', 'JJ', 'Gonzi']) {
  const p = players.find((x) => x.name === playerName);
  let c = careerWithClub(p, { difficulty: 'normal' });
  for (let i = 0; i < 5; i += 1) c = simulateSeason(c, { seed: 2000 + i });
  const cOffers = generateTransferOffers(c, { seed: 42 });
  const cOffer = cOffers[0];
  const before = JSON.stringify(c);
  const nextC = acceptTransfer(c, cOffer);
  assert(nextC.club.slug === cOffer.club.slug && nextC.club.division === cOffer.division,
    `${playerName}: acepta y cambia a ${cOffer.club.name} (D${cOffer.division})`);
  assert(nextC.clubHistory.length === 2 && nextC.clubHistory[0].club.slug === c.club.slug,
    `${playerName}: club anterior en historial`);
  assert(nextC.ovr === c.ovr && JSON.stringify(nextC.careerStats) === JSON.stringify(c.careerStats),
    `${playerName}: OVR y estadísticas intactos`);
  assert(JSON.stringify(c) === before, `${playerName}: career original sin mutar`);
}

// Pureza global al cierre.
assert(JSON.stringify(current) === careerSnapshot, 'career original sigue intacta al final de todas las pruebas');
assert(JSON.stringify(offer) === offerSnapshot, 'offer sigue intacta al final de todas las pruebas');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
