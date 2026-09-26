// ============================================================================
// Smoke/integration test NO-React — cadena conceptual del career mode (Paso 7)
// Uso: node scripts/smoke-career-integration.mjs
//
// Verifica el flujo conceptual completo con el flow real (no duplica los
// smoke tests existentes: es un recorrido lineal de integración):
//
//   player
//     ↓
//   startCareer
//     ↓
//   chooseYouthClub (debut)
//     ↓
//   advanceSeason (temporadas + eventos)
//     ↓
//   getCareerDecisionOptions
//     ↓
//   stay / transfer / retire
//
// Determinista: seeds fijos en cada paso (rng → createSeededRng del engine).
// NO corre npm build ni instala dependencias.
// ============================================================================
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flowPath = path.join(root, 'src', 'features', 'career', 'flow.js');

const flow = await import(pathToFileURL(flowPath).href);

/**
 * Avanza temporadas (y resuelve los eventos con la PRIMERA elección, como el
 * lab) hasta llegar a un checkpoint de decisión. Determinista por seeds.
 * Devuelve { state, seasons } con el estado parado en phase 'decision'.
 */
function runUntilDecision(startState, seedBase = 0, maxSeasons = 40) {
  let state = startState;
  let seasons = 0;
  while (state && state.phase !== flow.FLOW_PHASES.DECISION && seasons < maxSeasons) {
    state = flow.advanceSeason(state, { seed: 10_000 + seedBase * 100 + seasons });
    seasons += 1;
    if (state && state.phase === flow.FLOW_PHASES.EVENT && state.currentEvent
      && Array.isArray(state.currentEvent.event.choices) && state.currentEvent.event.choices.length > 0) {
      state = flow.chooseCareerAction(state, 'choose_event_choice',
        state.currentEvent.event.choices[0].id, { seed: 20_000 + seedBase * 100 + seasons });
    }
    if (state && state.phase === flow.FLOW_PHASES.RETIRED) break;
  }
  return { state, seasons };
}

const allStates = [];
const track = (label, state) => allStates.push({ label, state });

// ============================================================================
// 1) player → startCareer
// ============================================================================
console.log('== 1) player → startCareer ==');
const gonzi = players.find((p) => p.name === 'Gonzi');
const playerJson = JSON.stringify(gonzi);
let state = flow.startCareer(gonzi, { seed: 11, difficulty: 'intensa' });
track('start', state);
assert(state && state.phase === flow.FLOW_PHASES.DEBUT, 'startCareer: phase "debut"');
assert(state.career && state.career.name === 'Gonzi', 'startCareer: career creada para Gonzi');
assert(Array.isArray(state.youthOffers) && state.youthOffers.length > 0, 'startCareer: hay ofertas de debut');
assert(state.lastAction && state.lastAction.ok !== false, 'startCareer: lastAction sin rechazo');

// ============================================================================
// 2) chooseYouthClub (debut)
// ============================================================================
console.log('\n== 2) chooseYouthClub ==');
const youthOffer = state.youthOffers[0];
state = flow.chooseYouthClub(state, youthOffer);
track('youth', state);
assert(state.phase === flow.FLOW_PHASES.SEASON && state.lastAction.ok === true, 'chooseYouthClub: phase "season" (ok)');
assert(state.career.club.slug === youthOffer.club.slug, `chooseYouthClub: club = ${youthOffer.club.name}`);

// ============================================================================
// 3) advanceSeason → getCareerDecisionOptions
// ============================================================================
console.log('\n== 3) advanceSeason → getCareerDecisionOptions ==');
const firstRun = runUntilDecision(state, 1);
state = firstRun.state;
track('decision1', state);
assert(state.phase === flow.FLOW_PHASES.DECISION, `se llega al checkpoint de decisión (${firstRun.seasons} temporada(s))`);
assert(state.seasonReport && state.career.lastSeasonReport, 'advanceSeason: reporte de temporada presente');
assert(Array.isArray(state.youthOffers) === false || state.youthOffers === null, 'decision: ofertas de debut cerradas');
assert(JSON.stringify(flow.getCareerDecisionOptions(state)) === JSON.stringify(['stay', 'transfer', 'retire']),
  'getCareerDecisionOptions: ["stay", "transfer", "retire"]');

