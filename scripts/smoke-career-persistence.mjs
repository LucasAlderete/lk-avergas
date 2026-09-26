// ============================================================================
// Smoke test de la capa de persistencia — persistence.js (Paso 9)
// Uso: node scripts/smoke-career-persistence.mjs
//
// Node NO tiene localStorage: este smoke crea un storage mock EN MEMORIA
// (getItem/setItem/removeItem + clear/key/length) y lo asigna a
// globalThis.localStorage ANTES de usar persistence.js. La capa resuelve el
// storage de forma perezosa en CADA llamada (storage() interno), así que la
// sustitución es controlada y NO requirió tocar producción.
//
// Cubre: importación/exports · save/load con envelope versionado · pureza ·
// referencia nueva sin shared refs · continuación del flow sobre el estado
// cargado (chooseYouthClub/advanceSeason/generateTransferOffers/
// chooseCareerAction) · rechazos (schema, world version, JSON corrupto, state
// inexistente, career incompleta, NaN/Infinity, club inexistente, división
// inconsistente) · clear selectivo · round trip con temporadas reales ·
// reemplazo de carrera (sin mezcla) · RNG/funciones/circular no persistibles.
// ============================================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERSISTENCE_REL = 'src/features/career/persistence.js';
const persistencePath = path.join(root, PERSISTENCE_REL);

// Recorrido recursivo: true si ningún número es NaN/Infinity.
const deepScanFinite = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (Array.isArray(v)) return v.every(deepScanFinite);
  return Object.values(v).every(deepScanFinite);
};

const json = (value) => JSON.stringify(value);

// ============================================================================
// Storage mock EN MEMORIA (getItem/setItem/removeItem — el mínimo pedido)
// ============================================================================
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

// Sustitución controlada del acceso que usa persistence.js
// (globalThis.localStorage resuelto perezosamente en cada llamada).
globalThis.localStorage = createMemoryStorage();
const mock = globalThis.localStorage;

// ============================================================================
// Imports reales del proyecto (flow → engine/events, persistence, mundo)
// ============================================================================
const flowUrl = pathToFileURL(path.join(root, 'src', 'features', 'career', 'flow.js')).href;
const persistenceUrl = pathToFileURL(persistencePath).href;
const worldUrl = pathToFileURL(path.join(root, 'src', 'data', 'careerWorld.js')).href;
const engineUrl = pathToFileURL(path.join(root, 'src', 'features', 'career', 'engine.js')).href;

const flow = await import(flowUrl);
const persistence = await import(persistenceUrl);
const world = await import(worldUrl);
const engine = await import(engineUrl);

const {
  CAREER_SAVE_KEY,
  CAREER_SAVE_SCHEMA_VERSION,
  saveCareerState,
  loadCareerState,
  clearCareerState,
  validateCareerState,
  serializeCareerState,
  deserializeCareerState,
} = persistence;

const pickPlayer = (name, fallbackIndex = 0) =>
  players.find((p) => p.name === name) || players[fallbackIndex % players.length];

/** Carrera REAL vía flow.startCareer (el mismo camino que recorre useCareer). */
function newFlowState(player, seed, difficulty = 'normal') {
  return flow.startCareer(JSON.parse(JSON.stringify(player)), { seed, difficulty });
}

/** Avanza por 'season' hasta un checkpoint de decisión (resolviendo eventos
 *  como lo hace la UI con chooseAction('choose_event_choice')). */
function advanceToDecision(state, seedBase = 9000) {
  let s = state;
  for (let i = 0; s && s.phase === 'season' && i < 60; i += 1) {
    s = flow.advanceSeason(s, { seed: seedBase + i });
    if (s && s.phase === 'event' && s.currentEvent && Array.isArray(s.currentEvent.event.choices)) {
      s = flow.chooseCareerAction(s, 'choose_event_choice', s.currentEvent.event.choices[0].id, { seed: seedBase + 500 + i });
    }
  }
  return s;
}

