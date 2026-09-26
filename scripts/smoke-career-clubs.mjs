// ============================================================================
// Smoke test del CATÁLOGO DE CLUBES REALES (fase 1 del reemplazo de Avergas)
// Uso: node scripts/smoke-career-clubs.mjs
//
// Cubre:
//  A) Catálogo: cantidad total, clubes por país, clubes por división interna,
//     IDs/claves/slugs únicos, nombres únicos dentro del mismo país, OVR válido,
//     reputaciones 0-5, colores hex, escudo procedural y modelo completo.
//  B) API del mundo: allClubs / clubs / clubsByDivision / clubKey / findClub /
//     findClubByKey / divisions / worldMeta / domesticReputation / clubBaseline /
//     startingDivisionsForOvr (misma firma que consumía el mundo Avergas).
//  C) Engine con clubes reales: createCareer, generateYouthOffers,
//     generateTransferOffers, acceptTransfer y simulateSegment.
//  D) Persistencia/versionado: un save del mundo Avergas (worldVersion previa)
//     se rechaza con el catálogo actual y el save nuevo se relee.
//
// NO corre npm build ni instala dependencias.
// ============================================================================
import { players } from '../src/data.js';
import {
  CAREER_WORLD_VERSION,
  allClubs,
  clubBaseline,
  clubKey,
  clubs,
  clubsByDivision,
  divisions,
  domesticReputation,
  findClub,
  findClubByKey,
  startingDivisionsForOvr,
  worldMeta,
} from '../src/data/careerWorld.js';
import { OVR } from '../src/features/career/config.js';
import {
  acceptTransfer,
  createCareer,
  generateTransferOffers,
  generateYouthOffers,
  simulateSegment,
} from '../src/features/career/engine.js';
import { chooseYouthClub, startCareer } from '../src/features/career/flow.js';
import {
  CAREER_SAVE_SCHEMA_VERSION,
  deserializeCareerState,
  serializeCareerState,
} from '../src/features/career/persistence.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  x FAIL:', label); }
  else console.log('  ok', label);
};

// Recorrido recursivo: true si ningún número es NaN/Infinity.
const deepScan = (value) => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(deepScan);
  return Object.values(value).every(deepScan);
};

const HEX = /^#[0-9a-fA-F]{6}$/;
// Universo cerrado: 8 países / 13 competiciones / 296 clubes.
const EXPECTED_COUNTRIES = { AR: 66, ES: 42, EN: 44, IT: 40, FR: 36, BR: 20, US: 30, MX: 18 };
const EXPECTED_LEAGUES = {
  ar_lp: 30, ar_nac: 36, es_1: 20, es_2: 22, fr_1: 18, fr_2: 18,
  en_pl: 20, en_ch: 24, it_a: 20, it_b: 20, br_a: 20, us_mls: 30, mx_1: 18,
};

// ============================================================================
// A) CATÁLOGO
// ============================================================================
console.log('\n== A) Catálogo de clubes ==');

const catalog = allClubs();
assert(catalog.length === 296, `cantidad total de clubes = 296 (${catalog.length})`);
assert(catalog.length === clubs.length, 'allClubs() refleja el mismo catálogo que clubs');

const byCountry = {};
const byLeague = {};
for (const club of catalog) {
  byCountry[club.countryCode] = (byCountry[club.countryCode] || 0) + 1;
  byLeague[club.leagueId] = (byLeague[club.leagueId] || 0) + 1;
}
console.log(`   -> países: ${Object.entries(byCountry).map(([code, total]) => `${code} ${total}`).join(' · ')}`);
console.log(`   -> ligas: ${Object.entries(byLeague).map(([id, total]) => `${id} ${total}`).join(' · ')}`);
for (const [code, expected] of Object.entries(EXPECTED_COUNTRIES)) {
  assert((byCountry[code] || 0) === expected, `país ${code} = ${expected} clubes (${byCountry[code] || 0})`);
}
const extraCountries = Object.keys(byCountry).filter((code) => !(code in EXPECTED_COUNTRIES));
assert(extraCountries.length === 0, `sin países fuera del universo (${extraCountries.join(', ')})`);
for (const [id, expected] of Object.entries(EXPECTED_LEAGUES)) {
  assert((byLeague[id] || 0) === expected, `competición ${id} = ${expected} clubes (${byLeague[id] || 0})`);
}
const extraLeagues = Object.keys(byLeague).filter((id) => !(id in EXPECTED_LEAGUES));
assert(extraLeagues.length === 0, `sin competiciones fuera del universo (${extraLeagues.join(', ')})`);

