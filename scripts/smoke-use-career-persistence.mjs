// ============================================================================
// Smoke de INTEGRACIÓN de persistencia en el hook — useCareer + persistence
// (Paso 10) · Uso: node scripts/smoke-use-career-persistence.mjs
// ============================================================================
// QUÉ CUBRE ESTE SMOKE EN NODE (y qué NO puede cubrir):
//
// Node no tiene localStorage ni DOM, así que este smoke:
//   1) crea un storage mock EN MEMORIA (getItem/setItem/removeItem/clear/key/
//      length) y lo asigna a globalThis.localStorage antes de usar el hook,
//      igual que smoke-career-persistence.mjs (la persistencia resuelve el
//      storage de forma PEREZOSA en cada llamada → sustitución controlada);
//   2) ejecuta el hook con React REAL vía react-dom/server (renderToString),
//      que corre el CUERPO del hook (useState/useMemo/useCallback/useRef
//      reales) inyectándolo en un componente. En el renderer de servidor
//      useEffect NO se ejecuta (verificado: un contador de efectos queda en 0).
//
// Por eso este smoke prueba:
//   A) Sin save: sintaxis, import, render real (normal y StrictMode) sin
//      excepciones y estado inicial "sin carrera" consistente.
//   B) Restauración: el render del hook NO carga el save (la carga vive en el
//      efecto, no en el render) + save/load real del flow state de cada fase
//      (debut, decisión, mercado, evento, retirado) con TODOS sus campos.
//   C) Continuación: acción válida sobre el estado restaurado → guardado →
//      load refleja el cambio (lo mismo que hace el efecto de autosave).
//   D) Reset: clearCareerState() elimina SOLO la clave nueva y deja intactas
//      las 8 claves del sistema viejo.
//   E) Guardas estáticas de StrictMode/autosave + idempotencia del round trip.
//   F) Robustez: sin storage / storage que lanza → nunca rompe ni lanza.
//   G) No regresión: corre los smokes existentes de estas dos capas.
//
// NO cubierto acá (requiere navegador/DOM y el proyecto NO agrega
// dependencias: no hay jsdom, @testing-library, vitest ni react-test-renderer):
// el DISPARO real de useEffect al montar y en cada cambio de estado. Ese punto
// se verifica en npm run dev con la pantalla 'career2' del lab
// (React → useCareer → persistence → flow → engine). Las guardas del efecto
// (una sola carga por montaje, sin setState en el autosave) se verifican
// estáticamente en E) y la semántica de carga/guardado en B/C/D/F.
// ============================================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_REL = 'src/features/career/useCareer.js';
const hookPath = path.join(root, HOOK_REL);

const json = (value) => JSON.stringify(value);

/** Recorrido recursivo: true si ningún número es NaN/Infinity. */
const deepScanFinite = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (Array.isArray(v)) return v.every(deepScanFinite);
  return Object.values(v).every(deepScanFinite);
};

/** true si no hay funciones/símbolos/bigint (nada no serializable colado). */
const noNonSerializable = (v) => {
  if (v === null) return true;
  const type = typeof v;
  if (type === 'function' || type === 'symbol' || type === 'bigint') return false;
  if (type !== 'object') return true;
  if (Array.isArray(v)) return v.every(noNonSerializable);
  return Object.values(v).every(noNonSerializable);
};

/** Storage mock en memoria (el mínimo que usa persistence.js). */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    get length() { return map.size; },
  };
}

globalThis.localStorage = createMemoryStorage();
const mock = globalThis.localStorage;

// Claves del sistema VIEJO que reset() NO debe tocar (Paso 10, requisito 4).
const OLD_KEYS = [
  'avergas-career-v2',
  'avergas-history-v1',
  'avergas-player',
  'avergas-screen',
  'avergas-match-v1',
  'avergas-lineup-v1',
  'avergas-injuries-v2',
  'avergas-player-status-v1',
];