/** Arma un envelope crudo (string) con versiones válidas y un state dado. */
function rawEnvelope(state, overrides = {}) {
  return json({
    schemaVersion: CAREER_SAVE_SCHEMA_VERSION,
    worldVersion: world.CAREER_WORLD_VERSION,
    savedAt: Date.now(),
    state,
    ...overrides,
  });
}

// ============================================================================
// A) Importación + B) Exports
// ============================================================================
console.log('== A) Sintaxis e importación de persistence.js ==');
{
  const check = spawnSync(process.execPath, ['--check', PERSISTENCE_REL], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, `node --check ${PERSISTENCE_REL}`);
  if (check.status !== 0) console.error(check.stderr);
  assert(typeof persistence === 'object' && persistence !== null, 'persistence.js importa correctamente (ESM)');
}

console.log('== B) Exports públicos ==');
{
  assert(CAREER_SAVE_KEY === 'avergas-career-engine-v1', `CAREER_SAVE_KEY exclusiva (${CAREER_SAVE_KEY})`);
  assert(CAREER_SAVE_KEY !== 'avergas-career-v2', 'NO reutiliza la clave del Copero (avergas-career-v2)');
  assert(CAREER_SAVE_SCHEMA_VERSION === 1, `CAREER_SAVE_SCHEMA_VERSION === 1 (${CAREER_SAVE_SCHEMA_VERSION})`);
  assert(typeof saveCareerState === 'function', 'saveCareerState');
  assert(typeof loadCareerState === 'function', 'loadCareerState');
  assert(typeof clearCareerState === 'function', 'clearCareerState');
  assert(typeof validateCareerState === 'function', 'validateCareerState');
  assert(typeof serializeCareerState === 'function', 'serializeCareerState');
  assert(typeof deserializeCareerState === 'function', 'deserializeCareerState');

  // La capa solo serializa/valida: no importa el engine ni events (la lógica
  // de simulación NO vive acá) ni React (persistencia previa a integración).
  const source = fs.readFileSync(persistencePath, 'utf8');
  const sourceNoComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  assert(!/from\s+'\.\.?\/engine\.js'/.test(sourceNoComments), 'NO importa engine.js (solo serializa)');
  assert(!/from\s+'\.\/events\.js'/.test(sourceNoComments), 'NO importa events.js');
  assert(!/from\s+'react'/.test(sourceNoComments), 'NO importa React');
  assert(/globalThis\.localStorage/.test(sourceNoComments), 'localStorage accedido vía globalThis (sustituible)');
  assert(/'\.\.\/\.\.\/data\/careerWorld\.js'/.test(sourceNoComments), 'usa el mundo real (careerWorld.js)');
}

// ============================================================================
// C) Save válido (career REAL creada por flow) + envelope versionado
// ============================================================================
console.log('== C) Save válido + envelope ==');
const playerA = pickPlayer('Gonzi', 0);
let stateA = newFlowState(playerA, 2026, 'normal');
assert(stateA && stateA.phase === 'debut' && Array.isArray(stateA.youthOffers), 'flow.startCareer → phase "debut" con ofertas');
assert(stateA.career.club === null, 'la carrera nueva nace SIN club (club = null: lo elige el debut)');
const snapshotA = json(stateA);
{
  const result = saveCareerState(stateA);
  assert(result && result.ok === true, 'saveCareerState → { ok: true }');

  const raw = mock.getItem(CAREER_SAVE_KEY);
  assert(typeof raw === 'string' && raw.length > 0, 'el save existe en la clave exclusiva');
  const envelope = JSON.parse(raw);
  assert(envelope.schemaVersion === 1, 'envelope.schemaVersion === 1');
  assert(envelope.worldVersion === world.CAREER_WORLD_VERSION, `envelope.worldVersion === CAREER_WORLD_VERSION (${world.CAREER_WORLD_VERSION})`);
  assert(Number.isFinite(envelope.savedAt) && envelope.savedAt <= Date.now(), 'envelope.savedAt (fecha del guardado)');
  assert(envelope.state && typeof envelope.state === 'object', 'envelope.state presente');
  assert(json(envelope.state) === snapshotA, 'envelope.state === FLOW STATE completo (no solo career)');
  assert(envelope.state.career && typeof envelope.state.career === 'object', 'el state persistido incluye career');
  assert(!/rng/.test(Object.keys(envelope.state).join()), 'sin RNG en el envelope (el estado del flow no guarda rng)');
}

