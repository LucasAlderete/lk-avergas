// Smoke tests de generateYouthOffers (ofertas de debut, bloque 6).
// El debut elige una división real entre las elegibles; no existe una tercera.
// Uso: node scripts/smoke-youth-offers.mjs
import { players } from '../src/data.js';
import {
  createCareer, createSeededRng, generateYouthOffers, acceptTransfer,
} from '../src/features/career/engine.js';
import {
  allClubs, findClub, startingDivisionsForOvr, clubBaseline, domesticReputation, divisions,
} from '../src/data/careerWorld.js';
import { OFFER_RULES, ROLE_LABELS, roleBucket, initialOvr, AGE } from '../src/features/career/config.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const deepScan = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (Array.isArray(v)) return v.every(deepScan);
  return Object.values(v).every(deepScan);
};

const realClubs = new Set(allClubs().map((c) => c.slug));
const divisionTiers = new Set(divisions.map((d) => d.nivel));
const VALID_ROLES = new Set(['starter', 'high_rotation', 'low_rotation', 'substitute', 'third_keeper']);
const REQUIRED_FIELDS = [
  'id', 'club', 'division', 'clubBaseline', 'clubOvr', 'clubReputation',
  'playerOvr', 'expectedRole', 'roleLabel', 'estimatedValue', 'reason',
];

// Niveles jugables del catálogo. El debut usa uno de ellos según el OVR.

// Validación completa de una tanda de ofertas contra una carrera/player.
const validateOffers = (input, offers, label) => {
  const ovr = Number.isFinite(input.ovr) ? input.ovr : initialOvr(input.rating);
  const allowed = startingDivisionsForOvr(ovr);
  const isGK = (input.position || 'MED') === 'ARQ';
  const slugs = new Set();

  assert(Array.isArray(offers), `${label}: devuelve un array`);
  assert(offers.length === OFFER_RULES.youthOfferCount,
    `${label}: SIEMPRE ${OFFER_RULES.youthOfferCount} ofertas (${offers.length})`);
  assert(deepScan(offers), `${label}: sin NaN/Infinity en las ofertas`);

  for (const offer of offers) {
    const tag = `${label} [${offer.id}]`;
    for (const field of REQUIRED_FIELDS) {
      assert(offer[field] !== undefined && offer[field] !== null, `${tag}: campo requerido ${field}`);
    }
    assert(offer.reason === 'youth_debut', `${tag}: reason identifica debut`);
    assert(typeof offer.message === 'string' && offer.message.length > 0, `${tag}: message legible`);

    assert(typeof offer.club === 'object' && offer.club.slug, `${tag}: offer.club objeto con slug`);
    assert(realClubs.has(offer.club.slug), `${tag}: club existente en el mundo (${offer.club.name})`);
    assert(!slugs.has(offer.club.slug), `${tag}: club sin repetirse (${offer.club.name})`);
    slugs.add(offer.club.slug);

    const canonical = findClub(offer.club.slug);
    assert(divisionTiers.has(offer.division), `${tag}: división válida (D${offer.division})`);
    assert(canonical.division === offer.division, `${tag}: división coherente con el club`);
    assert(allowed.includes(offer.division),
      `${tag}: división permitida por startingDivisionsForOvr (ovr ${ovr} → D${allowed.join('/')} · oferta D${offer.division})`);
    // Pool del debut: SIEMPRE Argentina, en una sola división elegible.
    // Atlante (MX) nunca aparece.
    assert(canonical.countryCode === 'AR', `${tag}: club ARGENTINO (${canonical.countryCode})`);
    assert(offer.club.slug !== 'atlante', `${tag}: Atlante nunca es opción inicial`);
    if (input.club && input.club.slug) {
      assert(offer.club.slug !== input.club.slug, `${tag}: no ofrece el club actual (si la entrada trae uno)`);
    }

    assert(offer.playerOvr === ovr, `${tag}: playerOvr = OVR del jugador (${offer.playerOvr})`);
    assert(offer.clubBaseline === clubBaseline(canonical), `${tag}: clubBaseline = clubBaseline() del mundo`);
    assert(offer.clubOvr === canonical.ovr, `${tag}: clubOvr = ovr del club`);
    assert(offer.clubReputation === domesticReputation(canonical), `${tag}: clubReputation = domesticReputation()`);
    assert(Number.isFinite(offer.estimatedValue) && offer.estimatedValue > 0, `${tag}: estimatedValue finito y > 0`);

    assert(VALID_ROLES.has(offer.expectedRole), `${tag}: expectedRole válido (${offer.expectedRole})`);
    assert(offer.expectedRole === roleBucket(offer.playerOvr - offer.clubBaseline, isGK),
      `${tag}: expectedRole coherente con roleBucket`);
    assert(offer.roleLabel === ROLE_LABELS[offer.expectedRole], `${tag}: roleLabel = ROLE_LABELS[rol]`);
  }
};

