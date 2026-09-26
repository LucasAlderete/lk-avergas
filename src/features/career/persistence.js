// ============================================================================
// PERSISTENCIA DEL NUEVO MODO CARRERA — persistence.js (Paso 9)
// ============================================================================
// Capa de persistencia AISLADA del nuevo Career Mode (flow.js + engine.js):
//
//   UI (App.jsx)  →  useCareer.js  →  persistence.js  →  flow.js  →  engine.js
//
// Reglas de este archivo:
// - SOLO serializa/deserializa y valida la forma del FLOW STATE completo (el
//   mismo objeto que useCareer expone como `state`). NO contiene lógica de
//   simulación: no toca OVR, no genera temporadas, no genera eventos, no
//   genera transferencias y no elige decisiones. Nada de eso vive acá.
// - ÚNICO lugar del nuevo career con acceso a localStorage. El acceso es
//   SIEMPRE perezoso vía globalThis.localStorage (nunca en el import del
//   módulo) y centralizado en storage(): así un entorno sin storage (Node,
//   iframes sandbox) degrada a "no hay save" sin lanzar.
// - Envelope de save con versiones EXPLÍCITAS:
//     { schemaVersion, worldVersion, savedAt, state }
//   schemaVersion es la de ESTA capa; worldVersion es el CAREER_WORLD_VERSION
//   real del mundo (data/careerWorld.js). Sin migraciones automáticas: si
//   cualquier versión no coincide, el save se rechaza (load → null).
// - La validación es estricta a propósito: un save roto NO debe contaminar al
//   engine. Valida la estructura fundamental (no cada propiedad visual):
//   fase válida, career presente con tipos/números finitos, club real del
//   mundo con su división coherente (o club null mientras la carrera espera
//   la elección de debut), arrays fundamentales, ofertas/evento
//   coherentes con la fase y coherencia retired/fase.
// - PURA por defecto: validate/serialize/deserialize no mutan lo recibido.
//   El único side effect permitido vive en saveCareerState/clearCareerState
//   (escribir/eliminar la clave de este modo). savedAt es la fecha del
//   GUARDADO (operación real de persistencia); la fecha de CREACIÓN de la
//   carrera sigue siendo career.snapshot.createdAt (la genera createCareer).
// - Nunca lanza hacia el caller: cualquier problema (JSON corrupto, envelope
//   inválido, versiones incompatibles, storage ausente) devuelve null o
//   { ok: false, reason } según la función.
// - Multi-carrera: NO todavía. UNA sola carrera persistida bajo la clave
//   CAREER_SAVE_KEY. Otras claves de la app ('avergas-career-v2' del Copero,
//   'avergas-history-v1', etc.) NUNCA se leen ni se eliminan desde acá.
// - RNG: el estado del flow NO guarda rng (el determinismo vive en el
//   options.seed de cada llamada). Este archivo lo garantiza: un state con
//   funciones/símbolos (ej. un rng colado) NO se serializa.
// ============================================================================

import { FLOW_PHASES } from './flow.js';

import {
  CAREER_WORLD_VERSION,
  findClub,
} from '../../data/careerWorld.js';

import {
  OVR,
  AGE,
  DIFFICULTIES,
} from './config.js';

// ============================================================================
// CLAVE + VERSIONES DEL SAVE
// ============================================================================

/** Clave EXCLUSIVA del nuevo Career Mode (no reutiliza 'avergas-career-v2',
 *  que pertenece al Copero). */
export const CAREER_SAVE_KEY = 'avergas-career-engine-v1';

/**
 * Versión del SCHEMA de esta capa. Si cambia el formato del envelope o la
 * validación de forma incompatible, sube y los saves viejos se rechazan.
 */
export const CAREER_SAVE_SCHEMA_VERSION = 1;

// ============================================================================
// ACCESO A STORAGE (único punto con localStorage de la capa)
// ============================================================================

/**
 * Devuelve el storage disponible o null (sin lanzar). El acceso es perezoso:
 * cada llamada resuelve el storage vigente, lo que permite que un entorno de
 * test sustituya globalThis.localStorage de forma controlada sin tocar
 * producción.
 */
function storage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls
      || typeof ls.getItem !== 'function'
      || typeof ls.setItem !== 'function'
      || typeof ls.removeItem !== 'function') return null;
    return ls;
  } catch {
    return null;
  }
}

// ============================================================================
// HELPERS PUROS DE FORMA
// ============================================================================

/** Número finito (rechaza NaN/Infinity: JSON.stringify los corrompería a null). */
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Entero finito dentro de [min, max] (inclusive). */
const isIntIn = (value, min, max) =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;