// ============================================================================
// D) Load equivalente + E) Pureza + F) Referencias nuevas
// ============================================================================
console.log('== D/E/F) Load, pureza y referencias ==');
{
  const loaded = loadCareerState();
  assert(loaded && loaded.phase === 'debut', 'loadCareerState → phase "debut" restaurada');
  assert(json(loaded) === snapshotA, 'load === save (estado completo equivalente)');
  assert(json(stateA) === snapshotA, 'E) pureza: el state original NO cambió al guardar/cargar');

  assert(loaded !== stateA, 'F) objeto nuevo (no es la misma referencia)');
  assert(loaded.career !== stateA.career, 'F) career nueva (sin refs compartidas)');
  assert(loaded.youthOffers !== stateA.youthOffers, 'F) arrays nuevos (sin refs compartidas)');

  // Mutación profunda del clon: el original queda intacto.
  // (En debut la carrera no tiene club: la mutación se hace sobre el campo.)
  assert(loaded.career.club === null, 'F) el clon cargado conserva el debut sin club');
  loaded.career.ovr = 1;
  loaded.career.events.push({ season: 1, type: 'test', message: 'x' });
  loaded.youthOffers = null;
  loaded.career.club = { slug: 'mutado' };
  assert(json(stateA) === snapshotA, 'F) mutar el cargado NO toca el original');
}

// ============================================================================
// G) Continuación del flow sobre el estado CARGADO
// ============================================================================
console.log('== G) Continuación sobre el state cargado ==');
{
  let s = loadCareerState();
  assert(s && s.phase === 'debut', 'cargado en debut');

  // chooseYouthClub sobre el cargado: la oferta (copia JSON) la resuelve el engine.
  const chosen = s.youthOffers[0];
  s = flow.chooseYouthClub(s, chosen);
  assert(s && s.phase === 'season' && s.lastAction.ok === true, 'chooseYouthClub(cargado) → phase "season" (ok)');
  assert(s.career.club && s.career.club.slug === chosen.club.slug, 'club vigente = oferta elegida (post-load)');

  // advanceSeason sobre el cargado (resolviendo eventos si aparecen).
  s = advanceToDecision(s, 3000);
  assert(s && s.phase === 'decision', 'advanceSeason(cargado) → decisión');

  // generateTransferOffers (engine puro) sobre la career CARGADA.
  const careerSnapshot = json(s.career);
  const engineOffers = engine.generateTransferOffers(s.career, { seed: 4242 });
  assert(Array.isArray(engineOffers) && engineOffers.length > 0, 'generateTransferOffers(cargado) → ofertas');
  assert(json(s.career) === careerSnapshot, 'generateTransferOffers NO muta la career cargada');

  // Mercado vía flow: abrir → aceptar → seguir.
  s = flow.chooseCareerAction(s, 'transfer', null, { seed: 5151 });
  assert(s && s.phase === 'transfer' && Array.isArray(s.transferOffers) && s.transferOffers.length > 0,
    "chooseCareerAction('transfer') sobre cargado → mercado abierto");
  const offerId = s.transferOffers[0].id;
  const clubBefore = s.career.club.slug;
  s = flow.chooseCareerAction(s, 'transfer', offerId, { seed: 6161 });
  assert(s && s.phase === 'season' && s.lastAction.ok === true, "chooseCareerAction('transfer', oferta) → traspaso aceptado (post-load)");
  assert(s.career.club.slug !== clubBefore, 'el club cambió vía acceptTransfer sobre el estado cargado');

  // Y la cadena sigue: otra decisión + stay.
  s = advanceToDecision(s, 7000);
  s = flow.chooseCareerAction(s, 'stay', null, { seed: 7777 });
  assert(s && s.phase === 'season' && s.lastAction.ok === true, "chooseCareerAction('stay') sobre cargado → ok");
  assert(deepScanFinite(s), 'sin NaN/Infinity tras continuar el flow sobre el cargado');
}