// ============================================================================
// 4a) STAY
// ============================================================================
console.log('\n== 4a) stay ==');
const clubBeforeStay = state.career.club.slug;
state = flow.chooseCareerAction(state, 'stay', null, { seed: 31 });
track('stay', state);
assert(state.phase === flow.FLOW_PHASES.SEASON && state.lastAction.ok === true, "chooseCareerAction('stay'): phase 'season' (ok)");
assert(state.career.club.slug === clubBeforeStay, 'stay: el club no cambia');
assert(Number.isFinite(state.lastAction.loyaltyOvrBonus), 'stay: bonus de lealtad numérico');

// ============================================================================
// 4b) TRANSFER (abrir mercado → aceptar una oferta)
// ============================================================================
console.log('\n== 4b) transfer ==');
const secondRun = runUntilDecision(state, 2);
state = secondRun.state;
track('decision2', state);
assert(state.phase === flow.FLOW_PHASES.DECISION, `segunda decisión alcanzada (${secondRun.seasons} temporada(s))`);

// Abrir el mercado: puede no haber ofertas (rechazo 'no_offers' limpio); se
// reintenta en la próxima decisión con otra tira de seeds, acotado.
let attempts = 0;
const maxAttempts = 6;
while (attempts < maxAttempts) {
  attempts += 1;
  state = flow.chooseCareerAction(state, 'transfer', null, { seed: 40_000 + attempts });
  if (state.phase === flow.FLOW_PHASES.TRANSFER) break;
  track(`transfer_no_offers_${attempts}`, state);
  assert(state.lastAction.ok === false && state.lastAction.reason === 'no_offers', 'sin ofertas: rechazo limpio (no lanza)');
  const next = runUntilDecision(state, 2 + attempts);
  state = next.state;
  if (state.phase !== flow.FLOW_PHASES.DECISION) break;
}
track('transfer_open', state);
if (state.phase === flow.FLOW_PHASES.TRANSFER) {
  assert(Array.isArray(state.transferOffers) && state.transferOffers.length > 0, 'transfer: mercado abierto con ofertas');
  const clubBeforeTransfer = state.career.club.slug;
  const marketOffer = state.transferOffers[0];
  state = flow.chooseCareerAction(state, 'transfer', marketOffer, { seed: 51 });
  track('transfer_accept', state);
  assert(state.phase === flow.FLOW_PHASES.SEASON && state.lastAction.ok === true, 'transfer: oferta aceptada → phase "season"');
  assert(state.career.club.slug !== clubBeforeTransfer, `transfer: club cambió a ${state.career.club.name}`);
} else {
  console.error('  ✗ FAIL: el mercado nunca abrió ofertas en las decisiones provadas');
  failures += 1;
}

// ============================================================================
// 4c) RETIRE
// ============================================================================
console.log('\n== 4c) retire ==');
const thirdRun = runUntilDecision(state, 3);
state = thirdRun.state;
track('decision3', state);
assert(state.phase === flow.FLOW_PHASES.DECISION, `tercera decisión alcanzada (${thirdRun.seasons} temporada(s))`);
state = flow.chooseCareerAction(state, 'retire', null, {});
track('retire', state);
assert(state.phase === flow.FLOW_PHASES.RETIRED && state.lastAction.ok === true, "chooseCareerAction('retire'): phase 'retired' (ok)");
assert(state.career.retired === true, 'retire: career.retired === true (retireCareer del engine)');
assert(state.stoppedReason === 'retirement', "retire: stoppedReason 'retirement'");
assert(JSON.stringify(flow.getCareerDecisionOptions(state)) === JSON.stringify([]),
  'getCareerDecisionOptions en retirado: [] (sin acciones)');

// ============================================================================
// Pureza + saneamiento de toda la cadena
// ============================================================================
console.log('\n== Pureza y saneamiento ==');
assert(JSON.stringify(gonzi) === playerJson, 'player original de data.js sin mutar');
{
  let allFinite = true;
  for (const item of allStates) allFinite = deepScan(item.state) && allFinite;
  assert(allFinite, `sin NaN/Infinity en ${allStates.length} estados de la cadena`);
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-career-integration: TODO OK'
  : `\n❌ smoke-career-integration: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;