const byDivision = {};
for (const club of catalog) byDivision[club.division] = (byDivision[club.division] || 0) + 1;
console.log(`   -> divisiones internas: D1 ${byDivision[1] || 0} · D2 ${byDivision[2] || 0}`);
for (const nivel of [1, 2]) {
  assert((byDivision[nivel] || 0) >= 10, `división interna D${nivel} poblada (>= 10, tiene ${byDivision[nivel] || 0})`);
}

const ids = new Set(catalog.map((club) => club.id));
const keys = new Set(catalog.map((club) => club.key));
const slugs = new Set(catalog.map((club) => club.slug));
assert(ids.size === catalog.length, `IDs únicos (${ids.size}/${catalog.length})`);
assert(keys.size === catalog.length, `claves únicas (${keys.size}/${catalog.length})`);
assert(slugs.size === catalog.length, `slugs únicos (${slugs.size}/${catalog.length})`);

const nameKeys = new Set(catalog.map((club) => `${club.countryCode}::${club.name.toLowerCase()}`));
assert(nameKeys.size === catalog.length,
  `nombres únicos dentro del mismo país (${nameKeys.size}/${catalog.length})`);

// --- Modelo por club: campos obligatorios y valores válidos -----------------
const MODEL_FIELDS = [
  'id', 'slug', 'key', 'name', 'short', 'shortName', 'country', 'countryCode', 'countryFlag',
  'city', 'league', 'leagueId', 'leagueLevel', 'division', 'ovr', 'overall', 'baseline',
  'domesticReputation', 'continentalReputation', 'internationalReputation', 'colors', 'crest',
  'barrio', 'stadium', 'founded',
];
const missing = [];
const badOvr = [];
const badDivision = [];
const badReps = [];
const badColors = [];
const badCrest = [];
const badLeague = [];

for (const club of catalog) {
  for (const field of MODEL_FIELDS) {
    if (club[field] === undefined || club[field] === null) missing.push(`${club.id}.${field}`);
  }

  // OVR: entero dentro de los límites del juego y coherente en sus tres vistas
  // (overall curado = ovr del engine = baseline del plantel).
  const ovrOk = Number.isInteger(club.overall)
    && club.overall >= OVR.MIN && club.overall <= OVR.MAX
    && club.overall === club.ovr && club.overall === club.baseline;
  if (!ovrOk) badOvr.push(`${club.id}=${club.overall}/${club.ovr}/${club.baseline}`);

  // División interna derivada del OVR por bandas (D1 >= 76, D2 < 76: Segunda es el
  // piso jugable, sin tercera categoría).
  const expectedDivision = club.ovr >= 76 ? 1 : 2;
  if (club.division !== expectedDivision) {
    badDivision.push(`${club.id}=D${club.division}/esperado D${expectedDivision}`);
  }

  const reps = [club.domesticReputation, club.continentalReputation, club.internationalReputation];
  const repsOk = reps.every((value) => Number.isInteger(value) && value >= 0 && value <= 5)
    && club.internationalReputation <= club.continentalReputation;
  if (!repsOk) badReps.push(`${club.id}=${reps.join('/')}`);

  const colors = club.colors;
  const colorsOk = Boolean(colors) && HEX.test(colors.primary) && HEX.test(colors.secondary)
    && colors.primary.toLowerCase() !== colors.secondary.toLowerCase();
  if (!colorsOk) badColors.push(`${club.id}=${JSON.stringify(colors)}`);

  const crest = club.crest;
  const crestOk = Boolean(crest) && crest.type === 'procedural'
    && typeof crest.shape === 'string' && crest.shape.length > 0
    && typeof crest.symbol === 'string' && crest.symbol.length >= 2 && crest.symbol.length <= 3
    && crest.symbol === crest.symbol.toUpperCase()
    && crest.primary === (colors && colors.primary)
    && crest.secondary === (colors && colors.secondary);
  if (!crestOk) badCrest.push(`${club.id}=${JSON.stringify(crest)}`);

  if (!Number.isInteger(club.leagueLevel) || club.leagueLevel < 1 || club.leagueLevel > 4) {
    badLeague.push(`${club.id}=${club.leagueLevel}`);
  }
}