/** Ausente (null/undefined) u objeto plano (no array): la forma "opcional" de
 *  los campos que el engine agrega condicionalmente (createCareer NO setea
 *  lastSeasonReport/pendingTransfer/pendingOffers/offers; acceptTransfer los
 *  trata con "if (Array.isArray(...))": undefined es un valor legítimo). */
const isNullOrObject = (value) =>
  value == null || (typeof value === 'object' && !Array.isArray(value));

/** Ausente (null/undefined) o array: la forma "opcional en array". */
const isNullOrArray = (value) => value == null || Array.isArray(value);

/** Fases SALVABLES. 'stopped' NO se persiste: no tiene career (nada que
 *  restaurar) y la validación de career presente lo rechaza por diseño. */
const SAVABLE_PHASES = new Set([
  FLOW_PHASES.DEBUT,
  FLOW_PHASES.SEASON,
  FLOW_PHASES.EVENT,
  FLOW_PHASES.DECISION,
  FLOW_PHASES.TRANSFER,
  FLOW_PHASES.RETIRED,
]);

/** Atributos fundamentales de la career (createCareer/growthBias del engine). */
const ATTR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical'];

/** Arrays fundamentales de la career (siempre existen tras createCareer). */
const CAREER_ARRAY_KEYS = [
  'injuryHistory', 'trophies', 'achievements', 'clubHistory', 'seasonHistory', 'events',
];

/**
 * Escaneo profundo SIN mutar: recorre el valor y rechaza lo que JSON no puede
 * persistir sin corromperse:
 *   - números no finitos (NaN/Infinity) → JSON.stringify los vuelve null
 *   - funciones/símbolos/bigint → se pierden silenciosamente (ej. un RNG colado)
 *   - referencias circulares → JSON.stringify lanzaría
 * `undefined` se permite: JSON.stringify lo descarta sin corromper el resto.
 * Detecta ciclos por camino (path add/delete) para NO falsificar DAGs (un
 * mismo objeto referenciado dos veces, ej. un club en clubHistory y career).
 */
function deepScan(value, path) {
  if (value === null) return { ok: true };
  const type = typeof value;
  if (type === 'number') {
    return Number.isFinite(value) ? { ok: true } : { ok: false, reason: 'non_finite_number' };
  }
  if (type === 'string' || type === 'boolean' || type === 'undefined') return { ok: true };
  if (type === 'function' || type === 'symbol' || type === 'bigint') {
    return { ok: false, reason: 'non_serializable' };
  }
  if (path.has(value)) return { ok: false, reason: 'circular' };
  path.add(value);
  const entries = Array.isArray(value)
    ? value
    : Object.keys(value).map((key) => value[key]);
  for (const entry of entries) {
    const result = deepScan(entry, path);
    if (!result.ok) {
      path.delete(value);
      return result;
    }
  }
  path.delete(value);
  return { ok: true };
}

// ============================================================================
// VALIDACIÓN — validateCareerState(state) · PURA
// ============================================================================
// Suficientemente estricta para que un save roto no contamine al engine, sin
// validar cada propiedad visual. NO inventa campos: valida los del contrato
// real de flow.js (contrato de estado) y createCareer (engine.js).

/** Stats fundamentales de la career (pj/gls/ast/cleanSheets finitos + matches). */
function validStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return false;
  const numericOk = ['pj', 'gls', 'ast', 'cleanSheets']
    .every((key) => isFiniteNumber(stats[key]) && stats[key] >= 0);
  return numericOk && Array.isArray(stats.matches);
}

/** Oferta de cantera/mercado con la estructura real del engine (aceptable por
 *  acceptTransfer tras el round-trip): id + club del mundo + división/valor. */
function validOffer(offer) {
  if (!offer || typeof offer !== 'object' || Array.isArray(offer)) return false;
  if (typeof offer.id !== 'string' || !offer.id) return false;
  const club = offer.club;
  if (!club || typeof club !== 'object' || typeof club.slug !== 'string' || !club.slug) return false;
  const worldClub = findClub(club.slug);
  if (!worldClub) return false;
  if (!isFiniteNumber(offer.division) || offer.division !== worldClub.division) return false;
  if (!isFiniteNumber(offer.estimatedValue)) return false;
  return true;
}

/** currentEvent con la forma real de rollCareerEvent: { event, context }. */
function validCurrentEvent(currentEvent) {
  if (!currentEvent || typeof currentEvent !== 'object' || Array.isArray(currentEvent)) return false;
  const event = currentEvent.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
  if (!Array.isArray(event.choices) || event.choices.length === 0) return false;
  const choicesOk = event.choices.every(
    (choice) => choice && typeof choice === 'object' && typeof choice.id === 'string' && choice.id,
  );
  if (!choicesOk) return false;
  const context = currentEvent.context;
  return (context === null || context === undefined || typeof context === 'object');
}