// Contrato del flow state completo (el autosave guarda ESTO, no solo career).
const FLOW_FIELDS = [
  'career', 'phase', 'youthOffers', 'transferOffers', 'currentEvent',
  'seasonReport', 'retirementDue', 'seasonsSinceDecision', 'stoppedReason',
  'celebratedTrophyIds', // registro dedupe del aviso temporal de títulos
  'lastAction',
];

// ============================================================================
// Imports reales del proyecto (react/react-dom ya están importados arriba)
// ============================================================================
const flowUrl = pathToFileURL(path.join(root, 'src', 'features', 'career', 'flow.js')).href;
const persistenceUrl = pathToFileURL(path.join(root, 'src', 'features', 'career', 'persistence.js')).href;
const hookUrl = pathToFileURL(hookPath).href;

const flow = await import(flowUrl);
const persistence = await import(persistenceUrl);
const hookModule = await import(hookUrl);

const {
  CAREER_SAVE_KEY,
  saveCareerState,
  loadCareerState,
  clearCareerState,
  deserializeCareerState,
} = persistence;

// ============================================================================
// Helpers de estados REALES (mismo camino que recorre el hook: flow.startCareer)
// ============================================================================
const pickPlayer = (name, fallbackIndex = 0) =>
  players.find((p) => p.name === name) || players[fallbackIndex % players.length];

/** Carrera real, con clon defensivo del player (igual que hook.start). */
function newFlowState(player, seed, difficulty = 'normal') {
  return flow.startCareer(JSON.parse(JSON.stringify(player)), { seed, difficulty });
}

/** Avanza temporadas (resolviendo eventos) hasta un checkpoint de decisión. */
function advanceToDecision(startState, seedBase, maxSeasons = 40) {
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
  return state;
}

/** Abre el mercado buscando una tira de seeds con ofertas (determinista). */
function openTransferMarket(state, seedBase, maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const next = flow.chooseCareerAction(state, 'transfer', null, { seed: seedBase + attempt });
    if (next.phase === flow.FLOW_PHASES.TRANSFER
      && Array.isArray(next.transferOffers) && next.transferOffers.length > 0) return next;
  }
  return null;
}

/** Busca (determinista y acotado) una carrera en phase 'event' (checkpoint). */
function findEventState(player, maxSeeds = 60) {
  for (let seed = 1; seed <= maxSeeds; seed += 1) {
    let state = newFlowState(player, seed, 'intensa');
    if (!Array.isArray(state.youthOffers) || state.youthOffers.length === 0) continue;
    state = flow.chooseYouthClub(state, state.youthOffers[0]);
    for (let step = 0; step < 4; step += 1) {
      state = flow.advanceSeason(state, { seed: seed * 100 + step });
      if (state.phase === flow.FLOW_PHASES.EVENT) return state;
      if (state.phase === flow.FLOW_PHASES.DECISION) {
        state = flow.chooseCareerAction(state, 'stay', null, { seed: seed * 1000 + step });
      }
      if (state.phase !== flow.FLOW_PHASES.SEASON) break;
    }
  }
  return null;
}

/** Lo que hace el efecto de AUTOSAVE del hook: guarda el flow state completo. */
const autosave = (state) => saveCareerState(state);

/** Lo que hace el efecto de RESTAURACIÓN del hook: loadCareerState → state. */
const restore = () => {
  const restored = loadCareerState();
  return (restored && typeof restored === 'object' && restored.career) ? restored : null;
};

/**
 * Renderiza el hook con React REAL (react-dom/server) y devuelve la API que
 * expone. El cuerpo del hook se ejecuta de verdad (hooks reales); los efectos
 * NO corren en el renderer de servidor (por eso acá no restaura ni guarda).
 */
function renderHook(useStrictMode = false) {
  let api = null;
  function Probe() {
    api = hookModule.useCareer();
    return React.createElement('span', null, 'probe');
  }
  const element = useStrictMode
    ? React.createElement(React.StrictMode, null, React.createElement(Probe))
    : React.createElement(Probe);
  const html = renderToString(element);
  return { api, html };
}