assert(missing.length === 0, `modelo completo en los ${catalog.length} clubes${missing.length ? ` (faltan: ${missing.slice(0, 6).join(', ')})` : ''}`);
assert(badOvr.length === 0, `overall/ovr/baseline enteros y coherentes${badOvr.length ? ` (${badOvr.slice(0, 4).join(', ')})` : ''}`);
assert(badDivision.length === 0, `división interna coherente con el OVR${badDivision.length ? ` (${badDivision.slice(0, 4).join(', ')})` : ''}`);
assert(badReps.length === 0, `reputaciones 0-5 (int) con international <= continental${badReps.length ? ` (${badReps.slice(0, 4).join(', ')})` : ''}`);
assert(badColors.length === 0, `colores hex distintos (primary/secondary)${badColors.length ? ` (${badColors.slice(0, 4).join(', ')})` : ''}`);
assert(badCrest.length === 0, `crest procedural completo (type/shape/symbol/colores)${badCrest.length ? ` (${badCrest.slice(0, 4).join(', ')})` : ''}`);
assert(badLeague.length === 0, `leagueLevel entero 1-4${badLeague.length ? ` (${badLeague.slice(0, 4).join(', ')})` : ''}`);
assert(deepScan(catalog), 'catálogo sin NaN/Infinity');
assert(!catalog.some((club) => /malviajo/i.test(club.name)), 'ningún club del mundo ficticio sobrevive en el catálogo');

// ============================================================================
// B) API DEL MUNDO (misma firma que consumía el mundo Avergas)
// ============================================================================
console.log('\n== B) API del mundo ==');

const first = catalog[0];
assert(findClub(first.slug) === first, 'findClub(slug) devuelve el club canónico');
assert(findClubByKey(first.key) === first, 'findClubByKey(key) devuelve el club canónico');
assert(findClubByKey(first.slug) === first, 'findClubByKey acepta el slug como fallback');
assert(findClub('club-que-no-existe') === null, 'findClub con slug inexistente -> null');
assert(findClubByKey('9/nada') === null, 'findClubByKey con clave inexistente -> null');
assert(findClub(null) === null && findClub(42) === null, 'findClub tolera entradas no string');
assert(findClubByKey(undefined) === null, 'findClubByKey tolera entradas no string');
assert(findClub('real-malviajo') === null, 'el mundo ficticio ya no existe (real-malviajo)');
assert(clubKey(first) === `${first.division}/${first.slug}`, 'clubKey compone "division/slug"');
assert(clubKey(null) === null, 'clubKey tolera null');

const copy = allClubs();
assert(copy !== allClubs(), 'allClubs() devuelve un array nuevo en cada llamada');
copy.push({ id: 'intruso' });
assert(allClubs().length === catalog.length, 'mutar la copia no afecta al catálogo');

for (const nivel of [1, 2]) {
  const list = clubsByDivision(nivel);
  assert(list.length === (byDivision[nivel] || 0), `clubsByDivision(${nivel}) coincide con el conteo (${list.length})`);
  assert(list.every((club) => club.division === nivel), `clubsByDivision(${nivel}) solo trae clubes de esa división`);
  assert(list.every((club) => findClub(club.slug) === club), `clubsByDivision(${nivel}) entrega clubes canónicos`);
}
assert(clubsByDivision(9).length === 0, 'clubsByDivision con nivel inexistente -> []');
assert(clubsByDivision(NaN).length === 0, 'clubsByDivision tolera NaN');

assert(divisions.length === 2, 'dos divisiones internas (D1/D2, sin tercera)');
assert(divisions.every((item) => Number.isFinite(item.nivel) && item.name && item.short && item.ovrMin != null),
  'cada división interna tiene nivel, nombre, sigla y umbral de OVR');
assert(worldMeta.version === CAREER_WORLD_VERSION, 'worldMeta.version = CAREER_WORLD_VERSION');
assert(worldMeta.clubs === catalog.length, `worldMeta.clubs = ${catalog.length}`);
assert(worldMeta.countries === Object.keys(byCountry).length, `worldMeta.countries = ${Object.keys(byCountry).length}`);
assert(worldMeta.leagues === 13, `worldMeta.leagues = 13 (${worldMeta.leagues})`);

assert(catalog.every((club) => domesticReputation(club) === club.domesticReputation),
  'domesticReputation(club) = club.domesticReputation');
