// Smoke tests del catálogo + helpers de eventos de carrera (Paso 1).
// Uso: node scripts/smoke-career-events.mjs
import { players } from '../src/data.js';
import { createCareer, createSeededRng, simulateSeason } from '../src/features/career/engine.js';
import {
  CAREER_EVENTS,
  EVENT_LIMITS,
  PILL_TONES,
  RIVAL_SCOPES,
  eventEligible,
  eligibleCareerEvents,
  rollCareerEvent,
  applyEventChoice,
} from '../src/features/career/events.js';
import { allClubs, findClub, clubsByDivision, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { initialOvr } from '../src/features/career/config.js';

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

const realSlugs = new Set(allClubs().map((c) => c.slug));

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
const VALID_ROLES = new Set(['starter', 'high_rotation', 'low_rotation', 'substitute', 'third_keeper']);
const VALID_POSITIONS = new Set(['ARQ', 'DEF', 'MED', 'DEL']);

// -----------------------------------------------------------------------------
console.log(`\n== Catálogo: ${CAREER_EVENTS.length} eventos ==`);

// 1) Schema válido por evento.
const ids = new Set();
for (const event of CAREER_EVENTS) {
  const tag = event.id;
  assert(typeof event.id === 'string' && event.id.length > 0, `${tag}: id estable`);
  assert(!ids.has(event.id), `${tag}: id único`);
  ids.add(event.id);
  assert(Number.isFinite(event.weight) && event.weight >= EVENT_LIMITS.weight[0] && event.weight <= EVENT_LIMITS.weight[1],
    `${tag}: peso positivo en rango (${event.weight})`);
  assert(typeof event.title === 'string' && event.title.length > 0, `${tag}: título`);
  assert(typeof event.intro === 'string' && event.intro.length > 0, `${tag}: intro`);
  assert(Array.isArray(event.choices) && event.choices.length >= 2, `${tag}: al menos 2 decisiones`);
  if (event.category) assert(typeof event.category === 'string', `${tag}: categoría string`);
  if (event.rivalScope) assert(RIVAL_SCOPES.includes(event.rivalScope), `${tag}: rivalScope válido`);
  if (event.minAge != null) {
    assert(Number.isFinite(event.minAge) && event.minAge >= EVENT_LIMITS.minAge[0] && event.minAge <= EVENT_LIMITS.minAge[1],
      `${tag}: minAge válido (${event.minAge})`);
  }
  if (event.maxAge != null) {
    assert(Number.isFinite(event.maxAge) && event.maxAge >= EVENT_LIMITS.minAge[0] && event.maxAge <= EVENT_LIMITS.minAge[1],
      `${tag}: maxAge válido`);
  }
  if (event.requiresRole) {
    assert(event.requiresRole.every((r) => VALID_ROLES.has(r)), `${tag}: roles válidos`);
  }
  if (event.requiresPosition) {
    assert(event.requiresPosition.every((p) => VALID_POSITIONS.has(p)), `${tag}: posiciones válidas`);
  }

  const choiceIds = new Set();
  for (const choice of event.choices) {
    const ctag = `${tag}/${choice.id}`;
    assert(typeof choice.id === 'string' && !choiceIds.has(choice.id), `${ctag}: id de decisión único`);
    choiceIds.add(choice.id);
    assert(typeof choice.label === 'string' && choice.label.length > 0, `${ctag}: label`);
    if (choice.ovrDelta != null) {
      const [lo, hi] = choice.ovrDelta;
      assert(Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi, `${ctag}: ovrDelta rango coherente`);
      assert(lo >= EVENT_LIMITS.ovrDelta[0] && hi <= EVENT_LIMITS.ovrDelta[1],
        `${ctag}: ovrDelta dentro de EVENT_LIMITS (${lo}..${hi})`);
    }
    if (choice.valueDelta != null) {
      assert(Number.isFinite(choice.valueDelta)
        && choice.valueDelta >= EVENT_LIMITS.valueDelta[0]
        && choice.valueDelta <= EVENT_LIMITS.valueDelta[1],
        `${ctag}: valueDelta dentro de límites (${choice.valueDelta})`);
    }
    if (choice.isTransfer) assert(typeof choice.transferReason === 'string', `${ctag}: transferReason presente`);
    if (choice.pills) {
      assert(choice.pills.length <= EVENT_LIMITS.maxPillsPerChoice, `${ctag}: pills acotadas`);
      assert(choice.pills.every((p) => PILL_TONES.includes(p.tone)), `${ctag}: pills con tone válido`);
    }
  }
}

// 2) Cubrimiento: hay eventos con y sin rival, con y sin ARQ.
const transferEvents = CAREER_EVENTS.filter((e) => e.choices.some((c) => c.isTransfer));
assert(transferEvents.length >= 3, `eventos de traspaso presentes (${transferEvents.length})`);
assert(CAREER_EVENTS.some((e) => e.excludeGK), 'hay eventos excludeGK');
assert(CAREER_EVENTS.some((e) => e.requiresGK), 'hay eventos solo-ARQ');
assert(CAREER_EVENTS.some((e) => e.requiresRivalClub), 'hay eventos con rival requerido');

// -----------------------------------------------------------------------------
console.log('\n== Eligibilidad y filtrado ==');

// Carreras reales en distintas edades/roles para probar el filtrado.
const careersByAge = {};
for (const age of [16, 21, 26, 31, 36, 39]) {
  const player = players.find((p) => p.name === 'Gonzi');
  let c = careerWithClub(player, { difficulty: 'intensa' });
  while (c.age < age && !c.retired) c = simulateSeason(c, { seed: age * 7 + c.age });
  careersByAge[age] = c;
}

// minAge: ningún evento con minAge > edad pasa el filtro.
for (const [ageStr, c] of Object.entries(careersByAge)) {
  const age = Number(ageStr);
  const eligible = eligibleCareerEvents(c);
  assert(eligible.length > 0, `edad ${age}: hay eventos elegibles (${eligible.length})`);
  assert(eligible.every((e) => e.minAge == null || e.minAge <= age), `edad ${age}: minAge respetado`);
}

// excludeGK: los arqueros nunca reciben esos eventos.
const gkCareer = careersByAge[21];
const gkEligible = eligibleCareerEvents({ ...gkCareer, position: 'ARQ' });
assert(gkEligible.every((e) => !e.excludeGK), 'ARQ: eventos excludeGK filtrados');
assert(gkEligible.some((e) => e.requiresGK), 'ARQ: recibe eventos solo-ARQ');
// Y un jugador de campo nunca recibe los de ARQ.
const fieldEligible = eligibleCareerEvents({ ...gkCareer, position: 'DEL' });
assert(fieldEligible.every((e) => !e.requiresGK), 'DEL: sin eventos solo-ARQ');

// Carrera retirada: nada elegible.
assert(eligibleCareerEvents({ ...gkCareer, retired: true }).length === 0, 'retirado: sin eventos');

console.log('\n== rollCareerEvent: determinismo y pureza ==');

for (const c of [careersByAge[16], careersByAge[21], careersByAge[31], careersByAge[39]]) {
  const label = `${c.name} @${c.age}`;
  const snapshot = JSON.stringify(c);
  const rollA = rollCareerEvent(c, { seed: 1234 });
  const rollB = rollCareerEvent(c, { seed: 1234 });
  assert(JSON.stringify(rollA) === JSON.stringify(rollB), `${label}: determinista con seed`);
  assert(JSON.stringify(c) === snapshot, `${label}: career no mutada por roll`);
  assert(rollA && rollA.event && Array.isArray(rollA.event.choices) && rollA.event.choices.length >= 2,
    `${label}: evento rodado con decisiones`);
  assert(rollA.weightTotal > 0, `${label}: weightTotal positivo`);
  assert(!rollA.event.intro.includes('{'), `${label}: textos interpolados sin placeholders`);
  assert(deepScan(rollA), `${label}: sin NaN/Infinity en el rolado`);
  if (rollA.event.requiresRivalClub) {
    assert(rollA.context.rival && realSlugs.has(rollA.context.rival.slug),
      `${label}: rival resuelto y válido (${rollA.context.rival?.name})`);
    assert(rollA.context.rival.slug !== c.club.slug, `${label}: rival distinto al club actual`);
  }
  // RNG inyectado explícito también funciona.
  const rollRng = rollCareerEvent(c, { rng: createSeededRng(1234) });
  assert(JSON.stringify(rollRng) === JSON.stringify(rollA), `${label}: rng inyectado == seed`);
}

console.log('\n== applyEventChoice: pureza, rangos y traspasos ==');

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const c of [careersByAge[16], careersByAge[21], careersByAge[31]]) {
  const label = `${c.name} @${c.age}`;
  const snapshot = JSON.stringify(c);
  const roll = rollCareerEvent(c, { seed: 555 });
  assert(roll, `${label}: evento rodado para aplicar`);

  for (const choice of roll.event.choices) {
    const result = applyEventChoice(c, roll.event, choice, { seed: 777, context: roll.context });
    const { career: next, outcome } = result;
    const ctag = `${label}/${choice.id}`;

    assert(deepEqual(c, JSON.parse(snapshot)), `${ctag}: carrera original intacta`);
    assert(!deepEqual(next, c) || (outcome.ovrDelta === 0 && !outcome.valueDelta && !outcome.transfer),
      `${ctag}: carrera nueva refleja la decisión`);
    assert(outcome.applied === true && outcome.choiceId === choice.id, `${ctag}: outcome aplicado`);
    assert(deepScan(next) && deepScan(outcome), `${ctag}: sin NaN/Infinity`);

    // Rangos de OVR: el delta aplicado está dentro del rango declarado y los límites.
    const [lo, hi] = choice.ovrDelta || [0, 0];
    assert(outcome.ovrDelta >= lo && outcome.ovrDelta <= hi, `${ctag}: ovrDelta ${outcome.ovrDelta} en [${lo}, ${hi}]`);
    assert(next.ovr >= 35 && next.ovr <= 95, `${ctag}: OVR dentro de límites absolutos (${next.ovr})`);

    // Valor: fracción aplicada respetada y piso absoluto.
    const vd = choice.valueDelta || 0;
    assert(outcome.valueDelta === vd, `${ctag}: valueDelta registrado (${vd})`);
    assert(Number.isFinite(next.marketValue) && next.marketValue >= 30000, `${ctag}: valor >= MARKET_VALUE.MIN`);
    if (vd > 0) {
      assert(next.marketValue >= c.marketValue, `${ctag}: valor sube con valueDelta positivo`);
    }
    if (vd < 0) {
      assert(next.marketValue <= c.marketValue, `${ctag}: valor baja con valueDelta negativo`);
    }

    // Traspasos: metadata válida, club no ejecutado.
    if (choice.isTransfer) {
      assert(outcome.transfer && outcome.transfer.via === 'career_event', `${ctag}: transfer metadata`);
      assert(next.pendingTransfer && next.pendingTransfer.choiceId === choice.id, `${ctag}: pendingTransfer seteado`);
      if (roll.event.requiresRivalClub) {
        assert(outcome.transfer.targetClub && realSlugs.has(outcome.transfer.targetClub.slug),
          `${ctag}: targetClub resuelto (${outcome.transfer.targetClub?.name})`);
      }
      assert(deepEqual(next.club, c.club), `${ctag}: club actual NO cambiado (engine lo hará)`);
      continue;
    }
    assert(outcome.transfer === null && !next.pendingTransfer, `${ctag}: sin transfer si no corresponde`);
  }
}