// ============================================================================
// H) Schema incorrecto · I) World version incorrecta · J) JSON corrupto
// ============================================================================
console.log('== H/I/J) Rechazos por versiones y JSON corrupto ==');
{
  const goodRaw = mock.getItem(CAREER_SAVE_KEY);

  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(stateA, { schemaVersion: 999 }));
  assert(loadCareerState() === null, 'H) schemaVersion 999 → null (sin adivinar formatos)');
  assert(deserializeCareerState(mock.getItem(CAREER_SAVE_KEY)).reason === 'schema_version', "H) reason 'schema_version'");

  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(stateA, { worldVersion: 999 }));
  assert(loadCareerState() === null, 'I) worldVersion incompatible → null (sin migración automática)');
  assert(deserializeCareerState(mock.getItem(CAREER_SAVE_KEY)).reason === 'world_version', "I) reason 'world_version'");

  mock.setItem(CAREER_SAVE_KEY, '{esto no es json');
  assert(loadCareerState() === null, 'J) JSON inválido → null sin lanzar');

  mock.setItem(CAREER_SAVE_KEY, 'null');
  assert(loadCareerState() === null, "J) JSON 'null' → null (envelope inválido)");

  mock.setItem(CAREER_SAVE_KEY, '[1, 2, 3]');
  assert(loadCareerState() === null, 'J) JSON array → null (envelope inválido)');

  mock.setItem(CAREER_SAVE_KEY, '"un string"');
  assert(loadCareerState() === null, 'J) JSON string → null (envelope inválido)');

  mock.setItem(CAREER_SAVE_KEY, goodRaw);
  assert(loadCareerState() !== null, 'restaurado el save válido tras los rechazos');
}

// ============================================================================
// K) State inexistente · L) Career incompleta
// ============================================================================
console.log('== K/L) Rechazos por estructura ==');
{
  const goodRaw = mock.getItem(CAREER_SAVE_KEY);

  mock.setItem(CAREER_SAVE_KEY, json({ schemaVersion: 1, worldVersion: world.CAREER_WORLD_VERSION, savedAt: Date.now() }));
  assert(loadCareerState() === null, 'K) envelope sin state → null');

  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(null));
  assert(loadCareerState() === null, 'K) state null → null');

  mock.setItem(CAREER_SAVE_KEY, rawEnvelope({ phase: 'season', career: { ovr: 50, retired: false } }));
  assert(loadCareerState() === null, 'L) career incompleta → null (estructura corrupta)');

  // Un estado 'stopped' (sin career) NO es salvable: nada que restaurar.
  mock.setItem(CAREER_SAVE_KEY, goodRaw);
  const stopped = flow.startCareer(null, {});
  assert(stopped && stopped.phase === 'stopped' && stopped.career === null, 'flow.startCareer(null) → estado stopped sin career');
  const saveStopped = saveCareerState(stopped);
  assert(saveStopped.ok === false && saveStopped.reason === 'invalid_state', "stopped NO se guarda (reason 'invalid_state')");
  assert(mock.getItem(CAREER_SAVE_KEY) === goodRaw, 'el save previo queda intacto tras un save rechazado');
}

