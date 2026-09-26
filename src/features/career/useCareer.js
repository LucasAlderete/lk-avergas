// ============================================================================
// CAPA REACT DEL MODO CARRERA — useCareer.js (Pasos 7 + 10)
// ============================================================================
// Hook que consume flow.js (orquestador puro) y persistence.js desde React:
//
//   React (useCareer)  →  persistence.js  (restaurar / autosave / borrar save)
//                      →  flow.js  →  engine.js / events.js
//
// Reglas de este archivo:
// - SOLO lógica de React: guarda el flow state en useState, delega cada acción
//   a flow.js y delega leer/guardar/borrar a persistence.js. NO duplica nada:
//   createCareer, simulateSeason, transferencias, stay, retiro, eventos,
//   simulación, validación, serialización ni storage viven acá: acá se llaman.
// - TEMPORADA AUTOMÁTICA: la fase 'season' es de tránsito del motor y nunca
//   espera un clic. Tras crear la carrera, tras elegir el club de debut y
//   tras cada decisión (stay/transfer), advanceToCheckpoint() repite
//   flow.advanceSeason hasta el próximo checkpoint (evento / decisión /
//   retiro): la UI no necesita —ni expone— ningún botón de avance manual.
// - Sin storage propio: este archivo NO menciona localStorage /
//   sessionStorage / IndexedDB / window / document. La única puerta al save es
//   persistence.js (que tampoco toca claves de otras capas).
// - Estado inicial null: el hook NO crea carreras de un jugador arbitrario.
//   La carrera empieza cuando la UI llama explícitamente start(player,
//   options?) o cuando hay una carrera persistida válida (restauración).
//   flow.startCareer se encarga de las validaciones.
// - Restauración (Paso 10): loadCareerState() se llama DENTRO de un useEffect
//   de montaje (nunca durante el render) con guarda por ref, así que corre UNA
//   sola vez por montaje real aunque StrictMode monte/desmonte/remonte en dev.
//   Sin save / save corrupto / schema o mundo incompatible → null → el hook
//   arranca sin carrera, sin lanzar excepciones.
// - Autosave (Paso 10): todo cambio del flow state de una carrera activa se
//   persiste COMPLETO (career + fase + ofertas + evento + reporte +
//   seasonsSinceDecision + stoppedReason + lastAction) con saveCareerState().
//   Sin career (sin carrera o estado detenido) no se escribe nada. El estado
//   recién restaurado no se reescribe: ya está en storage. saveCareerState
//   valida y clona; si devuelve ok:false la carrera sigue en memoria.
// - AVISO DE TÍTULOS (overlay temporal, sin fase nueva): los helpers puros
//   exportados (trophyCelebrationId / pendingTrophyToasts /
//   withCelebratedTrophyIds / baselineCelebratedTrophyIds) solo diff-ean
//   career.trophies (lo que ya genera el engine) contra celebratedTrophyIds
//   (campo del flow state que persistence.js guarda con el save). No calculan
//   títulos, no agregan estados al flow y no requieren acción del jugador.
// - Seguro para render: si state === null, los derivados exponen null/[]
//   (nunca se accede a state.career sin guarda) y el primer render no
//   genera errores.
// - Errores: no lanza excepciones ni inventa un sistema de errores paralelo.
//   Si flow devuelve un estado rechazado (lastAction.ok === false), ese
//   estado se mantiene y queda expuesto en lastAction para que la UI decida
//   cómo mostrarlo.
// - StrictMode: los updaters funcionales pueden invocarse dos veces en dev;
//   flow.js es puro, así que no hay efectos colaterales. Los efectos de
//   restauración/autosave son idempotentes (cargar dos veces el mismo save no
//   corrompe nada y guardar no modifica el estado) y el de autosave NUNCA
//   llama a setState: sin ciclo load → save → load. Para trayectorias
//   reproducibles, la UI puede pasar { seed } en cada acción (el rng lo
//   resuelve flow.js: options.rng → options.seed → default).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  startCareer as flowStartCareer,
  chooseYouthClub as flowChooseYouthClub,
  advanceSeason as flowAdvanceSeason,
  chooseCareerAction as flowChooseCareerAction,
  getCareerDecisionOptions as flowGetCareerDecisionOptions,
  FLOW_PHASES,
} from './flow.js';