/**
 * Valida el FLOW STATE completo (sin mutar nada).
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateCareerState(state) {
  // --- Flow state: objeto presente
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, reason: 'invalid_state' };
  }

  // --- Fase: una de las fases reales salvables
  const phase = state.phase;
  if (typeof phase !== 'string' || !SAVABLE_PHASES.has(phase)) {
    return { ok: false, reason: 'invalid_phase' };
  }

  // --- Career: presente y con estructura fundamental del engine
  const career = state.career;
  if (!career || typeof career !== 'object' || Array.isArray(career)) {
    return { ok: false, reason: 'missing_career' };
  }

  // Números y tipos fundamentales (los que el engine consume siempre).
  if (typeof career.retired !== 'boolean') return { ok: false, reason: 'invalid_retired' };
  if (!isIntIn(career.age, AGE.START, 99)) return { ok: false, reason: 'invalid_age' };
  if (!isIntIn(career.season, 1900, 2999)) return { ok: false, reason: 'invalid_season' };
  if (!isFiniteNumber(career.ovr) || career.ovr < OVR.MIN || career.ovr > OVR.MAX) {
    return { ok: false, reason: 'invalid_ovr' };
  }
  if (!isFiniteNumber(career.overallPeak)) return { ok: false, reason: 'invalid_number' };
  if (!isFiniteNumber(career.marketValue) || career.marketValue < 0) {
    return { ok: false, reason: 'invalid_number' };
  }
  if (!isIntIn(career.injuries, 0, 1e6)) return { ok: false, reason: 'invalid_number' };
  if (typeof career.name !== 'string' || !career.name) return { ok: false, reason: 'invalid_identity' };
  if (typeof career.playerId !== 'string' || !career.playerId) {
    return { ok: false, reason: 'invalid_identity' };
  }
  if (typeof career.position !== 'string' || !career.position) {
    return { ok: false, reason: 'invalid_position' };
  }
  if (typeof career.naturalPosition !== 'string' || !career.naturalPosition) {
    return { ok: false, reason: 'invalid_position' };
  }
  if (typeof career.role !== 'string' || !career.role) return { ok: false, reason: 'invalid_role' };

  // Dificultad + info de ritmo de checkpoints (flow consume seasonsPerDecision).
  if (typeof career.difficulty !== 'string' || !DIFFICULTIES[career.difficulty]) {
    return { ok: false, reason: 'invalid_difficulty' };
  }
  const difficultyInfo = career.difficultyInfo;
  if (!difficultyInfo || typeof difficultyInfo !== 'object'
    || difficultyInfo.id !== career.difficulty
    || !isIntIn(difficultyInfo.seasonsPerDecision, 1, 1e6)) {
    return { ok: false, reason: 'invalid_difficulty' };
  }

  // Snapshot de creación (generado por createCareer con Date.now()). NO se
  // modifica: solo se exige presente y con tipos fundamentales.
  const snapshot = career.snapshot;
  if (!snapshot || typeof snapshot !== 'object'
    || typeof snapshot.name !== 'string'
    || !isFiniteNumber(snapshot.createdAt)
    || !isFiniteNumber(snapshot.ratingSnapshot)
    || typeof snapshot.positionSnapshot !== 'string'
    || !snapshot.attrsSnapshot
    || typeof snapshot.attrsSnapshot !== 'object'
    || !ATTR_KEYS.every((key) => isFiniteNumber(snapshot.attrsSnapshot[key]))) {
    return { ok: false, reason: 'invalid_snapshot' };
  }

  // Atributos vigentes (roleMargin/growthBias los consumen).
  const attrs = career.attrs;
  if (!attrs || typeof attrs !== 'object'
    || !ATTR_KEYS.every((key) => isFiniteNumber(attrs[key]))) {
    return { ok: false, reason: 'invalid_attrs' };
  }

  // Stats + arrays fundamentales.
  if (!validStats(career.careerStats) || !validStats(career.seasonStats)) {
    return { ok: false, reason: 'invalid_stats' };
  }
  if (!CAREER_ARRAY_KEYS.every((key) => Array.isArray(career[key]))) {
    return { ok: false, reason: 'invalid_arrays' };
  }

  // Club: pertenece al mundo vigente y su división declarada coincide.
  // Excepción: club === null SOLO mientras la carrera espera la elección de
  // debut (las carreras nuevas nacen sin club); los saves viejos tienen club
  // y siguen pasando por la validación estricta de siempre.
  const club = career.club;
  if (club == null) {
    if (state.phase !== FLOW_PHASES.DEBUT) {
      return { ok: false, reason: 'invalid_club' };
    }
  } else if (typeof club !== 'object' || Array.isArray(club) || typeof club.slug !== 'string' || !club.slug) {
    return { ok: false, reason: 'invalid_club' };
  } else {
    const worldClub = findClub(club.slug);
    if (!worldClub) return { ok: false, reason: 'unknown_club' };
    if (!isFiniteNumber(club.division) || club.division !== worldClub.division) {
      return { ok: false, reason: 'club_division_mismatch' };
    }
  }

  // Campos opcionales de la career: null u objeto/array según corresponda.
  if (!isNullOrObject(career.pendingTransfer)
    || !isNullOrObject(career.lastDecision)
    || !isNullOrObject(career.lastSeasonReport)
    || !isNullOrArray(career.pendingOffers)
    || !isNullOrArray(career.offers)) {
    return { ok: false, reason: 'invalid_optional_field' };
  }

  // --- Campos del flow state (contrato de flow.js)
  if (!isNullOrArray(state.youthOffers) || !isNullOrArray(state.transferOffers)) {
    return { ok: false, reason: 'invalid_offers' };
  }
  if (Array.isArray(state.youthOffers) && !state.youthOffers.every(validOffer)) {
    return { ok: false, reason: 'invalid_offers' };
  }
  if (Array.isArray(state.transferOffers) && !state.transferOffers.every(validOffer)) {
    return { ok: false, reason: 'invalid_offers' };
  }
  if (!isNullOrObject(state.currentEvent)) return { ok: false, reason: 'invalid_current_event' };
  if (state.currentEvent !== null && !validCurrentEvent(state.currentEvent)) {
    return { ok: false, reason: 'invalid_current_event' };
  }
  if (!isNullOrObject(state.seasonReport)) return { ok: false, reason: 'invalid_season_report' };
  if (!isNullOrObject(state.lastAction)) return { ok: false, reason: 'invalid_last_action' };
  if (typeof state.retirementDue !== 'boolean') {
    return { ok: false, reason: 'invalid_retirement_due' };
  }
  if (!isIntIn(state.seasonsSinceDecision, 0, 1e6)) {
    return { ok: false, reason: 'invalid_seasons_since_decision' };
  }
  if (state.stoppedReason !== null && typeof state.stoppedReason !== 'string') {
    return { ok: false, reason: 'invalid_stopped_reason' };
  }
  // Aviso de títulos (registro de dedupe de la capa React): OPCIONAL — ausente
  // en saves legados — y, cuando existe, un array de ids string no vacíos.
  if (!isNullOrArray(state.celebratedTrophyIds)
    || (Array.isArray(state.celebratedTrophyIds)
      && !state.celebratedTrophyIds.every((id) => typeof id === 'string' && id))) {
    return { ok: false, reason: 'invalid_celebrated_trophy_ids' };
  }

  // --- Coherencia fase/estado (todo estado legítimo de flow la cumple):
  //     retired/fase alineados · ofertas y evento solo en su fase ·
  //     retirementDue solo posible en checkpoint (decision/event) o retired.
  if (career.retired === true && phase !== FLOW_PHASES.RETIRED) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (career.retired === false && phase === FLOW_PHASES.RETIRED) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase === FLOW_PHASES.DEBUT
    && !(Array.isArray(state.youthOffers) && state.youthOffers.length > 0)) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase !== FLOW_PHASES.DEBUT && state.youthOffers !== null) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase === FLOW_PHASES.TRANSFER
    && !(Array.isArray(state.transferOffers) && state.transferOffers.length > 0)) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase !== FLOW_PHASES.TRANSFER && state.transferOffers !== null) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase === FLOW_PHASES.EVENT && state.currentEvent === null) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if (phase !== FLOW_PHASES.EVENT && state.currentEvent !== null) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }
  if ((phase === FLOW_PHASES.DEBUT
    || phase === FLOW_PHASES.SEASON
    || phase === FLOW_PHASES.TRANSFER) && state.retirementDue !== false) {
    return { ok: false, reason: 'phase_state_mismatch' };
  }

  return { ok: true };
}

// ============================================================================
// SERIALIZACIÓN — serializeCareerState(state) · PURA
// ============================================================================

/**
 * Serializa el FLOW STATE a string JSON de forma segura: rechaza (sin lanzar)
 * estados con números no finitos, funciones/símbolos o referencias circulares.
 * NO muta el estado recibido.
 * @returns {{ ok: true, json: string } | { ok: false, reason: string }}
 */