console.log('\n== Guardas y casos borde ==');

const base = careersByAge[21];
const roll = rollCareerEvent(base, { seed: 42 });

// Decisión inválida: carrera sin cambios, aplicado false.
const bad = applyEventChoice(base, roll.event, { id: 'no_existe' }, { seed: 1 });
assert(bad.outcome.applied === false && bad.outcome.reason === 'invalid_choice', 'decisión inválida rechazada');
assert(deepEqual(bad.career, base), 'decisión inválida: carrera sin cambios');

// Carrera nula/retirada: nunca lanza.
const nullCase = applyEventChoice(null, roll.event, roll.event.choices[0], {});
assert(nullCase.outcome.applied === false && nullCase.outcome.reason === 'invalid_career', 'career null rechazada');
const retiredCase = applyEventChoice({ ...base, retired: true }, roll.event, roll.event.choices[0], {});
assert(retiredCase.outcome.applied === false && retiredCase.outcome.reason === 'retired', 'career retirada rechazada');

// Evento null: rechazo limpio.
const noEvent = applyEventChoice(base, null, { id: 'x' }, {});
assert(noEvent.outcome.applied === false && noEvent.outcome.reason === 'invalid_choice', 'evento null rechazado');

// Determinismo de applyEventChoice con seed (misma entrada → mismo resultado).
const again = applyEventChoice(base, roll.event, roll.event.choices[0], { seed: 777, context: roll.context });
const twice = applyEventChoice(base, roll.event, roll.event.choices[0], { seed: 777, context: roll.context });
assert(deepEqual(again.career, twice.career) && again.outcome.ovrDelta === twice.outcome.ovrDelta,
  'applyEventChoice determinista con seed');