// ============================================================================
// M) NaN/Infinity + no serializables (funciones/RNG/circular)
// ============================================================================
console.log('== M) NaN/Infinity/RNG/circular ==');
{
  const goodRaw = mock.getItem(CAREER_SAVE_KEY);

  const nanState = JSON.parse(json(stateA));
  nanState.career.ovr = NaN;
  const resNan = saveCareerState(nanState);
  assert(resNan.ok === false && resNan.reason === 'invalid_state', 'M) ovr NaN → save rechazado (no se guarda basura)');
  assert(mock.getItem(CAREER_SAVE_KEY) === goodRaw, 'M) NaN: el save previo NO fue sobrescrito');

  const infState = JSON.parse(json(stateA));
  infState.career.age = Infinity;
  assert(saveCareerState(infState).ok === false, 'M) age Infinity → save rechazado');

  // Load-side: en JSON los NaN viajan como null → el save se rechaza igual.
  const nullified = JSON.parse(json(stateA));
  nullified.career.season = null; // lo que dejaría JSON.stringify(NaN)
  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(nullified));
  assert(loadCareerState() === null, 'M) load: número fundamental null (NaN en JSON) → null');

  // RNG colado: una función nunca debe persistirse.
  const rngInjected = JSON.parse(json(stateA));
  rngInjected.career.rng = { next: () => 0.5 };
  const resRng = saveCareerState(rngInjected);
  assert(resRng.ok === false && resRng.reason === 'non_serializable', 'M) RNG/función en el state → NO se persiste');

  // Referencia circular.
  const circular = JSON.parse(json(stateA));
  circular.career.selfRef = circular.career;
  const resCircular = saveCareerState(circular);
  assert(resCircular.ok === false && resCircular.reason === 'circular', 'M) referencia circular → rechazo sin lanzar');

  mock.setItem(CAREER_SAVE_KEY, goodRaw);
}

// ============================================================================
// N) Club inexistente · N2) Sin club fuera del debut · O) División inconsistente
// ============================================================================
console.log('== N/N2/O) Mundo inconsistente ==');
{
  const goodRaw = mock.getItem(CAREER_SAVE_KEY);

  // Base CON club real: la validación estricta del club solo aplica cuando la
  // carrera ya tiene club (las carreras nuevas en debut nacen con club = null:
  // el jugador lo elige al firmar su primer contrato). Se arma con el flow,
  // igual que en la partida real.
  const debutBase = newFlowState(playerA, 4321, 'normal');
  const withClub = flow.chooseYouthClub(debutBase, debutBase.youthOffers[0]);
  assert(withClub.phase === 'season' && Boolean(withClub.career.club),
    'N/N2/O) base: carrera en temporada con club real elegido');

  // N) club que NO pertenece al careerWorld.
  const ghost = JSON.parse(json(withClub));
  ghost.career.club = { ...ghost.career.club, slug: 'club-fantasma' };
  const resGhost = saveCareerState(ghost);
  assert(resGhost.ok === false && resGhost.reason === 'invalid_state'
    && resGhost.detail === 'unknown_club', "N) club inexistente → save rechazado ('unknown_club')");
  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(ghost));
  assert(loadCareerState() === null, 'N) club inexistente → load null');

  // N2) club === null es válido SOLO en el checkpoint de debut.
  const noClub = JSON.parse(json(withClub));
  noClub.career.club = null;
  const resNoClub = saveCareerState(noClub);
  assert(resNoClub.ok === false && resNoClub.reason === 'invalid_state' && resNoClub.detail === 'invalid_club',
    "N2) sin club fuera del debut → save rechazado ('invalid_club')");
  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(noClub));
  assert(loadCareerState() === null, 'N2) sin club fuera del debut → load null');

  // O) división declarada que no coincide con el club del mundo.
  const realSlug = withClub.career.club.slug;
  const worldDivision = world.findClub(realSlug).division;
  const wrongDiv = JSON.parse(json(withClub));
  wrongDiv.career.club.division = worldDivision === 1 ? 2 : 1;
  const resDiv = saveCareerState(wrongDiv);
  assert(resDiv.ok === false && resDiv.detail === 'club_division_mismatch', "O) división ≠ club → save rechazado ('club_division_mismatch')");
  mock.setItem(CAREER_SAVE_KEY, rawEnvelope(wrongDiv));
  assert(loadCareerState() === null, 'O) división inconsistente → load null');

  mock.setItem(CAREER_SAVE_KEY, goodRaw);
}