// ============================================================================
// 1) Jugadores reales: OVR bajo / medio / alto
// ============================================================================
const cases = [
  { name: 'Nahue', bucket: 'OVR BAJO' },    // rating 56 → solo Segunda
  { name: 'Rui', bucket: 'OVR BAJO' },      // rating 60 → solo Segunda
  { name: 'Luquitas', bucket: 'OVR BAJO' }, // rating 60 → solo Segunda
  { name: 'Mati', bucket: 'OVR MEDIO' },    // rating 69 → solo Segunda
  { name: 'Lk', bucket: 'OVR MEDIO' },      // rating 75 → solo Segunda
  { name: 'Alan', bucket: 'OVR MEDIO' },    // rating 77 → Primera o Segunda
  { name: 'Kike', bucket: 'OVR MEDIO' },    // rating 79 → Primera o Segunda
  { name: 'JJ', bucket: 'OVR ALTO' },       // rating 81 → Primera o Segunda
  { name: 'Gonzi', bucket: 'OVR ALTO' },    // rating 87 → Primera o Segunda
  { name: 'Tigre', bucket: 'OVR BAJO' },    // rating 70 → solo Segunda
];

assert(cases.length >= 6, `se prueban ${cases.length} jugadores reales (>= 6)`);

for (const { name, bucket } of cases) {
  const player = players.find((p) => p.name === name);
  const career = createCareer(player, { difficulty: 'normal' });
  const snapshot = JSON.stringify(career);
  assert(career.club === null, `${name}: createCareer nace SIN club (null)`);

  console.log(`\n== ${name} (${bucket}: ovr ${career.ovr}, rating ${player.rating}) · club = null (lo elige el jugador) ==`);

  // Determinismo con seed + pureza.
  const offersA = generateYouthOffers(career, { seed: 42 });
  const offersB = generateYouthOffers(career, { seed: 42 });
  assert(JSON.stringify(offersA) === JSON.stringify(offersB), `${name}: determinismo con seed`);
  assert(offersA !== offersB, `${name}: cada llamada devuelve un array nuevo`);
  assert(JSON.stringify(career) === snapshot, `${name}: career NO mutada`);
  assert(career.clubHistory.length === 0, `${name}: clubHistory intacto`);
  assert(deepScan(career), `${name}: career sin NaN/Infinity`);
  validateOffers(career, offersA, name);

  // RNG inyectado explícito.
  const rngOffers = generateYouthOffers(career, { rng: createSeededRng(7) });
  assert(Array.isArray(rngOffers) && rngOffers.length > 0, `${name}: funciona con { rng }`);
  validateOffers(career, rngOffers, `${name} (rng)`);

  // Sin opciones (Math.random): no explota y devuelve array válido.
  const loose = generateYouthOffers(career);
  assert(Array.isArray(loose) && loose.length > 0, `${name}: sin opciones usa el RNG default`);
  validateOffers(career, loose, `${name} (default)`);

  // Variación aleatoria reproducible: distintos seeds → tandas distintas.
  const seedJsons = new Set();
  for (let seed = 1; seed <= 10; seed += 1) {
    seedJsons.add(JSON.stringify(generateYouthOffers(career, { seed })));
  }
  assert(seedJsons.size >= 2, `${name}: variación entre seeds (${seedJsons.size} tandas distintas en 10)`);

  // Cada oferta puede procesarse después con acceptTransfer.
  for (const offer of offersA) {
    const pre = JSON.stringify(career);
    const moved = acceptTransfer(career, offer);
    assert(moved && moved !== career, `${offer.id}: acceptTransfer procesa la oferta`);
    assert(moved.club.slug === offer.club.slug && moved.club.division === offer.division,
      `${offer.id}: traspaso a ${offer.club.name} (D${offer.division})`);
    assert(moved.clubHistory.length === 1,
      `${offer.id}: clubHistory con 1 etapa (la carrera nació SIN club: el debut es la etapa inicial)`);
    assert(JSON.stringify(career) === pre, `${offer.id}: career original sigue sin mutar`);
    assert(deepScan(moved), `${offer.id}: carrera resultante sin NaN/Infinity`);
  }

  for (const offer of offersA) {
    console.log(`   -> ${offer.club.name} (D${offer.division}, baseline ${offer.clubBaseline}, ovr club ${offer.clubOvr}, rep ${offer.clubReputation})`
      + ` | rol: ${offer.roleLabel} | valor: ${offer.estimatedValue} | ovrVsBaseline ${offer.ovrVsBaseline}`);
  }
}