import {
  saveCareerState,
  loadCareerState,
  clearCareerState,
} from './persistence.js';

/** Clon defensivo del player: el engine/flow jamás muta el original y esta
 *  capa lo garantiza por contrato (los players de data.js son JSON puro). */
function clonePlayer(player) {
  if (!player || typeof player !== 'object') return player;
  return JSON.parse(JSON.stringify(player));
}

/** Las ofertas que expone el flow son array o null: acá siempre array. */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

/** Normaliza options sin inventar nada: pasa limpio a flow. */
function safeOptions(options) {
  return (options && typeof options === 'object') ? { ...options } : {};
}

// ---------------------------------------------------------------------------
// AVISO TEMPORAL DE TÍTULOS — helpers puros (exportados para los smoke tests)
// ---------------------------------------------------------------------------
// El engine ya registra cada título en career.trophies (rollSeasonTrophies vía
// simulateSeason): acá NO se calcula nada. Solo se diff-ean esos títulos contra
// celebratedTrophyIds (flow state persistido) para saber cuáles falta avisar,
// una sola vez por título y sin repetirlos al re-renderizar o recargar el save.
// ---------------------------------------------------------------------------

/** Id estable de un título del engine para el registro de avisos. */
export function trophyCelebrationId(trophy) {
  const season = trophy && Number.isFinite(trophy.season) ? trophy.season : 'x';
  const type = (trophy && trophy.type) || 'title';
  const club = (trophy && (trophy.clubKey || trophy.clubName)) || 'club';
  return `${season}:${type}:${club}`;
}

/**
 * Títulos del estado que todavía NO fueron avisados, en orden del engine.
 *
 * - Sin carrera → [] (nada que avisar).
 * - Save legado (celebratedTrophyIds ausente/null) → null: la capa React en ese
 *   caso siembra el registro con los títulos ya existentes (sin mostrarlos) para
 *   no repetir avisos históricos al actualizar el juego.
 */
export function pendingTrophyToasts(state) {
  if (!state || !state.career) return [];
  const registry = state.celebratedTrophyIds;
  if (registry == null) return null;
  const celebrated = new Set(registry);
  const trophies = Array.isArray(state.career.trophies) ? state.career.trophies : [];
  return trophies.filter((trophy) => trophy && !celebrated.has(trophyCelebrationId(trophy)));
}

/** Nuevo flow state con `ids` sumadas al registro (unión sin duplicados;
 *  toca SOLO celebratedTrophyIds y devuelve el mismo estado si no cambia). */
export function withCelebratedTrophyIds(state, ids) {
  if (!state || !state.career) return state;
  const current = Array.isArray(state.celebratedTrophyIds) ? state.celebratedTrophyIds : [];
  const known = new Set(current);
  const merged = current.slice();
  for (const id of ids) {
    if (typeof id === 'string' && id && !known.has(id)) {
      known.add(id);
      merged.push(id);
    }
  }
  if (merged.length === current.length && Array.isArray(state.celebratedTrophyIds)) return state;
  return { ...state, celebratedTrophyIds: merged };
}

/** Siembra del registro para saves legados: TODOS los títulos actuales pasan
 *  a considerar ya avisados (no se encola ninguno). Idempotente: si el
 *  registro ya existe no toca nada. */
export function baselineCelebratedTrophyIds(state) {
  if (!state || !state.career) return state;
  if (state.celebratedTrophyIds != null) return state;
  const trophies = Array.isArray(state.career.trophies) ? state.career.trophies : [];
  return withCelebratedTrophyIds(state, trophies.map(trophyCelebrationId));
}

/**
 * Simula temporadas automáticamente hasta el próximo checkpoint del flow
 * (evento, decisión o retiro): la fase 'season' es de tránsito y el jugador
 * nunca tiene que clickear para que el motor juegue. Delega 100% en
 * flow.advanceSeason (la lógica vive en flow/engine); este bucle solo repite
 * la llamada mientras el estado siga en 'season', con tope de seguridad (el
 * config máx. seasonsPerDecision es 4 y el retiro/estado detenido salen del
 * loop por fase). Pasado el primer paso solo continúa un rng inyectado (el
 * mismo objeto entre llamadas, contrato del flow); un seed suelto alimenta
 * únicamente la primera temporada para no repetir la misma tirada en cada
 * vuelta. Estados sin carrera o ya en otra fase vuelven intactos.
 */