assert(domesticReputation(null) === 0, 'domesticReputation tolera null');
assert(catalog.every((club) => clubBaseline(club) === club.overall), 'clubBaseline(club) = OVR curado');
assert(clubBaseline(null) === 50, 'clubBaseline tolera null (fallback)');

// startingDivisionsForOvr: subconjunto ASCENDENTE de [1,2] en la jerarquía de
// DOS categorías; el engine SORTEA entre las elegibles con su RNG (no toma un
// elemento fijo).
const lowDivs = startingDivisionsForOvr(52);
const midDivs = startingDivisionsForOvr(70);
const highDivs = startingDivisionsForOvr(88);
assert(JSON.stringify(lowDivs) === '[2]', `OVR bajo (52) -> solo D2 (${JSON.stringify(lowDivs)})`);
assert(JSON.stringify(midDivs) === '[2]', `OVR medio (70) -> solo D2 (${JSON.stringify(midDivs)})`);
assert(JSON.stringify(highDivs) === '[1,2]', `OVR alto (88) -> D1/D2 (${JSON.stringify(highDivs)})`);
assert(JSON.stringify(startingDivisionsForOvr(NaN)) === '[]', 'startingDivisionsForOvr tolera NaN');
assert(catalog.every((club) => startingDivisionsForOvr(club.ovr).includes(club.division)),
  'la división de cada club es alcanzable por su propio OVR');

// ============================================================================
// C) ENGINE CON CLUBES REALES
// ============================================================================
console.log('\n== C) Engine con el catálogo real ==');

const ratedPlayers = players.filter((player) => Number.isFinite(player.rating));
assert(ratedPlayers.length >= 6, `jugadores de data.js con rating (${ratedPlayers.length})`);

// createCareer: SIN club por defecto (la carrera nueva nace sin club) +
// override explícito initialClubSlug que sigue derivando del catálogo.
for (const player of ratedPlayers) {
  const career = createCareer(player, { difficulty: 'normal' });
  assert(career.club === null, `${player.name}: nace SIN club (null) — sin auto-asignación`);
  assert(career.clubBaseline === clubBaseline(null),
    `${player.name}: baseline sin club = fallback del mundo (${career.clubBaseline})`);
  assert(career.domesticRep === domesticReputation(null), `${player.name}: reputación sin club = 0`);
  assert(deepScan(career), `${player.name}: carrera sin NaN/Infinity`);

  // El override sigue derivando del catálogo, pero se pide un club de una
  // división ELEGIBLE para el OVR del jugador (D1 exige el OVR mínimo).
  const eligibleDivision = startingDivisionsForOvr(career.ovr)[0];
  const eligiblePool = clubsByDivision(eligibleDivision);
  const eligibleClub = eligiblePool.find((club) => club.countryCode === 'AR') || eligiblePool[0];
  const forced = createCareer(player, { difficulty: 'normal', initialClubSlug: eligibleClub.slug });
  const world = findClub(forced.club.slug);
  assert(Boolean(world), `${player.name}: override initialClubSlug resuelve club del catálogo (${forced.club.name})`);
  assert(forced.club.division === world.division, `${player.name}: división del club = catálogo`);
  assert(forced.clubBaseline === world.overall && forced.clubBaseline === clubBaseline(forced.club),
    `${player.name}: baseline del motor = OVR curado (${world.overall})`);
  assert(forced.domesticRep === world.domesticReputation, `${player.name}: reputación doméstica = catálogo`);
  assert(startingDivisionsForOvr(forced.ovr).includes(forced.club.division),
    `${player.name}: override en una división elegible (D${forced.club.division})`);
}