// ============================================================================
// 2) Jugador crudo de data.js (sin createCareer): también funciona
// ============================================================================
console.log('\n== Player crudo de data.js (sin career) ==');
for (const name of ['Chino', 'Emi', 'Cru', 'Sailor']) {
  const raw = players.find((p) => p.name === name);
  const offers = generateYouthOffers(raw, { seed: 42 });
  validateOffers(raw, offers, `${name} (crudo)`);
  assert(offers.every((o) => o.playerOvr === initialOvr(raw.rating)), `${name}: playerOvr = initialOvr(rating)`);
  console.log(`   -> ${name}: ${offers.map((o) => `${o.club.short} D${o.division}`).join(' · ')}`);
}

// ============================================================================
// 3) Pool inicial: SIEMPRE Argentina, división elegible y muchoTERNATIV
// ============================================================================
console.log('\n== Pool inicial: Argentina + Primera/Segunda elegible (barrido de seeds 1..12) ==');
for (const name of ['JJ', 'Gonzi', 'Tigre', 'Nahue', 'Mati']) {
  const career = createCareer(players.find((p) => p.name === name));
  const allowed = startingDivisionsForOvr(career.ovr);
  const seenClubs = new Set();
  const seenDivisions = new Set();
  const teams = new Set();
  let ok = true;
  for (let seed = 1; seed <= 12; seed += 1) {
    const batch = generateYouthOffers(career, { seed });
    if (batch.length !== OFFER_RULES.youthOfferCount) ok = false;
    teams.add(JSON.stringify(batch.map((o) => o.club.slug)));
    for (const offer of batch) {
      const canonical = findClub(offer.club.slug);
      if (canonical.countryCode !== 'AR') ok = false;
      if (offer.club.slug === 'atlante') ok = false;
      if (!allowed.includes(offer.division)) ok = false;
      seenClubs.add(offer.club.slug);
      seenDivisions.add(offer.division);
    }
  }
  assert(ok, `${name}: 12 tandas → exactamente 3 ofertas, todas argentinas y de divisiones elegibles`);
  assert([...seenDivisions].every((nivel) => divisionTiers.has(nivel)),
    `${name}: ninguna oferta usa una categoría fuera del catálogo (D${[...seenDivisions].join('/D')})`);
  assert(teams.size >= 2, `${name}: las ofertas VARÍAN entre seeds (${teams.size} tandas distintas en 12)`);
  assert(seenClubs.size > OFFER_RULES.youthOfferCount,
    `${name}: el pool efectivo supera las 3 ofertas (${seenClubs.size} clubes vistos)`);
  console.log(`   -> ${name}: ${seenClubs.size} clubes distintos vistos en 12 seeds, D${[...seenDivisions].join('/D')}`);
}