export function serializeCareerState(state) {
  const scan = deepScan(state, new Set());
  if (!scan.ok) return { ok: false, reason: scan.reason };
  try {
    return { ok: true, json: JSON.stringify(state) };
  } catch {
    return { ok: false, reason: 'circular' };
  }
}

// ============================================================================
// SAVE — saveCareerState(state)
// ============================================================================

/**
 * Guarda el FLOW STATE completo bajo CAREER_SAVE_KEY.
 *
 * Pasos: validar → serializar → envelope { schemaVersion, worldVersion,
 * savedAt, state } → escribir. El `state` del envelope es un clon (el state
 * recibido jamás se muta ni se comparte). savedAt es la fecha del guardado
 * (NO se usa para lógica del engine).
 *
 * @returns {{ ok: true } | { ok: false, reason: string, detail?: string }}
 *   reason: 'invalid_state' (no se guarda basura) | 'non_serializable' |
 *   'circular' | 'non_finite_number' | 'storage_unavailable' | 'storage_error'
 */
export function saveCareerState(state) {
  const validity = validateCareerState(state);
  if (!validity.ok) return { ok: false, reason: 'invalid_state', detail: validity.reason };

  const serialized = serializeCareerState(state);
  if (!serialized.ok) return { ok: false, reason: serialized.reason };

  const ls = storage();
  if (!ls) return { ok: false, reason: 'storage_unavailable' };

  const envelope = {
    schemaVersion: CAREER_SAVE_SCHEMA_VERSION,
    worldVersion: CAREER_WORLD_VERSION,
    savedAt: Date.now(),
    state: JSON.parse(serialized.json), // clon profundo: cero refs compartidas
  };

  try {
    ls.setItem(CAREER_SAVE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'storage_error' };
  }
}