// ============================================================================
// A) Sin save: sintaxis, import real, render real y estado inicial sin carrera
// ============================================================================
console.log('== A) Sin save: import + render real con React + estado inicial ==');
{
  const check = spawnSync(process.execPath, ['--check', HOOK_REL], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, `node --check ${HOOK_REL}`);
  if (check.status !== 0) console.error(check.stderr);

  assert(typeof hookModule.useCareer === 'function', 'el hook se importa en Node (useCareer es función)');
  assert(hookModule.default === hookModule.useCareer, 'default export === useCareer');

  mock.clear();
  assert(CAREER_SAVE_KEY === 'avergas-career-engine-v1', `clave exclusiva del nuevo modo (${CAREER_SAVE_KEY})`);
  assert(loadCareerState() === null, 'sin save → loadCareerState() null (el hook arranca sin carrera)');

  const { api } = renderHook();
  assert(api && typeof api === 'object', 'el hook se rendiriza con React real (renderToString) sin lanzar');
  assert(api.state === null, 'estado inicial: state === null (sin carrera)');
  assert(api.hasCareer === false, 'estado inicial: hasCareer === false');
  assert(api.phase === null && api.career === null, 'estado inicial: phase/career null');
  assert(json(api.youthOffers) === '[]' && json(api.transferOffers) === '[]', 'estado inicial: ofertas [] (nunca null en la UI)');
  assert(api.currentEvent === null && api.seasonReport === null && api.lastAction === null, 'estado inicial: currentEvent/seasonReport/lastAction null');
  assert(api.stoppedReason === null && api.retirementDue === false, 'estado inicial: stoppedReason null y retirementDue false');
  assert(json(api.decisionOptions) === '[]', 'estado inicial: decisionOptions []');
  assert(api.isRetired === false && api.isStopped === false, 'estado inicial: isRetired/isStopped false');
  for (const fn of ['start', 'chooseYouthClub', 'advanceSeason', 'chooseAction', 'reset']) {
    assert(typeof api[fn] === 'function', `API pública intacta: ${fn} es función`);
  }

  const strict = renderHook(true);
  assert(strict.api && strict.api.state === null, 'StrictMode: el render del hook no lanza y arranca sin carrera');
  assert(mock.length === 0, 'el render NO escribe nada en storage (0 claves)');

  // Save corrupto / versiones incompatibles → "sin carrera", nunca excepción.
  mock.setItem(CAREER_SAVE_KEY, '{esto no es json');
  assert(loadCareerState() === null, 'save corrupto (JSON roto) → loadCareerState() null sin lanzar');
  assert(deserializeCareerState('{esto no es json').reason === 'invalid_json', "save corrupto → reason 'invalid_json'");
  mock.setItem(CAREER_SAVE_KEY, json({ schemaVersion: 999, worldVersion: 1, savedAt: 0, state: {} }));
  assert(loadCareerState() === null, 'schemaVersion incompatible → null');
  mock.setItem(CAREER_SAVE_KEY, json({ schemaVersion: 1, worldVersion: 999, savedAt: 0, state: {} }));
  assert(loadCareerState() === null, 'worldVersion incompatible → null');
  assert(renderHook().api.state === null, 'con save inválido el hook se rendiriza sin carrera (sin excepción)');
  mock.clear();
}

// ============================================================================
// B) Restauración: el render NO carga el save + round trip completo por fase
// ============================================================================
console.log('== B.0) El render NO llama loadCareerState (la restauración vive en el efecto) ==');
{
  const state = newFlowState(pickPlayer('Gonzi'), 2026, 'normal');
  assert(autosave(state).ok === true, 'setup: carrera real guardada (debut)');
  const rawBefore = mock.getItem(CAREER_SAVE_KEY);
  assert(deserializeCareerState(rawBefore).ok === true, 'setup: el save es un envelope válido');

  const { api } = renderHook();
  assert(api.state === null, 'con save válido presente el render sigue SIN carrera (carga diferida al efecto)');
  assert(mock.getItem(CAREER_SAVE_KEY) === rawBefore, 'el render no reescribe ni modifica el save');
}