//.generateYouthOffers: debut con clubes reales y divisiones elegibles.
for (const name of ['Nahue', 'Mati', 'JJ', 'Gonzi', 'Tigre']) {
  const player = players.find((item) => item.name === name);
  const career = createCareer(player, { difficulty: 'normal' });
  const allowed = startingDivisionsForOvr(career.ovr);
  const seen = new Set();
  const cheapestByPlayer = {};
  cheapestByPlayer[name] = Infinity;
  let offersChecked = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    for (const offer of generateYouthOffers(career, { seed })) {
      seen.add(offer.division);
      offersChecked += 1;
      const world = findClub(offer.club.slug);
      assert(Boolean(world), `${name}: club de cantera en el catálogo (${offer.club.name})`);
      assert(world.countryCode === 'AR', `${name}: la oferta es de un club ARGENTINO (${world.countryCode})`);
      assert(world.division !== 3,
        `${name}: sin tercera categoria (D${world.division}, ovr ${world.ovr})`);
      assert(world.division === offer.division, `${name}: división de la oferta = catálogo`);
      assert(offer.clubOvr === world.overall && offer.clubBaseline === world.baseline,
        `${name}: OVR/baseline de la oferta = catálogo`);
      assert(offer.clubReputation === world.domesticReputation, `${name}: reputación de la oferta = catálogo`);
      assert(deepScan(offer), `${name}: oferta de cantera sin NaN/Infinity`);
      cheapestByPlayer[name] = Math.min(cheapestByPlayer[name], world.baseline);
    }
  }
  assert(offersChecked === 36, `${name}: SIEMPRE 3 ofertas por tanda (${offersChecked} en 12 seeds × 3)`);
  assert([...seen].every((nivel) => allowed.includes(nivel)),
    `${name}: divisiones de cantera dentro de las elegibles (D${[...seen].sort().join(', D')})`);
  // Debut _modesto_: dentro de la división elegida el pool se ordena por
  // baseline ascendente, así que cada tanda incluye un club chico.
  assert(cheapestByPlayer[name] <= 62,
    `${name}: el debut ofrece clubes modestos dentro de su división (baseline ${cheapestByPlayer[name]})`);
  assert(![...seen].includes(3),
    `${name}: ninguna oferta de debut sale de una tercera categoría (D${[...seen].sort().join(', D')})`);
}

// generateTransferOffers: mercado de pases con clubes reales.
const starter = players.find((player) => player.name === 'Gonzi');
const startState = startCareer(starter, { difficulty: 'intensa', seed: 7 });
const flowState = chooseYouthClub(startState, startState.youthOffers[0]);
assert(flowState.lastAction.ok === true, 'debut: la oferta de cantera se acepta');
const careerA = flowState.career;
assert(Boolean(findClub(careerA.club.slug)), `debut firmado en un club real (${careerA.club.name}, D${careerA.club.division})`);
assert(Boolean(careerA.club.country) && Boolean(careerA.club.countryFlag), 'el club del debut trae país y bandera');

const marketOffers = generateTransferOffers(careerA, { seed: 21 });
assert(marketOffers.length > 0, `generateTransferOffers devuelve ofertas (${marketOffers.length})`);
for (const offer of marketOffers) {
  const world = findClub(offer.club.slug);
  assert(Boolean(world), `mercado: ${offer.club.name} existe en el catálogo`);
  assert(world.division === offer.division, `mercado: división coherente (${offer.club.name})`);
  assert(offer.clubOvr === world.overall, `mercado: OVR del club = catálogo (${offer.club.name})`);
  assert(offer.clubReputation === world.domesticReputation, `mercado: reputación = catálogo (${offer.club.name})`);
  assert(offer.club.key === world.key, `mercado: key del catálogo (${offer.club.name})`);
  assert(offer.club.slug !== careerA.club.slug, `mercado: la oferta no es el club actual (${offer.club.name})`);
  assert(Number.isFinite(offer.estimatedValue) && offer.estimatedValue > 0,
    `mercado: valor estimado > 0 (${offer.club.name})`);
  assert(deepScan(offer), `mercado: oferta sin NaN/Infinity (${offer.club.name})`);
}

