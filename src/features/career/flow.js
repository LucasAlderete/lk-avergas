// ============================================================================
// ORQUESTADOR PURO DEL MODO CARRERA — flow.js (Paso 6)
// ============================================================================
// Conecta las piezas existentes del motor (features/career/engine.js) y del
// sistema de eventos (features/career/events.js) para representar el flujo
// lógico de una carrera:
//
//   DEBUT (elección del club de cantera)
//     → SEASON (simulateSeason)
//       → [EVENTO (rollCareerEvent) → ELECCIÓN (applyEventChoice)]
//         → DECISION (stay / transfer / retire)
//           → SEASON → ... → RETIRED (retireCareer)
//
// Reglas de este archivo:
// - PURO: sin React, sin hooks, sin localStorage/sessionStorage, sin
//   window/document, sin JSX, sin DOM y sin persistencia. Ejecutable
//   directamente desde Node (ESM).
// - NO duplica lógica del motor: simulateSeason, generateTransferOffers,
//   acceptTransfer, resolveStay, generateYouthOffers, retireCareer,
//   rollCareerEvent y applyEventChoice SE LLAMAN, nunca se re-implementan.
//   simulateSegment no se usa acá porque el flujo principal expone
//   checkpoints individuales (las decisiones de carrera ocurren entre
//   temporadas); un avance por lotes fue evaluado y omitido por redundante.
// - NO muta nada: cada función devuelve un NUEVO flow state. Los cambios de
//   club pasan SIEMPRE por acceptTransfer y el retiro por retireCareer; este
//   archivo jamás toca career.club / career.division / career.clubHistory
//   por fuera del engine.
// - RNG: mismo contrato del engine (options.rng → options.seed → default).
//   El flow resuelve UN rng por llamada y lo comparte con todas las funciones
//   del engine que use en esa llamada (nunca recrea el RNG a mitad de paso).
//   El estado NO guarda rng: el determinismo se logra pasando seed por
//   llamada; para una secuencia continua, el caller puede pasar el mismo
//   objeto rng entre llamadas.
// - Comportamiento del engine que se PRESERVA (no se corrige acá):
//     * createCareer() nace SIN club (club = null): la fase 'debut' espera
//       la elección del jugador entre las 3 ofertas de generateYouthOffers()
//       y el flujo NUNCA simula una temporada sin club. (El override
//       explícito initialClubSlug solo lo usan tests/herramientas.)
//     * simulateSeason() no aplica el retiro: si el reporte marca
//       mandatoryRetirement (o la edad de retiro ya fue alcanzada), el flow
//       lleva la carrera a una decisión cuya única acción válida es 'retire'
//       (retireCareer). No se inventa ninguna transición automática.
//     * El traspaso de un evento interactivo es SOLO metadata
//       (career.pendingTransfer): este flow no ejecuta transferencias
//       automáticas. La decisión queda en el checkpoint de decisión.
// ============================================================================

import {
  createCareer,
  simulateSeason,
  generateTransferOffers,
  acceptTransfer,
  generateYouthOffers,
  resolveStay,
  retireCareer,
  createSeededRng,
} from './engine.js';

import {
  rollCareerEvent,
  applyEventChoice,
} from './events.js';

import { EVENT_CHANCE_PER_CHECKPOINT } from './config.js';

// ============================================================================
// FASES DEL FLUJO + CONTRATO DE ESTADO
// ============================================================================

export const FLOW_PHASES = {
  DEBUT: 'debut',         // elegir club de cantera (youthOffers)
  SEASON: 'season',       // carrera activa: toca avanzar una temporada
  EVENT: 'event',         // checkpoint con evento interactivo pendiente
  DECISION: 'decision',   // decisión post-temporada: stay / transfer / retire
  TRANSFER: 'transfer',   // mercado abierto: elegir una transferOffers
  RETIRED: 'retired',     // carrera cerrada (retireCareer)
  STOPPED: 'stopped',     // estado inutilizable (sin career): nada que decidir
};

const KNOWN_PHASES = new Set(Object.values(FLOW_PHASES));