/**
 * Autosave + restauración reales (los mismos llamados que hacen los dos efectos
 * del hook) con validación campo por campo del flow state completo.
 */
function assertRoundTrip(label, state) {
  assert(autosave(state).ok === true, `${label}: autosave ok (saveCareerState del flow state completo)`);

  const envelope = JSON.parse(mock.getItem(CAREER_SAVE_KEY));
  const savedKeys = Object.keys(envelope.state).sort();
  assert(json(savedKeys) === json([...FLOW_FIELDS].sort()),
    `${label}: el save trae EXACTAMENTE los 11 campos del flow state (no solo career)`);
  assert(noNonSerializable(envelope.state), `${label}: el save no lleva funciones/símbolos (callbacks/setters/rng fuera)`);
  assert(deepScanFinite(envelope.state), `${label}: el save no lleva NaN/Infinity`);

  const restored = restore();
  assert(restored !== null, `${label}: loadCareerState devuelve carrera`);
  assert(json(restored) === json(state), `${label}: round trip exacto del flow state`);
  assert(restored !== state && restored.career !== state.career,
    `${label}: referencias nuevas (sin refs compartidas con el estado en memoria)`);
  assert(restored.phase === state.phase, `${label}: phase "${state.phase}" restaurada`);
  const clubLabel = state.career.club ? state.career.club.slug : 'sin club (debut)';
  assert(restored.career.club?.slug === state.career.club?.slug, `${label}: club restaurado (${clubLabel})`);
  assert(json(restored.youthOffers) === json(state.youthOffers), `${label}: youthOffers restauradas`);
  assert(json(restored.transferOffers) === json(state.transferOffers), `${label}: transferOffers restauradas`);
  assert(json(restored.currentEvent) === json(state.currentEvent), `${label}: currentEvent restaurado`);
  assert(json(restored.seasonReport) === json(state.seasonReport), `${label}: seasonReport restaurado`);
  assert(restored.seasonsSinceDecision === state.seasonsSinceDecision, `${label}: seasonsSinceDecision ${state.seasonsSinceDecision}`);
  assert(restored.stoppedReason === state.stoppedReason, `${label}: stoppedReason ${String(state.stoppedReason)}`);
  assert(restored.retirementDue === state.retirementDue, `${label}: retirementDue ${state.retirementDue}`);
  assert(restored.lastAction.action === state.lastAction.action, `${label}: lastAction.action "${state.lastAction.action}"`);
  return restored;
}

console.log('== B) Restauración por fase (debut, decisión, mercado, evento, retirado) ==');
{
  const player = pickPlayer('Gonzi');

  // B1) DEBUT: ofertas de cantera + lastAction de start.
  const debut = newFlowState(player, 333, 'normal');
  assert(debut.phase === 'debut' && debut.youthOffers.length > 0, 'B1) setup: carrera en debut con ofertas');
  const restoredDebut = assertRoundTrip('B1 debut', debut);
  assert(restoredDebut.youthOffers.length === debut.youthOffers.length, 'B1) youthOffers disponibles tras restaurar');

  // B2) DECISIÓN: temporadas jugadas + reporte + lastAction de advance_season.
  let mid = flow.chooseYouthClub(debut, debut.youthOffers[0]);
  assert(mid.phase === 'season', 'B2) setup: debut elegido → season');
  mid = advanceToDecision(mid, 41);
  assert(mid.phase === 'decision' && mid.seasonsSinceDecision > 0, `B2) setup: checkpoint de decisión (${mid.seasonsSinceDecision} temporada(s))`);
  const restoredDecision = assertRoundTrip('B2 decision', mid);
  assert(restoredDecision.seasonReport !== null, 'B2) seasonReport sobrevive al save/load');
  assert(json(flow.getCareerDecisionOptions(restoredDecision)) === json(['stay', 'transfer', 'retire']),
    'B2) el estado restaurado sigue siendo operable (decisionOptions reales)');

  // B3) MERCADO: transferOffers del mercado abierto.
  const transfer = openTransferMarket(mid, 900);
  assert(transfer && transfer.phase === 'transfer', 'B3) setup: mercado abierto con ofertas');
  const restoredTransfer = assertRoundTrip('B3 transfer', transfer);
  assert(restoredTransfer.transferOffers.length === transfer.transferOffers.length, 'B3) ofertas del mercado restauradas');

  // B4) EVENTO: currentEvent { event, context } del checkpoint.
  const eventState = findEventState(pickPlayer('Tigre', 1));
  assert(eventState && eventState.phase === 'event' && eventState.currentEvent && eventState.currentEvent.event,
    'B4) setup: checkpoint con evento interactivo');
  const restoredEvent = assertRoundTrip('B4 event', eventState);
  assert(restoredEvent.currentEvent.event.id === eventState.currentEvent.event.id, 'B4) el evento restaurado es el mismo');
  assert(Array.isArray(restoredEvent.currentEvent.event.choices) && restoredEvent.currentEvent.event.choices.length > 0,
    'B4) las opciones del evento sobreviven al save/load');

  // B5) RETIRADO: carrera cerrada (stoppedReason 'retirement').
  const retired = flow.chooseCareerAction(mid, 'retire', null, {});
  assert(retired.phase === 'retired' && retired.career.retired === true, 'B5) setup: carrera retirada');
  const restoredRetired = assertRoundTrip('B5 retired', retired);
  assert(restoredRetired.stoppedReason === 'retirement', 'B5) stoppedReason "retirement" restaurado');
  assert(json(flow.getCareerDecisionOptions(restoredRetired)) === json([]), 'B5) retirado: sin acciones disponibles');
}