// Fallo silencioso de roll: career inválida → null.
assert(rollCareerEvent(null, {}) === null, 'roll con career null → null');
assert(rollCareerEvent({ ...base, retired: true }, {}) === null, 'roll con career retirada → null');

console.log('\n== Recorrido largo: 200 checkpoints con seed fija ==');
{
  const player = players.find((p) => p.name === 'Rui');
  let c = careerWithClub(player, { difficulty: 'intensa' });
  let applied = 0;
  let transfers = 0;
  let rolled = 0;
  for (let i = 0; i < 200 && !c.retired && c.age < 40; i += 1) {
    const r = rollCareerEvent(c, { seed: i * 13 + 1 });
    if (!r) break;
    rolled += 1;
    const pick = r.event.choices[i % r.event.choices.length];
    const res = applyEventChoice(c, r.event, pick, { seed: i * 13 + 2, context: r.context });
    if (res.outcome.applied) {
      applied += 1;
      if (res.outcome.transfer) transfers += 1;
    }
    c = res.career;
    assert(deepScan(c), `iteración ${i}: sin NaN/Infinity`);
    if (c.ovr < 35 || c.ovr > 95) { assert(false, `iteración ${i}: OVR fuera de rango (${c.ovr})`); break; }
  }
  assert(rolled > 50, `recorrido: checkpoints rodados (${rolled})`);
  assert(applied > 50, `recorrido: decisiones aplicadas (${applied})`);
  assert(transfers > 0, `recorrido: al menos un traspaso metadata (${transfers})`);
  assert(Number.isFinite(c.marketValue) && c.marketValue >= 30000, `recorrido: valor final válido (${c.marketValue})`);
  console.log(`   -> rolled=${rolled} applied=${applied} transfers=${transfers} ovr=${c.ovr} edad=${c.age} valor=${c.marketValue}`);
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);

