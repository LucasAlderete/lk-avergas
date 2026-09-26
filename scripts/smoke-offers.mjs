// Smoke tests de generateTransferOffers (bloque 4 del engine).
// Uso: node scripts/smoke-offers.mjs
import { players } from '../src/data.js';
import { createCareer, createSeededRng, simulateSeason, generateTransferOffers } from '../src/features/career/engine.js';
import { allClubs, findClub, clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { initialOvr, OFFER_RULES } from '../src/features/career/config.js';

const realClubs = new Set(allClubs().map((c) => c.slug));
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

const validateOffers = (career, offers, label) => {
  for (const offer of offers) {
    assert(offer.club.slug !== career.club.slug, `${label}: club actual (${career.club.name}) no aparece como oferta`);
    assert(realClubs.has(offer.club.slug), `${label}: club de oferta existente (${offer.club.name})`);
    assert(findClub(offer.club.slug).division === offer.division, `${label}: división coherente con el club`);
    assert(offer.division >= 1 && offer.division <= 2, `${label}: división válida (1-2, sin tercera)`);
    const jump = offer.division - career.club.division;
    assert(jump <= OFFER_RULES.maxDivisionJumpUp, `${label}: salto arriba <= maxDivisionJumpUp (${jump})`);
    assert(jump >= -OFFER_RULES.maxDivisionDrop, `${label}: salto abajo >= -maxDivisionDrop (${jump})`);
    if (offer.division === 1) {
      assert(offer.playerOvr >= OFFER_RULES.firstDivisionMinOvr, `${label}: oferta D1 respeta firstDivisionMinOvr`);
    }
    assert(offer.estimatedValue > 0 && Number.isFinite(offer.estimatedValue), `${label}: valor estimado finito y positivo`);
    assert(offer.id && offer.message && offer.reason && offer.expectedRole && offer.roleLabel,
      `${label}: oferta completa (id/reason/message/rol)`);
    assert(deepScan(offer), `${label}: sin NaN/Infinity en la oferta`);
  }
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

// --- Casos: OVR bajo / medio / alto con jugadores reales -------------------
const cases = [
  { name: 'Nahue', bucket: 'OVR BAJO' },   // rating 56
  { name: 'Rui', bucket: 'OVR BAJO' },     // rating 60
  { name: 'Mati', bucket: 'OVR MEDIO' },   // rating 69
  { name: 'Alan', bucket: 'OVR MEDIO' },   // rating 77
  { name: 'JJ', bucket: 'OVR MEDIO-ALTO' },// rating 81
  { name: 'Gonzi', bucket: 'OVR ALTO' },   // rating 87
];

for (const playerName of cases.map((c) => c.name)) {
  const player = players.find((p) => p.name === playerName);
  const career = careerWithClub(player, { difficulty: 'normal' });

  // Avanza algunas temporadas para tener un estado "de carrera".
  let current = career;
  for (let i = 0; i < 5; i += 1) current = simulateSeason(current, { seed: 1000 + i });

  const snapshot = JSON.stringify(current);
  const offersA = generateTransferOffers(current, { seed: 42 });
  const offersB = generateTransferOffers(current, { seed: 42 });
  const snapshotAfter = JSON.stringify(current);

  console.log(`\n== ${playerName} (ovr ${current.ovr}, edad ${current.age}, ${current.club.name} D${current.club.division}) ==`);
  assert(JSON.stringify(offersA) === JSON.stringify(offersB), `${playerName}: determinismo con seed`);
  assert(snapshotAfter === snapshot, `${playerName}: career no mutada`);
  assert(offersA.length === OFFER_RULES.transferOfferCount, `${playerName}: cantidad de ofertas = transferOfferCount`);
  assert(deepScan(offersA), `${playerName}: sin NaN/Infinity`);
  validateOffers(current, offersA, playerName);

  // RNG inyectado explícito también funciona.
  const rngOffers = generateTransferOffers(current, { rng: createSeededRng(7) });
  assert(Array.isArray(rngOffers) && rngOffers.length > 0, `${playerName}: funciona con { rng }`);
  validateOffers(current, rngOffers, `${playerName} (rng)`);

  for (const offer of offersA) {
    console.log(`   -> [${offer.reason}] ${offer.club.name} (D${offer.division}, baseline ${offer.clubBaseline}, clubOvr ${offer.clubOvr}) `
      + `| rol esperado: ${offer.roleLabel} | valor: ${offer.estimatedValue} | ${offer.message}`);
  }
}

// --- Casos límite: senior y retirado --------------------------------------
const gonzi = players.find((p) => p.name === 'Gonzi');
let senior = careerWithClub(gonzi);
for (let i = 0; i < 18; i += 1) senior = simulateSeason(senior, { seed: 500 + i });
console.log(`\n== Gonzi senior (ovr ${senior.ovr}, edad ${senior.age}, ${senior.club.name} D${senior.club.division}) ==`);
const seniorOffers = generateTransferOffers(senior, { seed: 99 });
assert(seniorOffers.every((o) => o.club.slug !== senior.club.slug), 'senior: club actual no aparece');
validateOffers(senior, seniorOffers, 'senior');
for (const offer of seniorOffers) {
  console.log(`   -> [${offer.reason}] ${offer.club.name} (D${offer.division}, baseline ${offer.clubBaseline}) | rol: ${offer.roleLabel} | valor: ${offer.estimatedValue}`);
}

const retired = { ...careerWithClub(gonzi), retired: true };
assert(generateTransferOffers(retired).length === 0, 'career retirada devuelve []');
assert(generateTransferOffers(null).length === 0, 'career null devuelve []');
assert(generateTransferOffers({ ovr: 70, age: 20 }).length === 0, 'career incompleta devuelve []');

// Sin seed ni rng (Math.random): no explota y es array válido.
const loose = generateTransferOffers(careerWithClub(players[0]));
assert(Array.isArray(loose) && loose.length === OFFER_RULES.transferOfferCount, 'sin opciones: usa Math.random y devuelve array válido');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