// ============================================================================
// C) Continuación: acción válida sobre el estado restaurado → autosave → load
// ============================================================================
console.log('== C) Continuación después de restaurar (acción → autosave → load) ==');
{
  const player = pickPlayer('Gonzi');

  // C1) Debut restaurado → chooseYouthClub → autosave → load refleja el cambio.
  let s = newFlowState(player, 333, 'normal');
  autosave(s);
  const restoredDebut = restore();
  const chosen = restoredDebut.youthOffers[0];
  s = flow.chooseYouthClub(restoredDebut, chosen);
  assert(s.phase === 'season' && s.lastAction.ok === true, 'C1) chooseYouthClub sobre el estado restaurado');
  autosave(s);
  let reloaded = restore();
  assert(reloaded.phase === 'season', 'C1) load refleja la fase nueva ("season")');
  assert(reloaded.career.club.slug === chosen.club.slug, 'C1) load refleja el club elegido');
  assert(reloaded.youthOffers === null && reloaded.lastAction.action === 'choose_youth_club',
    'C1) load refleja ofertas cerradas + lastAction (no el save viejo)');

  // C2) Decisión restaurada → stay → season (contadores y reporte persistidos).
  let mid = advanceToDecision(s, 42);
  assert(mid.phase === 'decision', 'C2) setup: decisión alcanzada');
  autosave(mid);
  const restoredDecision = restore();
  const seasonsPlayed = restoredDecision.seasonsSinceDecision;
  const nextSeason = flow.chooseCareerAction(restoredDecision, 'stay', null, { seed: 71 });
  assert(nextSeason.phase === 'season' && nextSeason.lastAction.ok === true, "C2) chooseAction('stay') sobre el estado restaurado");
  autosave(nextSeason);
  reloaded = restore();
  assert(reloaded.phase === 'season' && reloaded.seasonsSinceDecision === 0,
    `C2) seasonsSinceDecision vuelve a 0 tras el stay (era ${seasonsPlayed})`);
  assert(reloaded.lastAction.action === 'stay' && reloaded.lastAction.ok === true, 'C2) lastAction "stay" persistido');

  // C3) Evento restaurado → choose_event_choice → decision.
  const eventState = findEventState(pickPlayer('Tigre', 1));
  assert(eventState && eventState.phase === 'event', 'C3) setup: evento alcanzado');
  autosave(eventState);
  const restoredEvent = restore();
  const eventsBefore = restoredEvent.career.events.length;
  const choiceId = restoredEvent.currentEvent.event.choices[0].id;
  const afterEvent = flow.chooseCareerAction(restoredEvent, 'choose_event_choice', choiceId, { seed: 88 });
  assert(afterEvent.phase === 'decision' && afterEvent.lastAction.ok === true, 'C3) decisión del evento aplicada tras restaurar');
  autosave(afterEvent);
  reloaded = restore();
  assert(reloaded.phase === 'decision' && reloaded.currentEvent === null, 'C3) load refleja evento cerrado → decision');
  assert(reloaded.career.events.length >= eventsBefore, 'C3) load refleja el evento aplicado en career.events');

  // C4) Retirado restaurado → sigue respetando las guardas del flow.
  const retired = flow.chooseCareerAction(reloaded, 'retire', null, {});
  autosave(retired);
  reloaded = restore();
  assert(reloaded.phase === 'retired' && reloaded.career.retired === true, 'C4) load refleja la carrera retirada');
  const noop = flow.advanceSeason(reloaded, { seed: 1 });
  assert(noop.phase === 'retired' && noop.lastAction.ok === false && noop.lastAction.reason === 'retired',
    'C4) la carrera restaurada sigue respetando las guardas del flow');

  const envelope = JSON.parse(mock.getItem(CAREER_SAVE_KEY));
  assert(noNonSerializable(envelope.state), 'C) tras continuar, el save sigue 100% serializable');
}