// Acciones que chooseCareerAction puede resolver (las que reporta
// getCareerDecisionOptions en cada fase).
export const FLOW_ACTIONS = {
  CHOOSE_YOUTH_CLUB: 'choose_youth_club',
  ADVANCE_SEASON: 'advance_season',
  CHOOSE_EVENT_CHOICE: 'choose_event_choice',
  STAY: 'stay',
  TRANSFER: 'transfer',
  RETIRE: 'retire',
};

// Contrato de estado (estable, pensado para consumo directo de una UI):
// {
//   career,                // career vigente del engine (única fuente de verdad)
//   phase,                 // FLOW_PHASES
//   youthOffers,           // ofertas de cantera | null (solo phase 'debut')
//   transferOffers,        // ofertas del mercado abierto | null (solo 'transfer')
//   currentEvent,          // { event, context } del checkpoint | null
//   seasonReport,          // último reporte de temporada | null
//   retirementDue,         // true si simulateSeason marcó mandatoryRetirement
//   seasonsSinceDecision,  // temporadas jugadas desde la última decisión
//   stoppedReason,         // null | 'retirement' | 'invalid_state' | 'invalid_player'
//   celebratedTrophyIds,   // ids de títulos ya avisados con el aviso temporal
//                          // (dedupe de la capa React; ausente/null en saves
//                          // legados). NO es una fase ni cambia el flujo.
//   lastAction,            // { action, ok, reason?, ... } resultado de la última acción
// }

// ============================================================================
// RNG + HELPERS PUROS INTERNOS
// ============================================================================

// Pata "default" del contrato RNG (rng > seed > default). Espejo de la
// política de engine.js/events.js (ninguno exporta su defaultRng): la decisión
// de azar del checkpoint NUNCA se hace por fuera de un rng; cuando el caller
// no inyecta rng/seed, este objeto completa la cadena. Todo lo aleatorio del
// flow pasa por next() de un rng resuelto.
const flowDefaultRng = {
  next: () => Math.random(),
  int(min, max) {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.floor(lo + this.next() * (hi - lo + 1));
  },
};

/** options.rng → options.seed (createSeededRng del engine) → default del flow. */
function resolveFlowRng(options = {}) {
  if (options && options.rng && typeof options.rng.next === 'function') return options.rng;
  if (options && options.seed != null) return createSeededRng(options.seed);
  return flowDefaultRng;
}

/** Estado detenido (sin career utilizable): forma estable, nunca lanza. */
function stoppedState(reason, lastAction) {
  return {
    career: null,
    phase: FLOW_PHASES.STOPPED,
    youthOffers: null,
    transferOffers: null,
    currentEvent: null,
    seasonReport: null,
    retirementDue: false,
    seasonsSinceDecision: 0,
    celebratedTrophyIds: [],
    stoppedReason: reason,
    lastAction,
  };
}

/** Copia normalizada del estado (nuevo objeto, misma career: jamás se muta). */
function normalizeState(state) {
  if (!state || typeof state !== 'object' || !state.career || typeof state.career !== 'object') {
    return null;
  }
  const career = state.career;
  let phase = state.phase;
  if (typeof phase !== 'string' || !KNOWN_PHASES.has(phase)) {
    // Estado hecho a mano o truncado: derivar la fase de la career real.
    phase = career.retired === true ? FLOW_PHASES.RETIRED : FLOW_PHASES.SEASON;
  }
  // Coherencia: una career retirada nunca queda en fases activas.
  if (career.retired === true && phase !== FLOW_PHASES.RETIRED && phase !== FLOW_PHASES.STOPPED) {
    phase = FLOW_PHASES.RETIRED;
  }
  return {
    career,
    phase,
    youthOffers: Array.isArray(state.youthOffers) ? state.youthOffers : null,
    transferOffers: Array.isArray(state.transferOffers) ? state.transferOffers : null,
    currentEvent: (state.currentEvent && typeof state.currentEvent === 'object') ? state.currentEvent : null,
    seasonReport: (state.seasonReport && typeof state.seasonReport === 'object') ? state.seasonReport : null,
    retirementDue: state.retirementDue === true,
    seasonsSinceDecision: Number.isFinite(state.seasonsSinceDecision)
      ? Math.max(0, Math.floor(state.seasonsSinceDecision))
      : 0,
    celebratedTrophyIds: normalizeCelebratedTrophyIds(state.celebratedTrophyIds),
    stoppedReason: typeof state.stoppedReason === 'string' ? state.stoppedReason : null,
    lastAction: (state.lastAction && typeof state.lastAction === 'object') ? state.lastAction : null,
  };
}