// ============================================================================
// P) Clear selectivo + Q) No tocar otros saves
// ============================================================================
console.log('== P/Q) Clear ==');
{
  assert(saveCareerState(stateA).ok === true, 'save previo al clear');
  assert(loadCareerState() !== null, 'load previo al clear');

  mock.setItem('avergas-career-v2', json({ copero: true }));
  mock.setItem('avergas-history-v1', json([{ season: 2026 }]));
  mock.setItem('avergas-player', json({ name: 'Gonzi' }));
  const coperoRaw = mock.getItem('avergas-career-v2');
  const historyRaw = mock.getItem('avergas-history-v1');
  const playerRaw = mock.getItem('avergas-player');

  const cleared = clearCareerState();
  assert(cleared && cleared.ok === true, 'clearCareerState → { ok: true }');
  assert(mock.getItem(CAREER_SAVE_KEY) === null, 'P) save del nuevo career eliminado');
  assert(loadCareerState() === null, 'P) load tras clear → null');

  assert(mock.getItem('avergas-career-v2') === coperoRaw, 'Q) avergas-career-v2 (Copero) INTACTA');
  assert(mock.getItem('avergas-history-v1') === historyRaw, 'Q) avergas-history-v1 INTACTA');
  assert(mock.getItem('avergas-player') === playerRaw, 'Q) avergas-player INTACTA');
}

// ============================================================================
// R) Round trip con temporadas reales + S) Varias carreras en secuencia
// ============================================================================
console.log('== R) Round trip: temporadas + transferencia + re-save ==');
{
  // Carrera real, elegido su club, temporadas simuladas y un traspaso.
  let s = newFlowState(playerA, 8181, 'normal');
  s = flow.chooseYouthClub(s, s.youthOffers[0]);
  assert(s && s.phase === 'season', 'R) debut elegido');

  s = advanceToDecision(s, 8200);
  assert(s && s.phase === 'decision', 'R) primera decisión');

  s = flow.chooseCareerAction(s, 'transfer', null, { seed: 8300 });
  assert(s && s.phase === 'transfer' && s.lastAction.ok === true, 'R) mercado abierto');
  s = flow.chooseCareerAction(s, 'transfer', s.transferOffers[0].id, { seed: 8400 });
  assert(s && s.phase === 'season' && s.lastAction.ok === true, 'R) traspaso aceptado');

  s = advanceToDecision(s, 8500);
  s = flow.chooseCareerAction(s, 'stay', null, { seed: 8600 });
  assert(s && s.phase === 'season' && s.lastAction.ok === true, 'R) stay resuelto');

  const snapshotR = json(s);
  assert(saveCareerState(s).ok === true, 'R) save del flow state avanzado');
  const loadedR = loadCareerState();
  assert(loadedR && json(loadedR) === snapshotR, 'R) round trip: cargado === guardado (flow state completo)');

  // Y el estado re-cargado sigue siendo operable por el flow.
  const nextR = advanceToDecision(loadedR, 8700);
  assert(nextR && (nextR.phase === 'decision' || nextR.phase === 'retired'), 'R) flow continúa sobre el estado re-cargado');
}

console.log('== S) Varias carreras en secuencia (sin mezcla) ==');
{
  const playerB = pickPlayer('Tigre', 1);
  const stateB1 = newFlowState(playerA, 9999, 'normal');
  saveCareerState(stateB1);
  const firstLoaded = loadCareerState();
  assert(firstLoaded && json(firstLoaded) === json(stateB1), 'S) primera carrera cargada completa');

  const stateB2 = newFlowState(playerB, 5555, 'intensa');
  saveCareerState(stateB2);
  const secondLoaded = loadCareerState();

  assert(secondLoaded && json(secondLoaded) === json(stateB2), 'S) se obtiene la SEGUNDA carrera (no una mezcla)');
  assert(secondLoaded.career.playerId !== firstLoaded.career.playerId, 'S) playerId corresponde a la segunda carrera');
  assert(json(secondLoaded) !== json(firstLoaded), 'S) no es el save anterior reciclado');
  assert(secondLoaded.career.snapshot.name === playerB.name, 'S) snapshot corresponde a la segunda carrera');
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-career-persistence: TODO OK'
  : `\n❌ smoke-career-persistence: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;