// ============================================================================
// D) Reset: clearCareerState elimina SOLO la clave nueva (las 8 viejas intactas)
// ============================================================================
console.log('== D) Reset: solo se borra el save del nuevo modo ==');
{
  for (const key of OLD_KEYS) mock.setItem(key, `valor-viejo:${key}`);
  const state = newFlowState(pickPlayer('Gonzi'), 777, 'normal');
  assert(autosave(state).ok === true, 'D) setup: carrera guardada');
  assert(mock.getItem(CAREER_SAVE_KEY) !== null, 'D) setup: el save existe antes del reset');

  // reset() del hook = clearCareerState() + setState(null) (en ese orden).
  const cleared = clearCareerState();
  assert(cleared && cleared.ok === true, 'D) clearCareerState → { ok: true }');
  assert(loadCareerState() === null, 'D) después del reset loadCareerState() → null');
  assert(mock.getItem(CAREER_SAVE_KEY) === null, 'D) la clave nueva quedó eliminada');
  for (const key of OLD_KEYS) {
    assert(mock.getItem(key) === `valor-viejo:${key}`, `D) ${key} INTACTA (el reset no la toca)`);
  }
  assert(renderHook().api.state === null, 'D) tras el reset el hook arranca sin carrera');
  mock.clear();
}