function advanceToCheckpoint(state, options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  let current = state;
  let stepOptions = opts;
  for (let step = 0; step < 16; step += 1) {
    if (!current || current.phase !== FLOW_PHASES.SEASON) break;
    if (!current.career || current.career.retired === true) break;
    current = flowAdvanceSeason(current, stepOptions);
    stepOptions = opts.rng ? { rng: opts.rng } : {};
  }
  return current;
}

/**
 * Hook del nuevo modo carrera. API:
 *
 *   const {
 *     state,            // flow state crudo de flow.js | null (lo que se persiste)
 *     phase,            // FLOW_PHASES vigente | null (null = sin carrera)
 *     career,           // career del engine | null (nunca se toca directo)
 *     youthOffers,      // ofertas de debut | [] (solo phase 'debut')
 *     transferOffers,   // ofertas del mercado | [] (solo phase 'transfer')
 *     currentEvent,     // { event, context } | null (solo phase 'event')
 *     seasonReport,     // reporte de la última temporada | null
 *     lastAction,       // { action, ok, reason?, ... } | null
 *     stoppedReason,    // null | 'retirement' | 'invalid_state' | 'invalid_player'
 *     retirementDue,    // retiro obligatorio pendiente de la acción 'retire'
 *     decisionOptions,  // getCareerDecisionOptions(state) → ['stay', ...]
 *     trophyToasts,     // títulos detectados pendientes de avisar (overlay)
 *     clearTrophyToasts,// () → vacía la cola del overlay (idempotente)
 *     hasCareer,        // hay career utilizable para render
 *     isRetired,        // phase === 'retired'
 *     isStopped,        // phase === 'stopped' (start inválido)
 *     start,            // (player, options?) → inicia la carrera
 *     chooseYouthClub,  // (offer) → acepta la oferta de debut y deja la
 *                       //   carrera en el próximo checkpoint (automático)
 *     chooseYouthClubAndStart, // (offer, options?) → lo mismo con rng/seed
 *     advanceSeason,    // (options?) → simula hasta el próximo checkpoint
 *     chooseAction,     // (action, payload?, options?) → acción de flow
 *     reset,            // () → vuelve al estado inicial (null) + borra el save
 *   } = useCareer();
 *
 * Persistencia: al montar intenta restaurar la carrera guardada
 * (loadCareerState); cada cambio del flow state con career se guarda completo
 * (saveCareerState); reset() además elimina el save (clearCareerState). Este
 * hook NUNCA toca storage por su cuenta.
 */