// Nunca generar un tercer destino; los únicos niveles jugables son 1 y 2.
assert(!Object.hasOwn(byDivision, 3), 'no existe D3 en el catálogo');
// === Segunda → Primera: mercado temprano (sin bloqueo por temporadas/seeds) ===
{
  const firstSeed = (candidate, base) => {
    for (let i = 0; i < 20; i += 1) {
      const seed = i + 1;
      if (candidate(seed)) return seed;
    }
    return null;
  };
  const secondToFirst = (player) => {
    const base = createCareer(player, { difficulty: 'normal' });
    const p = [...players].sort((a, b) => clubsByDivision(2)
      .filter((c) => c.countryCode === 'AR')
      .sort((a, b) => a.baseline - b.baseline)[0].baseline - a.rating);
    return p[0];
  };
  const secondDivisionCareer = (player, ovr) => {
    const c = createCareer(player, { difficulty: 'normal' });
    const pool = clubsByDivision(2).filter((club) => club.countryCode === 'AR');
    const d2 = pool[0] || clubsByDivision(2)[0];
    return {
      ...c,
      ovr: ovr ?? c.ovr,
      overallPeak: Math.max(c.overallPeak || 0, ovr ?? c.ovr),
      club: { ...d2 },
      domesticRep: d2.domesticReputation,
      clubBaseline: d2.baseline,
      overallVsBaseline: (ovr ?? c.ovr) - d2.baseline,
      role: 'starter',
    };
  };
  // Serie de seeds para el escenario: Segunda, OVR razonable, buen rendimiento.
  // OVR 76 = caso intermedio real: Primera es posible desde la ventana 1 pero
  // NO sale en todas (hay ventanas con y sin Primera según el RNG).
  const goodSeeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const strong = secondDivisionCareer(players.find((p) => p.name === 'Gonzi'), 76);
  const firstSeedWithD1 = goodSeeds.find((seed) =>
    generateTransferOffers(strong, { seed }).some((offer) => offer.division === 1));
  assert(firstSeedWithD1 != null, 'Segunda + buen rendimiento: Primera elegible en la primera ventana');
  const firstWithoutD1 = goodSeeds.find((seed) =>
    !generateTransferOffers(strong, { seed }).some((offer) => offer.division === 1));
  assert(firstWithoutD1 != null, 'Segunda + buen rendimiento: existe una primera ventana sin Primera');
  const secondWithoutD1 = goodSeeds.find((seed) =>
    !generateTransferOffers(strong, { seed }).some((offer) => offer.division === 1));
  const laterWithD1 = goodSeeds.find((seed) => seed > (secondWithoutD1 || 0) &&
    generateTransferOffers(strong, { seed }).some((offer) => offer.division === 1));
  assert(secondWithoutD1 != null && laterWithD1 != null,
    'Segunda: Primera no queda bloqueada al no aparecer en una ventana');
  const poor = secondDivisionCareer(players.find((p) => p.name === 'Gonzi'), 70);
  assert(goodSeeds.every((seed) =>
    generateTransferOffers(poor, { seed }).every((offer) => offer.division === 2)),
    'Segunda + rendimiento bajo: no se habilita Primera');
  const top = secondDivisionCareer(players.find((p) => p.name === 'Gonzi'), 87);
  const atTop = { ...top, club: { ...clubsByDivision(1)[0] } };
  atTop.domesticRep = atTop.club.domesticReputation;
  atTop.clubBaseline = atTop.club.baseline;
  assert(goodSeeds.some((seed) =>
    generateTransferOffers(atTop, { seed }).some((offer) => offer.division === 1)),
    'Primera → Primera: conserva ofertas de Primera');
}

// La progresión entre las dos categorías no depende de una tercera base.
// careerA arranca en D1 (Gonzi debuta en Vélez): usar una carrera D2 real para
// comprobar que Segunda sigue disponible como destino desde Segunda.
const d2probeBase = createCareer(players.find((p) => p.name === 'Gonzi'), { difficulty: 'normal' });
const d2probePool = clubsByDivision(2).filter((club) => club.countryCode === 'AR');
const d2probeClub = d2probePool[0] || clubsByDivision(2)[0];
const d2probe = {
  ...d2probeBase,
  ovr: 76,
  overallPeak: Math.max(d2probeBase.overallPeak || 0, 76),
  club: { ...d2probeClub },
  domesticRep: d2probeClub.domesticReputation,
  clubBaseline: d2probeClub.baseline,
  overallVsBaseline: 76 - d2probeClub.baseline,
  role: 'starter',
};
const eligibleD2Seeds = [];
for (let seed = 1; seed <= 40; seed += 1) {
  if (generateTransferOffers(d2probe, { seed }).some((offer) => offer.division === 2)) eligibleD2Seeds.push(seed);
}
assert(eligibleD2Seeds.length > 0, 'desde Segunda, Segunda continúa disponible como destino');
assert(generateTransferOffers(careerA, { seed: 3 }).every((offer) => [1, 2].includes(offer.division)),
  'las ofertas siempre caen en Primera o Segunda');

// acceptTransfer: el traspaso usa el club canónico del catálogo.
const accepted = acceptTransfer(careerA, marketOffers[0]);
assert(accepted !== careerA && accepted.club.slug === marketOffers[0].club.slug,
  `acceptTransfer mueve a ${marketOffers[0].club.name}`);