// ============================================================================
// E) Wiring del hook (estático) + idempotencia del round trip
// ============================================================================
console.log('== E.1) Wiring del hook: efectos, guardas y límites de capas ==');
{
  const source = fs.readFileSync(hookPath, 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

  const importLines = source.match(/^import[\s\S]*?from[^\n]+$/gm) || [];
  assert(importLines.length === 3, `3 imports: react + flow.js + persistence.js (tiene ${importLines.length})`);
  assert(importLines.some((l) => /from\s*['"]react['"]/.test(l)), "importa hooks de 'react'");
  assert(importLines.some((l) => /from\s*['"]\.\/flow\.js['"]/.test(l)), "importa './flow.js'");
  assert(importLines.some((l) => /from\s*['"]\.\/persistence\.js['"]/.test(l)), "importa './persistence.js' (única puerta al save)");
  assert(!/from\s*['"]\.\/engine\.js['"]/.test(source) && !/from\s*['"]\.\/events\.js['"]/.test(source),
    'NO importa engine.js ni events.js (sigue delegando todo en flow.js)');

  assert(!/localStorage|sessionStorage|indexedDB|IndexedDB/.test(code), 'el hook NO menciona storage directamente');
  assert(!/\bwindow\b|\bdocument\b/.test(code), 'el hook NO usa window/document');
  assert(!/getItem|setItem|removeItem/.test(code), 'el hook NO usa la API de storage: todo pasa por persistence.js');
  assert(!/createCareer\(|simulateSeason\(|acceptTransfer\(|resolveStay\(|retireCareer\(|applyEventChoice\(/.test(code),
    'sigue sin re-implementar el motor (la lógica vive en flow/engine)');

  const effects = source.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g) || [];
  assert(effects.length === 3,
    `exactamente 3 efectos (restauración + autosave + aviso de títulos): tiene ${effects.length}`);
  const restoreEffect = effects[0] || '';
  const autosaveEffect = effects[1] || '';
  const trophyToastEffect = effects[2] || '';
  assert(/, \[\]\);\s*$/.test(restoreEffect), 'el efecto de restauración tiene deps [] (corre al montar)');
  assert(/loadCareerState\(\)/.test(restoreEffect), 'la restauración llama loadCareerState()');
  assert(/if \(hydrationRef\.current\) return;/.test(restoreEffect),
    'la restauración tiene guarda por ref (StrictMode: una sola carga por montaje)');
  assert(/, \[state\]\);\s*$/.test(autosaveEffect), 'el autosave depende de [state] (un intento por cambio)');
  assert(/saveCareerState\(state\)/.test(autosaveEffect), 'el autosave guarda el flow state completo');
  assert(/!state \|\| !state\.career/.test(autosaveEffect), 'el autosave NO escribe sin career (nunca saves parciales)');
  assert(!/setState/.test(autosaveEffect), 'el autosave NO llama setState (sin loop load → save → load)');
  assert(!/loadCareerState/.test(autosaveEffect), 'el autosave no re-carga el save');
  assert(/, \[state\]\);\s*$/.test(trophyToastEffect), 'el aviso de títulos depende de [state]');
  assert(/pendingTrophyToasts\(/.test(trophyToastEffect), 'el aviso delega la detección en pendingTrophyToasts()');

  const resetBlock = source.match(/const reset = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/);
  assert(Boolean(resetBlock), 'reset sigue siendo un useCallback estable');
  assert(/clearCareerState\(\)/.test(resetBlock[0]), 'reset llama clearCareerState()');
  assert(/setState\(null\)/.test(resetBlock[0]), 'reset limpia el estado React (setState(null))');
  assert(!/setItem|removeItem|saveCareerState/.test(resetBlock[0]), 'reset no guarda ni toca storage directamente');

  for (const name of ['start', 'chooseYouthClub', 'advanceSeason', 'chooseAction', 'reset']) {
    assert(new RegExp(`const ${name} = useCallback`).test(source), `firma pública intacta: ${name} es useCallback`);
  }
}

console.log('== E.2) Idempotencia del round trip (base de la seguridad en StrictMode) ==');
{
  mock.clear();
  const state = newFlowState(pickPlayer('Tigre', 1), 4242, 'normal');
  assert(autosave(state).ok === true, 'E2) setup: carrera guardada');

  const first = restore();
  const second = restore();
  assert(first !== null && second !== null, 'E2) doble load devuelve carrera las dos veces');
  assert(json(first) === json(second), 'E2) doble load (StrictMode) → mismo estado: sin corrupción');
  assert(first !== second, 'E2) cada load devuelve un objeto nuevo (sin estado compartido mutado)');

  const rawBefore = mock.getItem(CAREER_SAVE_KEY);
  assert(autosave(first).ok === true, 'E2) re-guardar el estado restaurado es válido');
  const before = JSON.parse(rawBefore);
  const after = JSON.parse(mock.getItem(CAREER_SAVE_KEY));
  assert(json(after.state) === json(before.state), 'E2) re-save del estado restaurado no altera el payload (solo savedAt)');
  assert(json(loadCareerState()) === json(first), 'E2) el estado sigue cargable e idéntico tras el re-save');
  assert(json(state) === json(before.state), 'E2) el save no mutó el estado en memoria (saveCareerState clona)');

  // El hook nunca persiste "sin carrera": null y estados detenidos (start
  // inválido) los rechaza persistence antes de escribir → cero saves parciales.
  mock.clear();
  const stopped = flow.startCareer(null, {});
  assert(stopped.phase === 'stopped' && stopped.career === null, 'E2) setup: start inválido → estado detenido sin career');
  const stoppedSave = saveCareerState(stopped);
  assert(stoppedSave.ok === false && stoppedSave.reason === 'invalid_state',
    "E2) estado detenido → save rechazado ('invalid_state') sin lanzar");
  assert(saveCareerState(null).ok === false, 'E2) save(null) → ok:false sin lanzar');
  assert(mock.getItem(CAREER_SAVE_KEY) === null && loadCareerState() === null, 'E2) no quedó ningún save parcial');
  mock.clear();
}

// ============================================================================
// F) Robustez del entorno: sin storage / storage hostil (nunca rompe)
// ============================================================================
console.log('== F) Robustez: sin localStorage / storage que lanza ==');
{
  const memory = globalThis.localStorage;
  const debutState = newFlowState(pickPlayer('Gonzi'), 555, 'normal');
  const seasonState = flow.chooseYouthClub(debutState, debutState.youthOffers[0]);
  assert(seasonState.phase === 'season', 'F) setup: carrera en temporada (en memoria)');

  // 1) Sin localStorage (Node/iframe sandbox): nada lanza y la carrera sigue.
  delete globalThis.localStorage;
  assert(loadCareerState() === null, 'F) sin storage: load → null (el hook arranca sin carrera)');
  const saveNoStorage = saveCareerState(seasonState);
  assert(saveNoStorage.ok === false && saveNoStorage.reason === 'storage_unavailable',
    "F) sin storage: save → ok:false ('storage_unavailable') sin lanzar");
  const clearNoStorage = clearCareerState();
  assert(clearNoStorage.ok === false && clearNoStorage.reason === 'storage_unavailable',
    'F) sin storage: clear → ok:false sin lanzar');
  const advanced = flow.advanceSeason(seasonState, { seed: 9 });
  assert(advanced && advanced.career && ['season', 'event', 'decision'].includes(advanced.phase),
    'F) sin storage la carrera sigue avanzando en memoria (simulateSeason + checkpoint)');
  assert(renderHook().api.state === null, 'F) sin storage el hook se rendiriza igual (sin excepciones)');

  // 2) Storage que LANZA en todas sus operaciones: tampoco rompe.
  globalThis.localStorage = {
    getItem() { throw new Error('boom'); },
    setItem() { throw new Error('boom'); },
    removeItem() { throw new Error('boom'); },
  };
  assert(loadCareerState() === null, 'F) storage hostil: load → null sin propagar el error');
  assert(saveCareerState(seasonState).ok === false, 'F) storage hostil: save → ok:false sin propagar el error');
  assert(clearCareerState().ok === false, 'F) storage hostil: clear → ok:false sin propagar el error');
  assert(renderHook().api.state === null, 'F) storage hostil: el render no rompe');

  // 3) Storage recuperado: la persistencia vuelve a funcionar.
  globalThis.localStorage = memory;
  assert(saveCareerState(seasonState).ok === true, 'F) storage recuperado: save vuelve a funcionar');
  assert(restore() !== null, 'F) storage recuperado: load vuelve a funcionar');
  mock.clear();
}

// ============================================================================
// G) No regresión: smokes existentes de las capas tocadas por este paso
// ============================================================================
console.log('== G) No regresión: smoke-use-career + smoke-career-persistence ==');
{
  for (const rel of ['scripts/smoke-use-career.mjs', 'scripts/smoke-career-persistence.mjs']) {
    const result = spawnSync(process.execPath, [rel], { cwd: root, encoding: 'utf8' });
    assert(result.status === 0, `${rel} (exit ${result.status})`);
    if (result.status !== 0) {
      console.error(result.stdout || '');
      console.error(result.stderr || '');
    }
  }
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-use-career-persistence: TODO OK'
  : `\n❌ smoke-use-career-persistence: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;