// Con elegibilidad doble, el seed decide realmente entre Primera y Segunda.
{
  const career = createCareer(players.find((p) => p.name === 'Gonzi'));
  assert(startingDivisionsForOvr(career.ovr).length === 2,
    'OVR alto → Primera y Segunda elegibles');
  const divisionsBySeed = new Set();
  let oneDivisionPerBatch = true;
  for (let seed = 1; seed <= 40; seed += 1) {
    const batch = generateYouthOffers(career, { seed });
    const batchDivisions = new Set(batch.map((offer) => offer.division));
    if (batchDivisions.size !== 1) oneDivisionPerBatch = false;
    for (const division of batchDivisions) divisionsBySeed.add(division);
  }
  assert(oneDivisionPerBatch, 'las 3 ofertas iniciales salen de una sola división');
  assert(divisionsBySeed.has(1) && divisionsBySeed.has(2),
    'distintos seeds cambian la división inicial entre Primera y Segunda');
  const sameSeedA = generateYouthOffers(career, { seed: 777 });
  const sameSeedB = generateYouthOffers(career, { seed: 777 });
  assert(JSON.stringify(sameSeedA) === JSON.stringify(sameSeedB),
    'mismo seed → mismas 3 ofertas y misma división (determinismo del RNG)');
}

// ============================================================================
// 4) Carreras incompletas / inválidas: nunca lanza excepciones
// ============================================================================
console.log('\n== Carreras incompletas e inválidas ==');
assert(JSON.stringify(generateYouthOffers(null)) === '[]', 'null → []');
assert(JSON.stringify(generateYouthOffers(undefined)) === '[]', 'undefined → []');
assert(JSON.stringify(generateYouthOffers(42)) === '[]', 'número → []');
assert(JSON.stringify(generateYouthOffers('career')) === '[]', 'string → []');
assert(JSON.stringify(generateYouthOffers({})) === '[]', 'objeto vacío → []');
assert(JSON.stringify(generateYouthOffers({ rating: NaN })) === '[]', 'rating NaN → []');
assert(JSON.stringify(generateYouthOffers({ ovr: NaN, age: 16 })) === '[]', 'ovr NaN → []');
assert(JSON.stringify(generateYouthOffers({ ovr: Infinity, age: 16 })) === '[]', 'ovr Infinity → []');

const gonzi = players.find((p) => p.name === 'Gonzi');
assert(JSON.stringify(generateYouthOffers({ ...createCareer(gonzi), retired: true })) === '[]', 'career retirada → []');

// Career mínima (solo ovr + edad): genera ofertas válidas con defaults.
const minimal = { ovr: 70, age: 16, season: 2026 };
const minimalOffers = generateYouthOffers(minimal, { seed: 42 });
assert(minimalOffers.length === OFFER_RULES.youthOfferCount, 'career mínima: genera ofertas');
assert(deepScan(minimalOffers), 'career mínima: sin NaN/Infinity (attrs neutros, sin club)');
validateOffers(minimal, minimalOffers, 'mínima');

// Player crudo con datos incompletos: sin lanzar, resultado consistente.
assert(Array.isArray(generateYouthOffers({ rating: 70, pace: 5 })), 'player crudo incompleto: array sin lanzar');

// Age por debajo del debut: [] (no tiene sentido ofrecer cantera antes).
assert(JSON.stringify(generateYouthOffers({ ovr: 70, age: AGE.START - 1 })) === '[]', 'age < debut → []');

// Edad avanzada sin estar retirado: se maneja sin lanzar (array válido).
const seniorInput = { ovr: 70, age: 41, season: 2051 };
const seniorOffers = generateYouthOffers(seniorInput, { seed: 42 });
assert(Array.isArray(seniorOffers) && deepScan(seniorOffers), 'edad avanzada sin retiro: array válido sin lanzar');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