export function useCareer() {
  // Estado inicial: null → "sin carrera". La carrera nace con start() o con la
  // restauración del save (efecto de montaje de abajo), nunca en el render.
  const [state, setState] = useState(null);
  // Cola VISUAL del aviso temporal de títulos (peso cero en el flow): los ya
  // detectados que faltan mostrar. El registro de "ya vistos" vive en el flow
  // state (celebratedTrophyIds) y viaja en el save con el autosave de siempre.
  const [trophyToasts, setTrophyToasts] = useState([]);

  // ---------------------------------------------------------------------------
  // Guardas de montaje (refs: sobreviven al remonte simulado de StrictMode y no
  // provocan renders extra).
  //   hydrationRef → la restauración corre UNA vez por montaje real.
  //   restoredRef  → flow state que vino del save: ya está persistido, así que
  //                  el autosave no lo reescribe (sin write redundante en el
  //                  primer commit y sin posibilidad de ciclo load → save).
  // ---------------------------------------------------------------------------
  const hydrationRef = useRef(false);
  const restoredRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Restauración (montaje): loadCareerState() ya con el componente montado,
  // jamás durante el render. Orden importante: este efecto va ANTES del de
  // autosave para que el estado restaurado exista antes de cualquier guardado.
  // loadCareerState() devuelve null ante ausencia de save, JSON corrupto,
  // schema/mundo incompatible o storage ausente: los cuatro casos son "sin
  // carrera" y ninguno lanza (acá tampoco se lanza).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hydrationRef.current) return; // ya restaurado en este montaje
    hydrationRef.current = true;

    let restored = null;
    try {
      restored = loadCareerState();
    } catch {
      restored = null; // defensa extra: un storage hostil no rompe la carrera
    }

    // Sin carrera restaurable (o resto inválido): se arranca sin carrera.
    if (!restored || typeof restored !== 'object' || !restored.career) return;

    // Un save atascado en 'season' (guardado entre temporadas con el flujo
    // manual) retoma el ciclo automáticamente: misma regla que en cada
    // acción. Si la fase no es 'season', advanceToCheckpoint devuelve el
    // mismo objeto y el autosave de abajo no reescribe el save.
    restoredRef.current = restored;
    setState(advanceToCheckpoint(restored));
  }, []);

  // ---------------------------------------------------------------------------
  // Autosave: cada cambio del flow state de una carrera activa se persiste
  // COMPLETO (saveCareerState valida y clona: career, phase, youthOffers,
  // transferOffers, currentEvent, seasonReport, retirementDue,
  // seasonsSinceDecision, stoppedReason, lastAction). Sin career no se escribe
  // nada → nunca se crea un save parcial. Si el guardado falla (ok:false,
  // storage ausente) la carrera continúa en memoria y la UI no se entera.
  // Este efecto NO llama a setState y NO crea saves: save no puede
  // re-dispararse a sí mismo (sin loop).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!state || !state.career) return;
    if (state === restoredRef.current) return; // ya está en storage (vino de ahí)

    try {
      saveCareerState(state);
    } catch {
      // Best-effort: la persistencia nunca rompe la carrera en memoria.
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Aviso temporal de títulos: capa visual SIN fase nueva ni acción del jugador.
  // Detección = career.trophies (engine) − celebratedTrophyIds (save):
  //   · sin títulos → no encola nada;
  //   · títulos nuevos → se encolan UNA vez y se registran YA (un re-render o
  //     un reload posterior no los repite; el autosave de arriba persiste el
  //     registro junto con el resto del flow state);
  //   · save legado (sin registro) → siembra el histórico sin mostrarlo;
  //   · sin carrera → la cola se vacía (pertenecía a la carrera anterior).
  // El componente CareerTrophyToast es quien muestra/encadena/cierra la cola.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!state || !state.career) {
      setTrophyToasts((prev) => (prev.length > 0 ? [] : prev));
      return;
    }
    const pending = pendingTrophyToasts(state);
    if (pending === null) {
      // Save legado: los títulos previos ya se consideran avisados.
      setState((prev) => baselineCelebratedTrophyIds(prev));
      return;
    }
    if (pending.length === 0) return;
    const ids = pending.map(trophyCelebrationId);
    setTrophyToasts((prev) => {
      const known = new Set(prev.map(trophyCelebrationId));
      const merged = prev.slice();
      for (const trophy of pending) {
        const id = trophyCelebrationId(trophy);
        if (!known.has(id)) {
          known.add(id);
          merged.push(trophy);
        }
      }
      return merged;
    });
    setState((prev) => withCelebratedTrophyIds(prev, ids));
  }, [state]);

  // ---------------------------------------------------------------------------
  // Acciones: delegan 1:1 en flow.js. Toda la lógica de negocio sigue viviendo
  // en flow.js/engine.js/events.js. Los updaters son funcionales para no
  // depender de un estado capturado en closure. La persistencia NO se duplica
  // acá: cualquier cambio de `state` con career lo guarda el efecto de autosave.
  // ---------------------------------------------------------------------------

  /** Inicia la carrera: flow.startCareer(player, options) → nuevo flow state
   *  (persistido por el autosave). Si nace en 'season' (fallback del engine
   *  sin ofertas de cantera) la temporada siguiente se simula sola. */
  const start = useCallback((player, options = {}) => {
    const opts = safeOptions(options);
    setState(advanceToCheckpoint(flowStartCareer(clonePlayer(player), opts), opts));
  }, []);

  /** Debut: acepta UNA oferta de cantera (flow la procesa vía acceptTransfer)
   *  y la temporada siguiente se simula sola hasta el próximo checkpoint. */
  const chooseYouthClub = useCallback((offer) => {
    setState((prev) => advanceToCheckpoint(flowChooseYouthClub(prev, offer)));
  }, []);

  /** Inicio directo: acepta el club de debut y juega hasta el próximo
   * checkpoint en un único updater funcional. No agrega reglas: encadena las
   * transiciones existentes del flow sobre el estado resultante. */
  const chooseYouthClubAndStart = useCallback((offer, options = {}) => {
    const opts = safeOptions(options);
    setState((prev) => advanceToCheckpoint(flowChooseYouthClub(prev, offer), opts));
  }, []);

  /** Temporada: simulateSeason() vía flow, repetido hasta el checkpoint
   * (evento/decisión/retiro). La UI ya no lo invoca: el ciclo es automático. */
  const advanceSeason = useCallback((options = {}) => {
    const opts = safeOptions(options);
    setState((prev) => advanceToCheckpoint(prev, opts));
  }, []);

  /** Acción genérica de flow (stay / transfer / retire / evento / etc.):
   *  resuelve la acción y, si queda en 'season', simula hasta el checkpoint. */
  const chooseAction = useCallback((action, payload = null, options = {}) => {
    const opts = safeOptions(options);
    setState((prev) => advanceToCheckpoint(
      flowChooseCareerAction(prev, action, payload ?? null, opts),
      opts,
    ));
  }, []);

  /** Vuelve al estado inicial ("sin carrera") y ELIMINA el save del nuevo modo
   *  carrera (persistence.clearCareerState → CAREER_SAVE_KEY). NUNCA toca las
   *  claves del sistema viejo (Copero/history/player/screen/match/lineup/
   *  injuries/player-status): esas las administra su propio sistema. */
  const reset = useCallback(() => {
    try {
      clearCareerState();
    } catch {
      // Best-effort: aunque falle el borrado, el estado React se limpia igual.
    }
    restoredRef.current = null; // el save dejó de existir
    setState(null);             // con state null el autosave no escribe nada
    setTrophyToasts([]);        // la cola del aviso era de esa carrera
  }, []);

  /** Vacía la cola del aviso de títulos. La llama el overlay cuando termina
   *  de mostrarla (idempotente; no toca el flow state ni el save). */
  const clearTrophyToasts = useCallback(() => {
    setTrophyToasts((prev) => (prev.length > 0 ? [] : prev));
  }, []);

  // ---------------------------------------------------------------------------
  // Derivados null-safe: nunca se accede a state.career sin guarda, así el
  // primer render (state === null) es seguro.
  // ---------------------------------------------------------------------------

  const phase = state ? state.phase : null;
  const career = state && state.career ? state.career : null;
  const youthOffers = asList(state && state.youthOffers);
  const transferOffers = asList(state && state.transferOffers);
  const currentEvent = state && state.currentEvent ? state.currentEvent : null;
  const seasonReport = state && state.seasonReport ? state.seasonReport : null;
  const lastAction = state && state.lastAction ? state.lastAction : null;
  const stoppedReason = state ? state.stoppedReason : null;
  const retirementDue = Boolean(state && state.retirementDue);

  /** Acciones válidas del checkpoint actual (flow maneja null → []). */
  const decisionOptions = useMemo(
    () => flowGetCareerDecisionOptions(state),
    [state],
  );

  return {
    // Estado crudo del flow (consumo avanzado y lo que persiste el autosave).
    state,
    // Derivados listos para la UI.
    phase,
    career,
    youthOffers,
    transferOffers,
    currentEvent,
    seasonReport,
    lastAction,
    stoppedReason,
    retirementDue,
    decisionOptions,
    // Aviso temporal de títulos (solo presentación; sin fase nueva).
    trophyToasts,
    clearTrophyToasts,
    hasCareer: Boolean(career),
    isRetired: phase === FLOW_PHASES.RETIRED,
    isStopped: phase === FLOW_PHASES.STOPPED,
    // Acciones (delegan en flow.js).
    start,
    chooseYouthClub,
    chooseYouthClubAndStart,
    advanceSeason,
    chooseAction,
    reset,
  };
}

export default useCareer;

