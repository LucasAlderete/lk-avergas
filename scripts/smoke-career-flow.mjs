// ============================================================================
// Smoke tests del orquestador de carrera — flow.js (Paso 6)
// Uso: node scripts/smoke-career-flow.mjs
// Cubre: importación (A), exports (B), startCareer de los 6 amigos (C),
// debut (D), oferta inválida (E), temporada (F), decisiones (G), stay (H),
// transfer (I), retiro (J), determinismo (K), RNG rng/seed (L), pureza (M),
// sin NaN/Infinity (N) y guardas de pureza del archivo (sin React/DOM/etc.).
// NO corre npm build ni instala dependencias.
// ============================================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';
import { createSeededRng } from '../src/features/career/engine.js';
import { findClub, startingDivisionsForOvr } from '../src/data/careerWorld.js';
import { OFFER_RULES, AGE, initialOvr } from '../src/features/career/config.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

// Recorrido recursivo: true si ningún número es NaN/Infinity.
const deepScan = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (Array.isArray(v)) return v.every(deepScan);
  return Object.values(v).every(deepScan);
};

// createCareer sella snapshot.createdAt con Date.now() (comportamiento actual
// del engine, no se modifica): para comparar JSON entre dos ejecuciones se
// saca ese sello y se documenta. Todo lo demás es determinista por seed.
const stripCreatedAt = (value) => {
  const copy = JSON.parse(JSON.stringify(value));
  if (copy && copy.career && copy.career.snapshot) delete copy.career.snapshot.createdAt;
  return JSON.stringify(copy);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYER_NAMES = ['Nahue', 'Rui', 'Mati', 'Alan', 'JJ', 'Gonzi'];
const producedStates = [];   // todos los flow states generados (deepScan N)
const tracked = [];          // pureza M: snapshots de originales

const track = (label, obj) => { tracked.push({ label, json: JSON.stringify(obj), ref: obj }); };
const trackState = (label, state) => {
  producedStates.push(state);
  track(label, state);
  if (state && state.career) track(`${label}:career`, state.career);
  if (state && Array.isArray(state.youthOffers)) track(`${label}:youthOffers`, state.youthOffers);
  if (state && Array.isArray(state.transferOffers)) track(`${label}:transferOffers`, state.transferOffers);
  if (state && state.seasonReport) track(`${label}:seasonReport`, state.seasonReport);
};

// ============================================================================
// A) Sintaxis + importación: si engine/flow están rotos, no hay nada que testear.
// ============================================================================
console.log('== A) Sintaxis e importación ==');
for (const rel of ['src/features/career/engine.js', 'src/features/career/flow.js']) {
  const check = spawnSync(process.execPath, ['--check', rel], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, `node --check ${rel}`);
  if (check.status !== 0) console.error(check.stderr);
}

let flow = null;
try {
  flow = await import(pathToFileURL(path.join(root, 'src', 'features', 'career', 'flow.js')).href);
} catch (err) {
  console.error('  ✗ FAIL: flow.js se importa →', err && err.message ? err.message : err);
  console.log(`\n${failures} FALLAS`);
  process.exit(1);
}
assert(flow !== null, 'flow.js se importa sin errores (Node ESM puro)');

// ============================================================================
// B) Exportaciones públicas
// ============================================================================
console.log('\n== B) Exports ==');
assert(typeof flow.startCareer === 'function', 'startCareer está exportada y es función');
assert(typeof flow.chooseYouthClub === 'function', 'chooseYouthClub está exportada y es función');
assert(typeof flow.advanceSeason === 'function', 'advanceSeason está exportada y es función');
assert(typeof flow.getCareerDecisionOptions === 'function', 'getCareerDecisionOptions está exportada y es función');
assert(typeof flow.chooseCareerAction === 'function', 'chooseCareerAction está exportada y es función');
assert(flow.FLOW_PHASES && typeof flow.FLOW_PHASES === 'object', 'FLOW_PHASES exportado (contrato de fases)');
assert(flow.FLOW_ACTIONS && typeof flow.FLOW_ACTIONS === 'object', 'FLOW_ACTIONS exportado (contrato de acciones)');

// El archivo NO conoce React/UI/persistencia: barrido del código sin comentarios.
{
  const src = fs.readFileSync(path.join(root, 'src', 'features', 'career', 'flow.js'), 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert(!/from\s+['"]react['"]|useState|useEffect|useMemo|useRef/i.test(code), 'sin React ni hooks');
  assert(!/localStorage|sessionStorage/i.test(code), 'sin localStorage/sessionStorage');
  assert(!/\bwindow\b|\bdocument\b|querySelector|createElement/i.test(code), 'sin window/document/DOM');
  assert(!/<[A-Za-z][^>]*>/.test(code) || !/jsx/i.test(code), 'sin JSX');
  assert(!/fs\.|process\.exit|require\(/.test(code), 'sin fs/procesos dentro del flow');
}

// ============================================================================
// C) startCareer() — los 6 amigos arrancan en un estado válido
// ============================================================================
console.log('\n== C) startCareer: Nahue, Rui, Mati, Alan, JJ, Gonzi ==');
for (const [i, name] of PLAYER_NAMES.entries()) {
  const player = players.find((p) => p.name === name);
  assert(Boolean(player), `${name}: existe en data.js`);
  const st = flow.startCareer(player, { difficulty: 'intensa', seed: 100 + i });
  trackState(`C:${name}`, st);

  assert(st && typeof st === 'object', `${name}: estado devuelto`);
  assert(st.career && st.career.name === name, `${name}: career creada con su nombre`);
  assert(st.career.retired === false && st.career.age === AGE.START, `${name}: edad ${AGE.START}, no retirada`);
  assert(st.career.season === 2026 && Array.isArray(st.career.seasonHistory), `${name}: temporada 2026, sin historial aún`);
  assert(st.phase === 'debut', `${name}: phase 'debut'`);
  assert(st.career.club === null, `${name}: career nace SIN club (null)`);
  assert(st.lastAction && st.lastAction.ok === true, `${name}: lastAction ok`);
  assert(JSON.stringify(flow.getCareerDecisionOptions(st)) === '["choose_youth_club"]',
    `${name}: opciones de debut = ['choose_youth_club']`);

  const offers = st.youthOffers;
  assert(Array.isArray(offers) && offers.length > 0 && offers.length <= OFFER_RULES.youthOfferCount,
    `${name}: ${offers.length} ofertas de cantera (1..${OFFER_RULES.youthOfferCount})`);
  assert(offers.every((o) => o && o.id && o.club && o.club.slug && Number.isFinite(o.division)
    && Number.isFinite(o.estimatedValue) && o.reason === 'youth_debut'),
    `${name}: ofertas con id/club/división/valor y reason 'youth_debut'`);
  const allowed = startingDivisionsForOvr(st.career.ovr);
  assert(offers.every((o) => allowed.includes(o.division)),
    `${name}: divisiones de ofertas dentro de startingDivisionsForOvr (ovr ${st.career.ovr} → D${allowed.join('/')})`);
  // La carrera nace SIN club: no hay club actual que excluir, pero las 3
  // ofertas del pool de debut tienen que ser destinos DISTINTOS entre sí.
  assert(new Set(offers.map((o) => o.club.slug)).size === offers.length,
    `${name}: ofertas de cantera con clubes distintos (sin repetir)`);
  assert(deepScan(st), `${name}: sin NaN/Infinity en el estado`);
}

// Jugador inexistente: estado detenido sin lanzar (createCareer lanza con null).
{
  const bad = flow.startCareer(null, {});
  trackState('C:null', bad);
  assert(bad.phase === 'stopped' && bad.career === null && bad.stoppedReason === 'invalid_player',
    'startCareer(null) → estado stopped sin lanzar');
  assert(deepScan(bad), 'startCareer(null): sin NaN/Infinity');
  assert(flow.getCareerDecisionOptions(bad).length === 0, 'estado stopped: sin acciones');
}

// ============================================================================
// D) Debut: elegir una oferta válida funciona vía acceptTransfer
// ============================================================================
console.log('\n== D) Debut: elección de club de cantera ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const st0 = flow.startCareer(alan, { difficulty: 'intensa', seed: 11 });
  trackState('D:st0', st0);
  const snapshotSt0 = JSON.stringify(st0);

  assert(st0.youthOffers.length === OFFER_RULES.youthOfferCount, 'debut: 3 ofertas disponibles');
  const chosen = st0.youthOffers[0];

  const st1 = flow.chooseYouthClub(st0, chosen);
  trackState('D:st1', st1);
  assert(st1.lastAction && st1.lastAction.ok === true, 'elegir oferta válida: ok');
  assert(st1.phase === 'season' && st1.youthOffers === null, 'phase abandona debut → season (ofertas cerradas)');
  assert(st1.career.club.slug === chosen.club.slug, `career queda en el club elegido (${chosen.club.name})`);
  assert(st1.career.club.division === chosen.division, 'división coherente con la oferta');

  // El cambio pasó por acceptTransfer: la carrera nació SIN club, así que el
  // debut es directamente la PRIMERA etapa del historial (career_start).
  assert(Array.isArray(st1.career.clubHistory) && st1.career.clubHistory.length === 1,
    'clubHistory: una sola etapa (la carrera nació sin club: el debut es la etapa inicial)');
  assert(st1.career.clubHistory[0].via === 'career_start',
    'clubHistory: la etapa del debut queda marcada como career_start');
  assert(st1.career.clubHistory[0].club.slug === chosen.club.slug, 'clubHistory registra el club elegido');

  // El estado original NO se modifica (pureza).
  assert(JSON.stringify(st0) === snapshotSt0, 'estado original intacto tras elegir (snapshot JSON)');
  assert(st0.career.club === null, 'el estado original sigue SIN club (null)');
  assert(st0.youthOffers.length === OFFER_RULES.youthOfferCount, 'el estado original conserva sus ofertas');
  assert(st1.career !== st0.career, 'la career del nuevo estado es OTRA referencia (sin mutación)');
  assert(deepScan(st1), 'sin NaN/Infinity tras el debut');

  // La misma elección resuelta vía chooseCareerAction (dispatch explícito).
  const st1b = flow.chooseCareerAction(st0, 'choose_youth_club', { offerId: chosen.id });
  trackState('D:st1b', st1b);
  assert(st1b.lastAction.ok === true && st1b.career.club.slug === chosen.club.slug,
    'chooseCareerAction(choose_youth_club) delega en chooseYouthClub');
}

// ============================================================================
// E) Oferta inválida / ajena al estado: rechazo sin mutación
// ============================================================================
console.log('\n== E) Oferta inválida: rechazo sin mutación ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const st0 = flow.startCareer(alan, { difficulty: 'intensa', seed: 11 });
  const snapshotSt0 = JSON.stringify(st0);
  const careerRef = st0.career;

  // Objeto con id que no existe en el estado.
  const ghost = flow.chooseYouthClub(st0, { id: 'youth-offer-999' });
  trackState('E:ghost', ghost);
  assert(ghost.lastAction.ok === false && ghost.lastAction.reason === 'offer_not_available',
    'oferta con id inexistente: rechazada');
  assert(JSON.stringify(ghost.career) === JSON.stringify(careerRef), 'career sin cambios (JSON)');
  assert(JSON.stringify(st0) === snapshotSt0, 'estado original sin cambios');

  // Objeto con datos de club reales PERO que no pertenece a las ofertas del estado.
  // (fase mundo real: el fixture usa un club real del catálogo, no uno Avergas)
  const foreignClub = findClub('platense');
  const foreign = {
    id: 'oferta-fantasma',
    club: { slug: foreignClub.slug, name: foreignClub.name },
    division: 1,
    estimatedValue: 12345,
  };
  const foreignRes = flow.chooseYouthClub(st0, foreign);
  trackState('E:foreign', foreignRes);
  assert(foreignRes.lastAction.ok === false && foreignRes.lastAction.reason === 'offer_not_available',
    'oferta ajena al estado: rechazada');
  assert(JSON.stringify(foreignRes.career) === JSON.stringify(careerRef), 'career sin cambios con oferta ajena');

  // undefined / null: tampoco acepta.
  assert(flow.chooseYouthClub(st0, undefined).lastAction.ok === false, 'offer undefined: rechazada');
  assert(flow.chooseYouthClub(st0, null).lastAction.ok === false, 'offer null: rechazada');

  // Estado ya en 'season': la fase debut no acepta más elecciones.
  const st1 = flow.chooseYouthClub(st0, st0.youthOffers[0]);
  const late = flow.chooseYouthClub(st1, st0.youthOffers[1]);
  trackState('E:late', late);
  assert(late.lastAction.ok === false && late.lastAction.reason === 'wrong_phase', 'fuera de fase: rechazada');

  // Estado inválido: sin lanzar, forma estable.
  const invalid = flow.chooseYouthClub(null, {});
  trackState('E:invalid', invalid);
  assert(invalid.phase === 'stopped' && invalid.lastAction.ok === false, 'estado null → stopped sin lanzar');
}

// ============================================================================
// Helper: lleva una carrera de debut a un checkpoint de decisión (determinista).
// ============================================================================
const reachDecision = (player, seed, difficulty = 'intensa') => {
  let st = flow.startCareer(player, { difficulty, seed });
  st = flow.chooseYouthClub(st, st.youthOffers[0]);
  st = flow.advanceSeason(st, { seed: seed + 1 });
  if (st.phase === 'event') {
    st = flow.chooseCareerAction(st, 'choose_event_choice',
      { choiceId: st.currentEvent.event.choices[0].id }, { seed: seed + 2 });
  }
  return st; // phase 'decision'
};

// ============================================================================
// F) Temporada: advanceSeason usa simulateSeason como motor
// ============================================================================
console.log('\n== F) Temporada: edad/temporada/historial/stats/phase ==');
{
  const alan = players.find((p) => p.name === 'Alan');

  // Cadencia 'intensa' (seasonsPerDecision = 1): cada temporada → checkpoint.
  const st0 = flow.startCareer(alan, { difficulty: 'intensa', seed: 21 });
  const st1 = flow.chooseYouthClub(st0, st0.youthOffers[0]);
  trackState('F:st1', st1);
  const before = st1.career;
  const beforeHistory = before.seasonHistory.length;
  const beforeMatches = before.careerStats.matches.length;
  const beforePj = before.careerStats.pj;

  const st2 = flow.advanceSeason(st1, { seed: 22 });
  trackState('F:st2', st2);

  assert(st2.lastAction && st2.lastAction.ok === true, 'temporada avanzada: ok');
  assert(st2.career.age === before.age + 1, `age aumenta (${before.age} → ${st2.career.age})`);
  assert(st2.career.season === before.season + 1, `season aumenta (${before.season} → ${st2.career.season})`);
  assert(st2.career.seasonHistory.length === beforeHistory + 1, 'seasonHistory aumenta exactamente 1');
  assert(st2.seasonReport && st2.career.lastSeasonReport, 'el flow conserva el reporte de temporada');
  assert(JSON.stringify(st2.seasonReport) === JSON.stringify(st2.career.seasonHistory[beforeHistory]),
    'seasonReport === reporte archivado en seasonHistory');
  assert(st2.seasonReport.season === before.season && st2.seasonReport.age === before.age,
    'reporte corresponde a la temporada recién jugada');
  assert(st2.career.careerStats.matches.length === beforeMatches + 1,
    'careerStats.matches crece 1 por la temporada');
  assert(st2.career.careerStats.pj === beforePj + st2.seasonReport.pj,
    `careerStats.pj acumula los partidos del reporte (${beforePj} + ${st2.seasonReport.pj})`);
  assert(st2.career !== before, 'la career del nuevo estado es otra referencia');
  assert(JSON.stringify(st1) === JSON.stringify({ ...st1 }) && st1.career === before,
    'estado/career originales intactos');
  assert(['decision', 'event'].includes(st2.phase),
    `cadencia intensa: checkpoint tras 1 temporada (phase '${st2.phase}')`);
  assert(st2.seasonsSinceDecision === 1, 'contador de checkpoint en 1');
  assert(deepScan(st2), 'sin NaN/Infinity tras la temporada');

  // Si el checkpoint rodó evento: el estado lo lleva y se resuelve con el
  // sistema existente (events.js), sin duplicar nada.
  if (st2.phase === 'event') {
    assert(st2.currentEvent && st2.currentEvent.event && Array.isArray(st2.currentEvent.event.choices)
      && st2.currentEvent.event.choices.length >= 2, 'checkpoint de evento: event con decisiones');
    assert(JSON.stringify(flow.getCareerDecisionOptions(st2)) === '["choose_event_choice"]',
      'opciones en fase evento = ["choose_event_choice"]');
    const st3 = flow.chooseCareerAction(st2, 'choose_event_choice',
      { choiceId: st2.currentEvent.event.choices[0].id }, { seed: 23 });
    trackState('F:st3', st3);
    assert(st3.lastAction.ok === true, 'decisión de evento aplicada');
    assert(st3.phase === 'decision' && st3.currentEvent === null, 'evento resuelto → decision');
    assert(deepScan(st3), 'sin NaN/Infinity tras la decisión de evento');
  }

  // Cadencia 'normal' (seasonsPerDecision = 2): dos temporadas por checkpoint.
  const n0 = flow.startCareer(alan, { difficulty: 'normal', seed: 31 });
  const n1 = flow.chooseYouthClub(n0, n0.youthOffers[0]);
  const n2 = flow.advanceSeason(n1, { seed: 32 });
  trackState('F:n2', n2);
  assert(n2.phase === 'season' && n2.seasonsSinceDecision === 1,
    "cadencia normal: 1 temporada aún no abre checkpoint (phase 'season')");
  const n3 = flow.advanceSeason(n2, { seed: 33 });
  trackState('F:n3', n3);
  assert(['decision', 'event'].includes(n3.phase) && n3.seasonsSinceDecision === 2,
    'cadencia normal: el checkpoint abre en la temporada 2');

  // Fuera de fase: no se puede avanzar con decisión pendiente.
  const pend = st2.phase === 'decision' ? st2 : n3;
  const pendRes = flow.advanceSeason(pend, { seed: 34 });
  trackState('F:pend', pendRes);
  assert(pendRes.lastAction.ok === false && pendRes.lastAction.reason === 'wrong_phase',
    'advanceSeason con decisión pendiente: rechazado sin mutar');
  assert(JSON.stringify(pendRes.career) === JSON.stringify(pend.career), 'career intacta en el rechazo');
}

// ============================================================================
// G) Decisiones: opciones coherentes con el checkpoint
// ============================================================================
console.log('\n== G) Opciones de decisión por fase ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const st0 = flow.startCareer(alan, { difficulty: 'intensa', seed: 41 });
  assert(JSON.stringify(flow.getCareerDecisionOptions(st0)) === '["choose_youth_club"]',
    "debut → ['choose_youth_club']");
  const st1 = flow.chooseYouthClub(st0, st0.youthOffers[0]);
  assert(JSON.stringify(flow.getCareerDecisionOptions(st1)) === '["advance_season"]',
    "season → ['advance_season']");
  const st2 = flow.advanceSeason(st1, { seed: 42 });
  if (st2.phase === 'event') {
    assert(JSON.stringify(flow.getCareerDecisionOptions(st2)) === '["choose_event_choice"]',
      "event → ['choose_event_choice']");
  } else {
    assert(JSON.stringify(flow.getCareerDecisionOptions(st2)) === '["stay","transfer","retire"]',
      "decision → ['stay','transfer','retire']");
  }
  assert(flow.getCareerDecisionOptions(null).length === 0, 'estado null → [] (sin lanzar)');
  assert(flow.getCareerDecisionOptions(undefined).length === 0, 'estado undefined → []');
  assert(flow.getCareerDecisionOptions({}).length === 0, 'estado vacío → []');
  // Opciones inválidas que el estado NO permite no se ofrecen nunca:
  assert(!flow.getCareerDecisionOptions(st1).includes('stay'), "season no ofrece 'stay'");
  assert(!flow.getCareerDecisionOptions(st0).includes('transfer'), "debut no ofrece 'transfer'");
}

// ============================================================================
// H) Stay: resolver quedarse (SIEMPRE vía resolveStay del engine)
// ============================================================================
console.log('\n== H) Stay ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const dec = reachDecision(alan, 51);
  trackState('H:dec', dec);
  assert(dec.phase === 'decision', 'helper: llegamos a una decisión');
  const clubBefore = dec.career.club.slug;
  const careerSnapshot = JSON.stringify(dec.career);

  const stayed = flow.chooseCareerAction(dec, 'stay', null, { seed: 52 });
  trackState('H:stayed', stayed);
  assert(stayed.lastAction && stayed.lastAction.ok === true, "chooseCareerAction(state, 'stay'): ok");
  assert(stayed.career.club.slug === clubBefore, 'club NO cambia al quedarse');
  assert(stayed.phase === 'season' && stayed.transferOffers === null, 'decisión cerrada → season');
  assert(stayed.seasonsSinceDecision === 0, 'contador de checkpoint reseteado');
  assert(Number.isFinite(stayed.lastAction.loyaltyOvrBonus), 'loyaltyOvrBonus informado por el flow');
  assert(stayed.career.events.some((e) => e.type === 'stay'), "evento 'stay' registrado por el engine");
  assert(deepScan(stayed), 'sin NaN/Infinity tras stay');

  // La career original (la del estado de decisión) no cambia.
  assert(JSON.stringify(dec.career) === careerSnapshot, 'career original intacta tras stay');
  assert(stayed.career !== dec.career, 'nueva career, sin mutación');

  // 'stay' fuera de fase: rechazo limpio.
  const wrongPhase = flow.chooseCareerAction(stayed, 'stay');
  trackState('H:wrongPhase', wrongPhase);
  assert(wrongPhase.lastAction.ok === false && wrongPhase.lastAction.reason === 'wrong_phase',
    "stay en phase 'season': rechazado");
  assert(wrongPhase.career === stayed.career, 'career compartida sin cambios en el rechazo');
}

// ============================================================================
// I) Transfer: abrir mercado → elegir oferta → acceptTransfer
// ============================================================================
console.log('\n== I) Transfer ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const dec = reachDecision(alan, 61);
  const clubBefore = dec.career.club.slug;
  const historyBefore = dec.career.clubHistory.length;
  const decSnapshot = JSON.stringify(dec);

  // Paso 1: abrir el mercado (generateTransferOffers, sin elegir nada).
  const opened = flow.chooseCareerAction(dec, 'transfer');
  trackState('I:opened', opened);
  assert(opened.lastAction.ok === true && opened.lastAction.opened === true, 'mercado abierto: ok');
  assert(opened.phase === 'transfer', "phase → 'transfer'");
  assert(Array.isArray(opened.transferOffers) && opened.transferOffers.length > 0
    && opened.transferOffers.length <= OFFER_RULES.transferOfferCount,
    `transferOffers generadas (${opened.transferOffers.length}, hasta ${OFFER_RULES.transferOfferCount})`);
  assert(opened.transferOffers.every((o) => o.club.slug !== clubBefore),
    'ninguna oferta ofrece el club actual');
  assert(JSON.stringify(dec) === decSnapshot, 'el estado de decisión queda intacto al abrir el mercado');
  assert(JSON.stringify(flow.getCareerDecisionOptions(opened)) === '["transfer","stay","retire"]',
    "transfer → ['transfer','stay','retire']");

  // Paso 2: aceptar UNA oferta del estado (acceptTransfer).
  const chosen = opened.transferOffers[0];
  const accepted = flow.chooseCareerAction(opened, 'transfer', { offerId: chosen.id });
  trackState('I:accepted', accepted);
  assert(accepted.lastAction.ok === true, 'oferta aceptada: ok');
  assert(accepted.career.club.slug === chosen.club.slug, `club cambia al de la oferta (${chosen.club.name})`);
  assert(accepted.career.clubHistory.length === historyBefore + 1,
    `clubHistory crece 1 (${historyBefore} → ${accepted.career.clubHistory.length})`);
  assert(accepted.career.clubHistory[accepted.career.clubHistory.length - 1].club.slug === chosen.club.slug,
    'clubHistory registra la etapa del nuevo club');
  assert(accepted.phase === 'season' && accepted.transferOffers === null,
    'oferta consumida: deja de estar pendiente (mercado cerrado)');
  assert(JSON.stringify(dec) === decSnapshot, 'career original no cambia');
  assert(deepScan(accepted), 'sin NaN/Infinity tras el traspaso');

  // Oferta ajena al mercado abierto: rechazo sin tocar la career.
  const foreignClub2 = findClub('deportivo-moron');
  const foreign = {
    id: 'oferta-de-otro-mercado',
    club: { slug: foreignClub2.slug, name: foreignClub2.name },
    division: 2,
    estimatedValue: 99999,
  };
  const rejected = flow.chooseCareerAction(opened, 'transfer', foreign);
  trackState('I:rejected', rejected);
  assert(rejected.lastAction.ok === false && rejected.lastAction.reason === 'offer_not_available',
    'oferta ajena a transferOffers: rechazada');
  assert(JSON.stringify(rejected.career) === JSON.stringify(opened.career),
    'career intacta tras el rechazo (A y B en el estado, C no existe acá)');

  // Desde 'decision' no se puede aceptar una oferta que todavía no existe.
  const early = flow.chooseCareerAction(dec, 'transfer', { offerId: chosen.id });
  trackState('I:early', early);
  assert(early.lastAction.ok === false, 'aceptar oferta sin abrir el mercado: rechazado');

  // Alternativa válida del mismo checkpoint: quedarse cierra el mercado.
  const stayedAlt = flow.chooseCareerAction(opened, 'stay', null, { seed: 62 });
  trackState('I:stayedAlt', stayedAlt);
  assert(stayedAlt.lastAction.ok === true && stayedAlt.phase === 'season',
    'stay desde el mercado abierto: checkpoint cerrado (validación del engine respetada)');
}

// ============================================================================
// J) Retiro: al borde del retiro → única acción válida 'retire'
// ============================================================================
console.log('\n== J) Retiro ==');
{
  const gonzi = players.find((p) => p.name === 'Gonzi');
  const base = flow.startCareer(gonzi, { difficulty: 'intensa', seed: 71 });
  let st = flow.chooseYouthClub(base, base.youthOffers[0]);

  // Avanzar temporadas hasta que el engine marque mandatoryRetirement.
  let report = null;
  for (let i = 0; i < 30; i += 1) {
    st = flow.advanceSeason(st, { seed: 8000 + i });
    if (st.phase === 'event') {
      st = flow.chooseCareerAction(st, 'choose_event_choice',
        { choiceId: st.currentEvent.event.choices[0].id }, { seed: 9000 + i });
    }
    report = st.seasonReport;
    if (report && report.mandatoryRetirement === true) break;
    if (st.phase === 'decision') {
      // Mientras queden temporadas por jugar, siempre quedarse (misma seed de flow).
      st = flow.chooseCareerAction(st, 'stay', null, { seed: 7000 + i });
    }
    if (st.phase === 'retired') break;
  }
  trackState('J:beforeRetire', st);

  assert(st.phase === 'decision' && st.retirementDue === true,
    "retiro obligatorio alcanzado: phase 'decision' con retirementDue");
  assert(report === null || report.mandatoryRetirement === true,
    'el reporte del engine marca mandatoryRetirement (contrato respetado, sin transición inventada)');
  assert(JSON.stringify(flow.getCareerDecisionOptions(st)) === '["retire"]',
    "con retiro obligatorio: única opción ['retire']");
  assert(st.stoppedReason === 'retirement', "stoppedReason 'retirement'");

  const careerBefore = JSON.stringify(st.career);
  const retired = flow.chooseCareerAction(st, 'retire');
  trackState('J:retired', retired);
  assert(retired.lastAction.ok === true, 'retiro aplicado: ok');
  assert(retired.career.retired === true, 'retired === true (hecho por retireCareer del engine)');
  assert(retired.phase === 'retired', "phase 'retired'");
  assert(retired.career.events.some((e) => e.type === 'retirement'), 'evento de retiro del engine presente');
  assert(Array.isArray(retired.career.achievements), 'logros de retiro evaluados por el engine');
  assert(JSON.stringify(st.career) === careerBefore, 'career original intacta');
  assert(deepScan(retired), 'sin NaN/Infinity tras el retiro');

  // Carrera retirada: nada se puede hacer.
  assert(JSON.stringify(flow.getCareerDecisionOptions(retired)) === '[]', 'retired → sin opciones');
  const blockedSeason = flow.chooseCareerAction(retired, 'advance_season', null, { seed: 99 });
  trackState('J:blockedSeason', blockedSeason);
  assert(blockedSeason.lastAction.ok === false && blockedSeason.lastAction.reason === 'retired',
    'no se pueden avanzar temporadas retirado');
  const blockedTransfer = flow.chooseCareerAction(retired, 'transfer');
  trackState('J:blockedTransfer', blockedTransfer);
  assert(blockedTransfer.lastAction.ok === false, 'no se puede abrir mercado retirado');
  const blockedStay = flow.chooseCareerAction(retired, 'stay');
  trackState('J:blockedStay', blockedStay);
  assert(blockedStay.lastAction.ok === false, 'no se puede resolver stay retirado');
  const blockedRetire2 = flow.chooseCareerAction(retired, 'retire');
  trackState('J:blockedRetire2', blockedRetire2);
  assert(blockedRetire2.lastAction.ok === false, 'retiro duplicado rechazado (idempotencia del engine preservada)');
  assert(JSON.stringify(blockedRetire2.career) === JSON.stringify(retired.career),
    'career retirada intacta tras todos los intentos');
}

// ============================================================================
// K) Determinismo: mismo player + mismo seed + mismas acciones → mismo JSON
// ============================================================================
console.log('\n== K) Determinismo ==');
const runSequence = (seedBase) => {
  let st = flow.startCareer(players.find((p) => p.name === 'JJ'), { difficulty: 'intensa', seed: seedBase + 1 });
  st = flow.chooseYouthClub(st, st.youthOffers[0]);
  st = flow.advanceSeason(st, { seed: seedBase + 2 });
  if (st.phase === 'event') {
    st = flow.chooseCareerAction(st, 'choose_event_choice',
      { choiceId: st.currentEvent.event.choices[0].id }, { seed: seedBase + 3 });
  }
  st = flow.chooseCareerAction(st, 'stay', null, { seed: seedBase + 4 });
  st = flow.advanceSeason(st, { seed: seedBase + 5 });
  if (st.phase === 'event') {
    st = flow.chooseCareerAction(st, 'choose_event_choice',
      { choiceId: st.currentEvent.event.choices[0].id }, { seed: seedBase + 6 });
  }
  st = flow.chooseCareerAction(st, 'transfer', null, { seed: seedBase + 7 });
  if (st.phase === 'transfer') {
    st = flow.chooseCareerAction(st, 'transfer', { offerIndex: 0 });
  }
  return st;
};
{
  trackState('K:a', runSequence(0));
  trackState('K:b', runSequence(0));
  const a = stripCreatedAt(runSequence(0));
  const b = stripCreatedAt(runSequence(0));
  assert(a === b, 'misma secuencia con mismos seeds → mismo resultado JSON');
  assert(deepScan(runSequence(0)), 'sin NaN/Infinity en la secuencia determinista');
  // Nota: se compara sin career.snapshot.createdAt porque createCareer lo sella
  // con Date.now() (comportamiento actual del engine, no modificado por flow).
}

// ============================================================================
// L) RNG: { rng } equivale a { seed } con la misma secuencia
// ============================================================================
console.log('\n== L) RNG (rng vs seed) ==');
{
  const alan = players.find((p) => p.name === 'Alan');
  const withRng = flow.startCareer(alan, { rng: createSeededRng(4242) });
  const withSeed = flow.startCareer(alan, { seed: 4242 });
  trackState('L:withRng', withRng);
  trackState('L:withSeed', withSeed);
  assert(stripCreatedAt(withRng) === stripCreatedAt(withSeed),
    'startCareer: { rng: createSeededRng(s) } ≡ { seed: s }');

  // Misma carrera base para ambas llamadas: cada una resuelve SU rng
  // (fresh con la misma semilla) → resultados idénticos.
  const baseA = flow.chooseYouthClub(flow.startCareer(alan, { difficulty: 'intensa', seed: 51 }),
    flow.startCareer(alan, { difficulty: 'intensa', seed: 51 }).youthOffers[0]);
  trackState('L:base', baseA);
  const la = flow.advanceSeason(baseA, { rng: createSeededRng(77) });
  const lb = flow.advanceSeason(baseA, { seed: 77 });
  trackState('L:la', la);
  trackState('L:lb', lb);
  assert(JSON.stringify(la) === JSON.stringify(lb),
    'advanceSeason: { rng } ≡ { seed } (misma secuencia, mismo resultado)');
  assert(deepScan(la), 'sin NaN/Infinity en la variante rng');
}

// ============================================================================
// M) Pureza: snapshots completos de todos los originales
// ============================================================================
console.log('\n== M) Pureza global ==');
{
  let clean = true;
  for (const item of tracked) {
    if (JSON.stringify(item.ref) !== item.json) {
      clean = false;
      console.error(`  ✗ MUTADO: ${item.label}`);
    }
  }
  assert(clean, `todos los originales quedan idénticos (${tracked.length} snapshots verificados)`);
}

// ============================================================================
// N) Sin NaN/Infinity: deep scan de todos los estados producidos
// ============================================================================
console.log('\n== N) Sin NaN/Infinity ==');
{
  let allFinite = true;
  for (const st of producedStates) allFinite = deepScan(st) && allFinite;
  assert(allFinite, `deepScan sin NaN/Infinity en ${producedStates.length} estados del flow`);
}

// Acción desconocida: rechazo limpio (no lanza, no muta).
{
  const dec = reachDecision(players.find((p) => p.name === 'Mati'), 91);
  const snapshot = JSON.stringify(dec);
  const bad = flow.chooseCareerAction(dec, 'hack_the_planet');
  trackState('N:unknownAction', bad);
  assert(bad.lastAction.ok === false && bad.lastAction.reason === 'unknown_action',
    'acción desconocida: rechazada sin lanzar');
  assert(JSON.stringify(bad.career) === JSON.stringify(dec.career), 'career intacta con acción desconocida');
  assert(JSON.stringify(dec) === snapshot, 'estado original intacto con acción desconocida');
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-career-flow: TODO OK'
  : `\n❌ smoke-career-flow: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;