/**
 * Registro de títulos ya avisados (dedupe del aviso temporal de la UI; NO es
 * una fase del flujo ni cambia la simulación): un array de strings se conserva
 * saneado y sin duplicados; la ausencia (undefined, saves legados) se preserva
 * tal cual y cualquier otro valor raro cae a null estable. La capa React es
 * quien lo interpreta (useCareer: pendingTrophyToasts / baseline).
 */
function normalizeCelebratedTrophyIds(value) {
  if (!Array.isArray(value)) return value === undefined ? undefined : null;
  const seen = new Set();
  const ids = [];
  for (const id of value) {
    if (typeof id === 'string' && id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Fallo de acción: el estado vuelve intacto (con otro lastAction), sin lanzar. */
function withLastAction(base, action, reason) {
  return { ...base, lastAction: { action, ok: false, reason } };
}

/** Ritmo de checkpoints de la dificultad vigente (config: seasonsPerDecision). */
function seasonsPerDecisionOf(career) {
  const info = career && career.difficultyInfo;
  const n = info && Number.isFinite(info.seasonsPerDecision) ? info.seasonsPerDecision : 1;
  return Math.max(1, Math.floor(n));
}

/** true si la career resultante cambió de club (solo acceptTransfer lo hace).
 *  La carrera que nace sin club (debut) cuenta como cambio: null → club. */
function clubChanged(before, after) {
  if (!after || !after.club) return false;
  if (!before || !before.club) return true;
  return after.club.slug !== before.club.slug;
}

/**
 * Resuelve la referencia de una oferta contra el array VIGENTE del estado.
 * Acepta: índice entero, id (string), el objeto por referencia o un objeto
 * con el mismo id. Si no pertenece a las ofertas del estado → null (rechazo
 * limpio, sin tocar la career). Nunca acepta objetos sueltos.
 */
function matchOfferIn(offers, ref) {
  if (!Array.isArray(offers) || offers.length === 0 || ref == null) return null;
  if (typeof ref === 'number' && Number.isInteger(ref)) {
    return (ref >= 0 && ref < offers.length) ? offers[ref] : null;
  }
  if (typeof ref === 'string') return offers.find((o) => o && o.id === ref) || null;
  if (typeof ref !== 'object') return null;
  const byRef = offers.find((o) => o === ref);
  if (byRef) return byRef;
  if (typeof ref.id === 'string') {
    const byId = offers.find((o) => o && o.id === ref.id);
    if (byId) return byId;
  }
  return null;
}

/** Extrae la referencia de oferta de un payload flexible (oferta/id/índice). */
function offerRefFromPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string' || typeof payload === 'number') return payload;
  if (typeof payload !== 'object') return null;
  if (payload.offer != null) return payload.offer;
  if (payload.offerId != null) return payload.offerId;
  if (payload.offerIndex != null) return payload.offerIndex;
  return payload;
}

/** Extrae la decisión de evento de un payload flexible (id / objeto / choice). */
function choiceFromPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return null;
  if (typeof payload.choiceId === 'string') return payload.choiceId;
  if (payload.choice != null) return payload.choice;
  if (typeof payload.id === 'string') return payload;
  return null;
}

// ============================================================================
// INICIO DE CARRERA — startCareer(player, options?)
// ============================================================================

/**
 * Crea la carrera (createCareer) y la deja en el checkpoint de debut.
 *
 * - Las ofertas de cantera las genera generateYouthOffers() del engine con el
 *   mismo options (rng/seed pasan sin tocar): SIEMPRE 3 clubes argentinos de
 *   nivel bajo (pool del engine), en fase 'debut'.
 * - El flow NO elige club: la carrera nace con club = null y la fase 'debut'
 *   queda abierta hasta que el jugador elija (chooseYouthClub → acceptTransfer
 *   asigna el club y recién ahí puede simularse). Nunca arranca en 'season'.
 * - options además alimenta a createCareer: difficulty, position y el override
 *   explícito initialClubSlug (solo tests/herramientas; la UI no lo usa).
 *
 * @returns {object} Flow state inicial.
 */
export function startCareer(player, options = {}) {
  const safeOptions = (options && typeof options === 'object') ? options : {};

  // createCareer no es defensivo con players inválidos (verificado: lanza con
  // null/undefined). El flow no rompe ese contrato: captura y devuelve un
  // estado detenido sin lanzar (tolerancia del flujo, sin UI).
  let career = null;
  try {
    career = createCareer(player, safeOptions);
  } catch {
    career = null;
  }
  if (!career || typeof career !== 'object' || career.retired === true) {
    return stoppedState('invalid_player', { action: 'start', ok: false, reason: 'invalid_player' });
  }

  const generated = generateYouthOffers(career, safeOptions);
  const offers = Array.isArray(generated) ? generated : [];

  return {
    career,
    // SIEMPRE debut: sin club no hay temporada posible. Con un mundo sano
    // generateYouthOffers entrega 3 ofertas; si el pool quedara vacío, la
    // fase debut queda abierta (la UI muestra el mensaje de reintento).
    phase: FLOW_PHASES.DEBUT,
    youthOffers: offers.length > 0 ? offers : null,
    transferOffers: null,
    currentEvent: null,
    seasonReport: null,
    retirementDue: false,
    seasonsSinceDecision: 0,
    celebratedTrophyIds: [],
    stoppedReason: null,
    lastAction: { action: 'start', ok: true },
  };
}

// ============================================================================
// ELEGIR CLUB DE DEBUT — chooseYouthClub(state, offer)
// ============================================================================

/**
 * Resuelve la oferta de cantera elegida y saca la carrera de la fase debut.
 *
 * - Valida que la oferta pertenezca a state.youthOffers (id, índice o
 *   referencia). Una oferta que no está en el estado se rechaza SIN tocar
 *   nada (ni career ni estado).
 * - El cambio de club SIEMPRE pasa por acceptTransfer(): este flow jamás
 *   escribe career.club / career.division / career.clubHistory por su cuenta.
 *   Las validaciones del engine (club existente, distinto al actual, división
 *   coherente) se respetan tal cual: si el engine rechaza, la fase debut
 *   queda abierta para reintentar con otra oferta.
 *
 * @returns {object} Nuevo flow state (phase 'season' si se aceptó).
 */
export function chooseYouthClub(state, offer) {
  const base = normalizeState(state);
  if (!base) {
    return stoppedState('invalid_state', { action: 'choose_youth_club', ok: false, reason: 'invalid_state' });
  }
  if (base.phase === FLOW_PHASES.RETIRED) {
    return withLastAction(base, 'choose_youth_club', 'retired');
  }
  if (base.phase !== FLOW_PHASES.DEBUT) {
    return withLastAction(base, 'choose_youth_club', 'wrong_phase');
  }

  const chosen = matchOfferIn(base.youthOffers, offer);
  if (!chosen) {
    // Oferta inexistente o ajena al estado: rechazo limpio, sin mutación.
    return withLastAction(base, 'choose_youth_club', 'offer_not_available');
  }

  const nextCareer = acceptTransfer(base.career, chosen);
  if (!clubChanged(base.career, nextCareer)) {
    // Guard del engine (oferta inválida / mismo club): la fase debut queda
    // abierta para que el jugador elija otra oferta.
    return withLastAction(base, 'choose_youth_club', 'offer_rejected');
  }

  return {
    ...base,
    career: nextCareer,
    phase: FLOW_PHASES.SEASON,
    youthOffers: null,
    lastAction: { action: 'choose_youth_club', ok: true },
  };
}

// ============================================================================
// TEMPORADA — advanceSeason(state, options?)
// ============================================================================

/**
 * Avanza UNA temporada usando simulateSeason() como motor (sin duplicar nada
 * de su lógica) y arma el checkpoint que corresponda:
 *
 *   1) Guardas: estado inválido / retirada / fase equivocada → rechazo limpio.
 *   2) simulateSeason(career, { rng }) — la MISMA instancia de rng resuelta
 *      para esta llamada acompaña también al evento del checkpoint (una sola
 *      secuencia, nunca recreada a mitad de paso).
 *   3) Contador de checkpoint: config define que la dificultad cambia SOLO
 *      seasonsPerDecision ("cada cuántas temporadas el jugador toma
 *      decisiones / recibe eventos / mercado de pases"). Este flow es quien
 *      lo consume: si la temporada completó el ciclo, se abre checkpoint de
 *      decisión; si no, la carrera queda lista para la próxima temporada.
 *   4) Checkpoint de decisión: chance de evento interactivo
 *      (EVENT_CHANCE_PER_CHECKPOINT de config; el engine delega esta decisión
 *      al flujo). Si sale, el evento lo rueda events.js (rollCareerEvent) y
 *      la phase pasa a 'event' con el { event, context } guardado; si no,
 *      directo a 'decision' con el reporte de temporada.
 *   5) Retiro obligatorio: el engine NO aplica el retiro (simulateSeason
 *      marca mandatoryRetirement / su guarda corta en la edad de retiro).
 *      El flow respeta ese contrato: marca retirementDue + stoppedReason
 *      'retirement' y getCareerDecisionOptions ofrece SOLO 'retire'. La
 *      transición real la hace retireCareer() vía la acción 'retire'.
 *
 * @returns {object} Nuevo flow state (nunca muta el original).
 */
export function advanceSeason(state, options = {}) {
  const base = normalizeState(state);
  if (!base) {
    return stoppedState('invalid_state', { action: 'advance_season', ok: false, reason: 'invalid_state' });
  }
  if (base.phase === FLOW_PHASES.RETIRED) {
    return withLastAction(base, 'advance_season', 'retired');
  }
  if (base.phase !== FLOW_PHASES.SEASON) {
    // El checkpoint anterior (decisión/evento) está pendiente: primero se
    // resuelve, después se puede volver a avanzar.
    return withLastAction(base, 'advance_season', 'wrong_phase');
  }

  const rng = resolveFlowRng(options);

  // 1) La temporada SIEMPRE la simula simulateSeason (pura, con cloneCareer).
  const nextCareer = simulateSeason(base.career, { rng });

  // 2) Guarda real del engine: carrera ya retirada (no simuló nada).
  if (nextCareer.retired === true) {
    return {
      ...base,
      career: nextCareer,
      phase: FLOW_PHASES.RETIRED,
      stoppedReason: 'retirement',
      youthOffers: null,
      transferOffers: null,
      currentEvent: null,
      lastAction: { action: 'advance_season', ok: false, reason: 'retired' },
    };
  }

  const report = (nextCareer.lastSeasonReport && typeof nextCareer.lastSeasonReport === 'object')
    ? nextCareer.lastSeasonReport
    : null;
  const simulated = Boolean(report && nextCareer.season === base.career.season + 1);

  // 3) No simuló (edad de retiro alcanzada, retired aún false): el flow NO
  //    inventa la transición. Queda una decisión con única acción 'retire'.
  if (!simulated) {
    return {
      ...base,
      career: nextCareer,
      phase: FLOW_PHASES.DECISION,
      retirementDue: true,
      stoppedReason: 'retirement',
      youthOffers: null,
      transferOffers: null,
      currentEvent: null,
      lastAction: { action: 'advance_season', ok: false, reason: 'retirement_reached' },
    };
  }

  const seasonsSinceDecision = base.seasonsSinceDecision + 1;
  const mandatory = report.mandatoryRetirement === true;
  const checkpoint = mandatory || seasonsSinceDecision >= seasonsPerDecisionOf(nextCareer);

  // 4) Temporada sin checkpoint de decisión: sigue el ritmo de la dificultad.
  if (!checkpoint) {
    return {
      ...base,
      career: nextCareer,
      phase: FLOW_PHASES.SEASON,
      seasonReport: report,
      seasonsSinceDecision,
      retirementDue: false,
      stoppedReason: null,
      youthOffers: null,
      transferOffers: null,
      currentEvent: null,
      lastAction: { action: 'advance_season', ok: true },
    };
  }

  // 5) Checkpoint de decisión: chance de evento interactivo con la MISMA
  //    secuencia RNG (el engine delega esta decisión al flujo). El evento lo
  //    rueda events.js; si no hay elegibles, rollCareerEvent devuelve null.
  const eventRoll = (rng.next() < EVENT_CHANCE_PER_CHECKPOINT)
    ? rollCareerEvent(nextCareer, { rng })
    : null;

  if (eventRoll && eventRoll.event) {
    return {
      ...base,
      career: nextCareer,
      phase: FLOW_PHASES.EVENT,
      currentEvent: { event: eventRoll.event, context: eventRoll.context || null },
      seasonReport: report,
      seasonsSinceDecision,
      retirementDue: mandatory,
      stoppedReason: mandatory ? 'retirement' : null,
      youthOffers: null,
      transferOffers: null,
      lastAction: { action: 'advance_season', ok: true },
    };
  }

  return {
    ...base,
    career: nextCareer,
    phase: FLOW_PHASES.DECISION,
    currentEvent: null,
    seasonReport: report,
    seasonsSinceDecision,
    retirementDue: mandatory,
    stoppedReason: mandatory ? 'retirement' : null,
    youthOffers: null,
    transferOffers: null,
    lastAction: { action: 'advance_season', ok: true },
  };
}

// ============================================================================
// DECISIONES — resolvers internos por acción
// ============================================================================

/** Acción 'stay': queda la carrera en su club. SIEMPRE vía resolveStay(). */
function resolveStayAction(base, options) {
  if (base.phase !== FLOW_PHASES.DECISION && base.phase !== FLOW_PHASES.TRANSFER) {
    return withLastAction(base, 'stay', 'wrong_phase');
  }
  if (base.retirementDue) {
    // Con retiro obligatorio pendiente, la única decisión es 'retire'.
    return withLastAction(base, 'stay', 'retirement_due');
  }

  const rng = resolveFlowRng(options);
  const stay = resolveStay(base.career, { rng });

  return {
    ...base,
    career: stay.career,
    phase: FLOW_PHASES.SEASON,
    transferOffers: null,
    currentEvent: null,
    seasonsSinceDecision: 0,
    retirementDue: false,
    stoppedReason: null,
    lastAction: { action: 'stay', ok: true, loyaltyOvrBonus: stay.loyaltyOvrBonus },
  };
}

/**
 * Acción 'transfer' — el ciclo completo del mercado de pases:
 *   decision + sin oferta → generateTransferOffers() abre el checkpoint.
 *   transfer + oferta del estado → acceptTransfer() la consume.
 * NO se elige automáticamente ninguna oferta ni se ordenan con criterios
 * propios: el flow solo presenta/transporta opciones y resuelve la elegida.
 */
function resolveTransferAction(base, payload, options) {
  const offerRef = offerRefFromPayload(payload);

  // Abrir el mercado: SOLO desde la decisión post-temporada y sin oferta.
  if (base.phase === FLOW_PHASES.DECISION) {
    if (base.retirementDue) {
      return withLastAction(base, 'transfer', 'retirement_due');
    }
    if (offerRef != null) {
      // No se aceptan ofertas que no están en el estado: primero se abre el
      // mercado (sin oferta), después se elige entre las transferOffers.
      return withLastAction(base, 'transfer', 'offer_not_available');
    }
    const rng = resolveFlowRng(options);
    const offers = generateTransferOffers(base.career, { rng });
    if (!Array.isArray(offers) || offers.length === 0) {
      return withLastAction(base, 'transfer', 'no_offers');
    }
    return {
      ...base,
      phase: FLOW_PHASES.TRANSFER,
      transferOffers: offers,
      currentEvent: null,
      lastAction: { action: 'transfer', ok: true, opened: true },
    };
  }

  // Aceptar una oferta del mercado abierto (solo ofertas del estado).
  if (base.phase === FLOW_PHASES.TRANSFER) {
    if (offerRef == null) {
      return withLastAction(base, 'transfer', 'offer_required');
    }
    const chosen = matchOfferIn(base.transferOffers, offerRef);
    if (!chosen) {
      // Oferta inexistente / ajena a las transferOffers vigentes: rechazo sin
      // modificar la career (si el estado tiene A y B, C no existe acá).
      return withLastAction(base, 'transfer', 'offer_not_available');
    }

    const nextCareer = acceptTransfer(base.career, chosen);
    if (!clubChanged(base.career, nextCareer)) {
      // Guard del engine: fase 'transfer' queda abierta para reintentar.
      return withLastAction(base, 'transfer', 'offer_rejected');
    }

    return {
      ...base,
      career: nextCareer,
      phase: FLOW_PHASES.SEASON,
      transferOffers: null,
      currentEvent: null,
      seasonsSinceDecision: 0,
      retirementDue: false,
      stoppedReason: null,
      lastAction: { action: 'transfer', ok: true },
    };
  }

  return withLastAction(base, 'transfer', 'wrong_phase');
}

/**
 * Acción 'choose_event_choice': aplica la decisión del evento interactivo con
 * applyEventChoice() de events.js (el sistema existente, sin duplicar nada).
 * El contexto guardado con el evento rodado ({ rival }) acompaña a la
 * elección para que el traspaso metadata se reconstruya exactamente igual.
 * El traspaso del evento NO se ejecuta acá (es metadata en
 * career.pendingTransfer): la decisión de quedarse/irse sigue en el
 * checkpoint de decisión. Transferencias automáticas: nunca.
 */
function resolveEventChoiceAction(base, payload, options) {
  if (base.phase !== FLOW_PHASES.EVENT || !base.currentEvent) {
    return withLastAction(base, 'choose_event_choice', 'wrong_phase');
  }

  const choice = choiceFromPayload(payload);
  const currentEvent = base.currentEvent;
  const rng = resolveFlowRng(options);
  const result = applyEventChoice(base.career, currentEvent.event, choice, {
    rng,
    context: currentEvent.context || null,
  });

  const outcome = (result && result.outcome) || null;
  if (!outcome || outcome.applied !== true) {
    // Decisión inválida (id desconocido, career retirada, etc.): el evento
    // sigue abierto para que el jugador elija otra opción.
    return withLastAction(base, 'choose_event_choice', (outcome && outcome.reason) || 'invalid_choice');
  }

  return {
    ...base,
    career: result.career,
    phase: FLOW_PHASES.DECISION,
    currentEvent: null,
    lastAction: {
      action: 'choose_event_choice',
      ok: true,
      ovrDelta: outcome.ovrDelta,
      isTransfer: Boolean(outcome.transfer),
    },
  };
}

/** Acción 'retire': el cierre SIEMPRE lo hace retireCareer() del engine. */
function resolveRetireAction(base) {
  if (base.phase !== FLOW_PHASES.DECISION && base.phase !== FLOW_PHASES.TRANSFER) {
    return withLastAction(base, 'retire', 'wrong_phase');
  }

  const nextCareer = retireCareer(base.career);

  return {
    ...base,
    career: nextCareer,
    phase: FLOW_PHASES.RETIRED,
    stoppedReason: 'retirement',
    youthOffers: null,
    transferOffers: null,
    currentEvent: null,
    lastAction: { action: 'retire', ok: true },
  };
}

// ============================================================================
// OPCIONES DISPONIBLES — getCareerDecisionOptions(state)
// ============================================================================

/**
 * Devuelve las acciones VÁLIDAS en el checkpoint actual (array nuevo, nunca
 * muta). Solo informa lo que el estado realmente permite:
 *
 *   debut    → ['choose_youth_club']
 *   season   → ['advance_season']
 *   event    → ['choose_event_choice']
 *   transfer → ['transfer', 'stay', 'retire']
 *   decision → ['retire'] si hay retiro obligatorio pendiente,
 *              si no ['stay', 'transfer', 'retire']
 *   retired / stopped / fase desconocida → []
 *
 * @returns {Array<string>}
 */
export function getCareerDecisionOptions(state) {
  const base = normalizeState(state);
  if (!base) return [];

  switch (base.phase) {
    case FLOW_PHASES.DEBUT:
      return ['choose_youth_club'];
    case FLOW_PHASES.SEASON:
      return ['advance_season'];
    case FLOW_PHASES.EVENT:
      return ['choose_event_choice'];
    case FLOW_PHASES.TRANSFER:
      return ['transfer', 'stay', 'retire'];
    case FLOW_PHASES.DECISION:
      return base.retirementDue === true ? ['retire'] : ['stay', 'transfer', 'retire'];
    default:
      return [];
  }
}

// ============================================================================
// ACCIÓN EXPLÍCITA — chooseCareerAction(state, action, payload?, options?)
// ============================================================================

/**
 * Resuelve UNA acción explícita sobre el checkpoint vigente y devuelve el
 * nuevo flow state. Toda la lógica de negocio sigue viviendo en el engine:
 * stay → resolveStay() · transfer → generateTransferOffers()/acceptTransfer()
 * · retire → retireCareer() · cantera → acceptTransfer() · evento →
 * applyEventChoice().
 *
 * payload según acción:
 *   - 'choose_youth_club': la oferta elegida (objeto con id, id string o
 *     índice), directa o dentro de { offer | offerId | offerIndex }.
 *   - 'transfer': SIN payload abre el mercado (desde 'decision'); con oferta
 *     del estado (objeto/id/índice o { offer | offerId | offerIndex }) la
 *     acepta (desde 'transfer'). Nunca elige una oferta por su cuenta.
 *   - 'choose_event_choice': el id de la decisión (string) u objeto
 *     { choiceId } / { choice } / el propio choice.
 *   - 'stay' / 'retire': sin payload.
 *
 * options: { rng | seed } para las funciones del engine que usan RNG
 * (resolveStay, generateTransferOffers, simulateSeason, applyEventChoice).
 *
 * Tolerancia (sin lanzar excepciones, sin mutar nada): estado inválido,
 * career inexistente, acción desconocida, fase equivocada, oferta ajena al
 * estado, carrera retirada o payload incompleto → estado intacto con
 * lastAction { ok: false, reason }.
 *
 * @returns {object} Nuevo flow state.
 */
export function chooseCareerAction(state, action, payload = null, options = {}) {
  const safeOptions = (options && typeof options === 'object') ? options : {};
  const label = (typeof action === 'string' && action) ? action : 'unknown_action';

  const base = normalizeState(state);
  if (!base) {
    return stoppedState('invalid_state', { action: label, ok: false, reason: 'invalid_state' });
  }
  if (base.phase === FLOW_PHASES.RETIRED) {
    return withLastAction(base, label, 'retired');
  }
  if (base.phase === FLOW_PHASES.STOPPED) {
    return withLastAction(base, label, 'stopped');
  }

  switch (label) {
    case 'choose_youth_club':
      return chooseYouthClub(base, offerRefFromPayload(payload));
    case 'advance_season':
      return advanceSeason(base, safeOptions);
    case 'choose_event_choice':
      return resolveEventChoiceAction(base, payload, safeOptions);
    case 'stay':
      return resolveStayAction(base, safeOptions);
    case 'transfer':
      return resolveTransferAction(base, payload, safeOptions);
    case 'retire':
      return resolveRetireAction(base);
    default:
      return withLastAction(base, label, 'unknown_action');
  }
}