// ============================================================================
// DESERIALIZACIÓN — deserializeCareerState(raw) · PURA
// ============================================================================

/**
 * Valida un save crudo (string JSON) contra el envelope y el estado.
 * NUNCA lanza y NUNCA devuelve referencias mutables internas: el state del
 * resultado sale de un JSON.parse fresco (objeto nuevo, sin refs compartidas).
 *
 * @returns {{ ok: true, state: object } | { ok: false, reason: string }}
 *   reason: 'invalid_raw' | 'invalid_json' | 'invalid_envelope' |
 *   'schema_version' | 'world_version' | 'invalid_state' (+ detail)
 */
export function deserializeCareerState(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid_raw' };

  let envelope = null;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { ok: false, reason: 'invalid_envelope' };
  }

  // Versiones EXPLÍCITAS: sin migraciones automáticas. Un formato futuro o un
  // mundo distinto NO se adivinan: se rechazan.
  if (envelope.schemaVersion !== CAREER_SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: 'schema_version' };
  }
  if (envelope.worldVersion !== CAREER_WORLD_VERSION) {
    return { ok: false, reason: 'world_version' };
  }

  const validity = validateCareerState(envelope.state);
  if (!validity.ok) {
    return { ok: false, reason: 'invalid_state', detail: validity.reason };
  }

  // JSON.parse ya creó objetos nuevos: el state devuelto no comparte nada con
  // el raw ni con objetos internos de la app.
  return { ok: true, state: envelope.state };
}

// ============================================================================
// LOAD — loadCareerState()
// ============================================================================

/**
 * Lee el save vigente. Sin save / JSON roto / versión incompatible / estado
 * inválido → null (sin lanzar nunca hacia React). Con save válido → un NUEVO
 * flow state seguro (cero referencias compartidas).
 * @returns {object | null}
 */
export function loadCareerState() {
  const ls = storage();
  if (!ls) return null;

  let raw = null;
  try {
    raw = ls.getItem(CAREER_SAVE_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;

  const result = deserializeCareerState(raw);
  return result.ok ? result.state : null;
}

// ============================================================================
// CLEAR — clearCareerState()
// ============================================================================

/**
 * Elimina SOLO la clave de este modo (CAREER_SAVE_KEY). NUNCA toca otras
 * claves de la app ('avergas-career-v2' del Copero, 'avergas-history-v1',
 * 'avergas-player', 'avergas-screen', 'avergas-match-v1', 'avergas-lineup-v1',
 * 'avergas-injuries-v2', 'avergas-player-status-v1').
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function clearCareerState() {
  const ls = storage();
  if (!ls) return { ok: false, reason: 'storage_unavailable' };
  try {
    ls.removeItem(CAREER_SAVE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'storage_error' };
  }
}