assert(accepted.club.division === marketOffers[0].division, 'acceptTransfer respeta la división declarada');
assert(Boolean(accepted.club.country) && Boolean(accepted.club.crest),
  'el club nuevo conserva país, escudo procedural y liga del catálogo');
assert(accepted.clubBaseline === findClub(accepted.club.slug).overall, 'baseline recalculado con el club nuevo');
assert(accepted.domesticRep === findClub(accepted.club.slug).domesticReputation,
  'reputación recalculada con el club nuevo');
assert(accepted.clubHistory.length === careerA.clubHistory.length + 1
  && accepted.clubHistory[accepted.clubHistory.length - 1].club.slug === accepted.club.slug,
  'clubHistory acumula la etapa del traspaso');
assert(deepScan(accepted), 'carrera post-traspaso sin NaN/Infinity');

// simulateSegment: varias temporadas sobre el club real.
const segment = simulateSegment(accepted, 3, { seed: 99 });
assert(segment.career !== accepted, 'simulateSegment devuelve una carrera nueva');
assert(segment.seasonsSimulated >= 1, `simulateSegment simula temporadas (${segment.seasonsSimulated})`);
assert(segment.career.seasonHistory.length >= accepted.seasonHistory.length + segment.seasonsSimulated,
  'seasonHistory crece con las temporadas simuladas');
assert(Boolean(findClub(segment.career.club.slug)), 'el club sigue existiendo en el catálogo tras simular');
assert(segment.career.club.slug === accepted.club.slug, 'simular no cambia de club por sí solo');
assert(deepScan(segment.career), 'carrera simulada sin NaN/Infinity');

// ============================================================================
// D) PERSISTENCIA Y VERSIONADO
// ============================================================================
console.log('\n== D) Persistencia y versionado ==');

assert(Number.isInteger(CAREER_WORLD_VERSION) && CAREER_WORLD_VERSION >= 2,
  `CAREER_WORLD_VERSION actualizado por el reemplazo del mundo (${CAREER_WORLD_VERSION})`);

const serialized = serializeCareerState(flowState);
assert(serialized.ok === true, `el flow state del mundo real se serializa (${serialized.reason || 'ok'})`);

// El envelope (schema + mundo) lo arma saveCareerState: acá se replica para
// validar la relectura y el rechazo de saves del mundo anterior.
const envelopeOf = (worldVersion) => JSON.stringify({
  schemaVersion: CAREER_SAVE_SCHEMA_VERSION,
  worldVersion,
  savedAt: Date.now(),
  state: JSON.parse(serialized.json),
});

const roundTrip = deserializeCareerState(envelopeOf(CAREER_WORLD_VERSION));
assert(roundTrip.ok === true, `el save actual se relee (${roundTrip.reason || 'ok'})`);
assert(roundTrip.ok && Boolean(findClub(roundTrip.state.career.club.slug)),
  'el club del save restaurado existe en el catálogo');
assert(roundTrip.ok && roundTrip.state.career.club.key === findClub(roundTrip.state.career.club.slug).key,
  'el club restaurado conserva su clave del catálogo');

// Save del mundo Avergas (worldVersion anterior): se rechaza, no se migra.
const rejected = deserializeCareerState(envelopeOf(1));
assert(rejected.ok === false && rejected.reason === 'world_version',
  `una carrera del mundo Avergas se rechaza (${rejected.reason})`);

// Save de otro schema: tampoco se adivina.
const otherSchema = JSON.parse(envelopeOf(CAREER_WORLD_VERSION));
otherSchema.schemaVersion = CAREER_SAVE_SCHEMA_VERSION + 1;
const badSchema = deserializeCareerState(JSON.stringify(otherSchema));
assert(badSchema.ok === false && badSchema.reason === 'schema_version',
  `un save de otro schema se rechaza (${badSchema.reason})`);

// Guardas del engine que dependen del mundo siguen respondiendo.
assert(generateTransferOffers({ ...careerA, retired: true }, { seed: 1 }).length === 0,
  'una carrera retirada no recibe ofertas de mercado');
assert(generateYouthOffers({ ...careerA, retired: true }, { seed: 1 }).length === 0,
  'una carrera retirada no recibe ofertas de cantera');
assert(players.every((player) => typeof player.name === 'string' && player.name.length > 0),
  'data.js sigue intacto (jugadores del grupo)');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
