// ============================================================================
// MOTORES DE CARRERA — PASO 3 (features/career/engine.js)
// ============================================================================

import {
  AGE, OVR, clampOvr, initialOvr,
  DIFFICULTIES,
  POSITIONS, positionById, suggestedPosition,
  GROWTH_CURVES, GK_GROWTH_CURVE, GROWTH_META, growthRangeForAge, developmentProfileFromBias, LOW_ROTATION_STREAK,
  ROLE_THRESHOLDS, ROLES, ROLE_LABELS, roleBucket,
  MATCHES_PER_SEASON, APPEARANCE_RANGES, APPEARANCE_MULT_BY_REP, appearanceMultiplier,
  SCORING_BUCKET_COUNT, scoringBucket, GOAL_RATE, ASSIST_RATE, TEAM_STRENGTH_SCORING_MULT,
  overallScoringCurve, SCORING_RANDOM_RANGE,
  goalMult, assistMult, staminaMult, injuryRisk, roleMargin, growthBias, ATTR_FORMULA_RANGES,
  INJURY_CHANCE_PER_SEASON, INJURY_TYPES,
  TROPHY_TYPES, TROPHY_PROBS, MAX_TROPHIES_PER_SEASON, starMultiplier, effectiveReputationForTrophies,
  OFFER_RULES, playerTier, walkTier, HOME_BIAS_WEIGHT, homeBiasWeight,
  firstDivisionOfferChance,
  marketValue,
  EVENT_CHANCE_PER_CHECKPOINT, ACHIEVEMENTS,
} from './config.js';

import {
  divisions, clubs, clubKey, allClubs, clubsByDivision, findClub, findClubByKey,
  domesticReputation, clubBaseline, startingDivisionsForOvr, worldMeta,
} from '../../data/careerWorld.js';

// -----------------------------------------------------------------------------
// Jerarquía jugable de DOS categorías (Primera / Segunda).
// -----------------------------------------------------------------------------
// La Tercera División NO existe: los niveles se derivan del mundo (divisions)
// para que ningún clamp, fallback o walk de tier pueda reintroducir una
// categoría inferior. TOP_DIVISION = nivel interno de Primera (el más bajo
// numéricamente porque 1 es la más alta) · BASE_DIVISION = piso jugable.
const DIVISION_LEVELS = divisions.map((d) => d.nivel).sort((a, b) => a - b);
const TOP_DIVISION = DIVISION_LEVELS[0];
const BASE_DIVISION = DIVISION_LEVELS[DIVISION_LEVELS.length - 1];

// -----------------------------------------------------------------------------
// 0) RNG
// -----------------------------------------------------------------------------

const defaultRng = {
  next: () => Math.random(),
  int: (min, max) => {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  },
};

export const createSeededRng = (seed) => {
  let s = seed >>> 0;
  return {
    next() {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      const lo = Math.max(0, Math.min(min, max));
      const hi = Math.max(lo, max);
      return Math.floor(lo + this.next() * (hi - lo + 1));
    },
  };
};

function pickWeighted(list, rng) {
  const total = list.reduce((acc, item) => acc + item.weight, 0);
  const r = rng.next() * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (r < acc) return item;
  }
  return list[list.length - 1];
}

export function cloneCareer(c) {
  return JSON.parse(JSON.stringify(c));
}

// -----------------------------------------------------------------------------
// 1) CREACIÓN DE CARRERA
// -----------------------------------------------------------------------------

export function createCareer(player, options = {}) {
  const difficulty = (options.difficulty && DIFFICULTIES[options.difficulty]) ? options.difficulty : 'normal';
  const chosenPosition = options.position || suggestedPosition(player);
  const attrs = {
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defense: player.defense,
    physical: player.physical,
  };

  const rating = player.rating;
  const ovr = initialOvr(rating);
  const profile = developmentProfileFromBias(growthBias(attrs));
  const isGK = chosenPosition === 'ARQ';

  const snapshot = {
    id: player.id || player.name,
    name: player.name,
    phrase: player.phrase || '',
    attrsSnapshot: { ...attrs },
    ratingSnapshot: rating,
    positionSnapshot: chosenPosition,
    createdAt: Date.now(),
  };

  // Club inicial: SIN club por defecto (club = null). La carrera nueva empieza
  // sin club y el jugador elige en el checkpoint de debut (las 3 ofertas de
  // generateYouthOffers): hasta entonces career.club permanece null.
  // options.initialClubSlug es un override EXPLÍCITO (solo tests/herramientas;
  // la UI nunca lo pasa) — si no se pide, NO se auto-asigna ningún club.
  const club = options.initialClubSlug ? findClub(options.initialClubSlug) : null;

  const domesticRep = domesticReputation(club);
  const clubBase = clubBaseline(club);

  const career = {
    playerId: player.name,
    name: player.name,
    snapshot,
    age: AGE.START,
    season: 2026,
    difficulty,
    difficultyInfo: DIFFICULTIES[difficulty],
    position: chosenPosition,
    naturalPosition: suggestedPosition(attrs),
    attrs: { ...attrs },
    ovr,
    overallPeak: ovr,
    profile,
    club,
    domesticRep,
    clubBaseline: clubBase,
    overallVsBaseline: ovr - clubBase + roleMargin(attrs),
    role: roleBucket(ovr - clubBase, isGK),
    careerStats: {
      pj: 0,
      gls: 0,
      ast: 0,
      cleanSheets: 0,
      matches: [],
    },
    seasonStats: {
      pj: 0,
      gls: 0,
      ast: 0,
      cleanSheets: 0,
      matches: [],
    },
    injuries: 0,
    injuryHistory: [],
    trophies: [],
    achievements: [],
    clubHistory: [],
    seasonHistory: [],
    retired: false,
    marketValue: marketValue({ ovr, age: AGE.START, reputation: domesticRep }),
    events: [],
    lastDecision: null,
  };

  return career;
}

// -----------------------------------------------------------------------------
// 2) UTILIDADES INTERNAS PURAS
// -----------------------------------------------------------------------------

function recalcCareerState(career) {
  const domesticRep = domesticReputation(career.club);
  const clubBase = clubBaseline(career.club);
  const ovrVsBaseline = career.ovr - clubBase + roleMargin(career.attrs);
  const newRole = roleBucket(career.ovr - clubBase, career.position === 'ARQ');
  return { domesticRep, clubBaseline: clubBase, overallVsBaseline: ovrVsBaseline, role: newRole };
}

export function recomputeCareer(career) {
  const state = recalcCareerState(career);
  return {
    ...career,
    domesticRep: state.domesticRep,
    clubBaseline: state.clubBaseline,
    overallVsBaseline: state.overallVsBaseline,
    role: state.role,
    marketValue: marketValue({ ovr: career.ovr, age: career.age, reputation: state.domesticRep, potential: career.overallPeak }),
  };
}

function estimateMatches(career, rng) {
  const isGK = career.position === 'ARQ';
  const role = career.role;
  const mult = appearanceMultiplier(career.domesticRep);
  const ranges = isGK ? APPEARANCE_RANGES.goalkeeper : APPEARANCE_RANGES.outfield;
  const [min, max] = ranges[role] || [0, 0];
  const raw = (min + max) / 2 + (rng.next() - 0.5) * (max - min) * 0.4;
  const matches = Math.round(raw * mult);
  return Math.max(0, Math.min(MATCHES_PER_SEASON.max, matches));
}

function bucketOf(career) {
  const d = career.overallVsBaseline;
  if (d >= 10) return 0;
  if (d >= 6) return 1;
  if (d >= 3) return 2;
  if (d >= -2) return 3;
  if (d >= -5) return 4;
  if (d >= -9) return 5;
  return 6;
}

// -----------------------------------------------------------------------------
// 3) SIMULACIÓN DE TEMPORADA — helpers internos + RNG inyectable
// -----------------------------------------------------------------------------
// Bloque incremental (PASO 3): este chunk agrega SOLO lo que necesita
// simulateSeason(). Los helpers existentes (pickWeighted, estimateMatches,
// bucketOf, recomputeCareer) se reutilizan; no se duplica nada.
//
// Reglas respetadas de config.js:
// - El delta de growthRangeForAge es POR CHECKPOINT: se reparte entre las
//   temporadas del checkpoint (difficultyInfo.seasonsPerDecision) con carry
//   fraccional (career.growthCarry) para no perder restos por redondeo.
// - LOW_ROTATION_STREAK.TRIGGER temporadas seguidas con rol de poca rotación
//   disparan una penalización extra de OVR esa temporada.
// - MAX_TROPHIES_PER_SEASON: la temporada corta al alcanzar el máximo (1).
// - Los eventos de checkpoint (EVENT_CHANCE_PER_CHECKPOINT), el mercado de
//   pases y los logros de retiro NO viven acá: son pasos posteriores del flujo.
// -----------------------------------------------------------------------------

// Ajustes internos del motor (detalle de implementación, no balance de mundo).
// Centralizados acá para que no queden números sueltos por el archivo.
const SEASON_TUNING = {
  injuryAvailabilityFactor: 0.55, // temporada lesionado: juega ~55% de lo previsto
  cleanSheetBase: 0.45,           // valla invicta (ARQ) con dominio neutro (bucket 3)
  cleanSheetPerBucket: 0.08,      // ajuste de valla por bucket de dominio (+/-)
  cleanSheetMin: 0.2,
  cleanSheetMax: 0.85,
};

// Roles que cuentan como "poca rotación" para el streak de LOW_ROTATION_STREAK.
const LOW_ROTATION_ROLES = ['low_rotation', 'substitute', 'third_keeper'];

/**
 * RNG inyectable: usa `options.rng` (objeto con next()/int(min, max)),
 * `options.seed` (entero → createSeededRng determinista) o el RNG por defecto.
 */
function resolveRng(options = {}) {
  if (options.rng && typeof options.rng.next === 'function') return options.rng;
  if (options.seed != null) return createSeededRng(options.seed);
  return defaultRng;
}

/** Convierte una tasa esperada (por partido) en un entero 0..n con varianza. */
function sampleCount(rate, rng) {
  if (rate <= 0) return 0;
  const whole = Math.floor(rate);
  return whole + (rng.next() < rate - whole ? 1 : 0);
}

/**
 * Goles / asistencias / vallas invictas de una temporada.
 * Simula partido por partido (pj <= 36) con la tasa por partido de config
 * ajustada por atributos, calidad (overallScoringCurve), fuerza del plantel
 * (TEAM_STRENGTH_SCORING_MULT) y un jitter de forma por temporada
 * (SCORING_RANDOM_RANGE). Solo el ARQ acumula vallas invictas.
 */
function simulateSeasonScoring(career, matches, rng) {
  const stats = { pj: matches, gls: 0, ast: 0, cleanSheets: 0 };
  if (matches <= 0) return stats;

  const isGK = career.position === 'ARQ';
  const position = positionById(career.position);
  const archetype = (position && position.archetype) || 'creator';
  const bucket = bucketOf(career); // 0 = muy superior al equipo · 6 = muy inferior
  const repIndex = Math.max(0, Math.min(TEAM_STRENGTH_SCORING_MULT.length - 1, Math.round(career.domesticRep)));
  const teamMult = TEAM_STRENGTH_SCORING_MULT[repIndex];
  const quality = overallScoringCurve(career.ovr);
  const goalRate = GOAL_RATE[archetype] ? GOAL_RATE[archetype][bucket] : 0;
  const assistRate = ASSIST_RATE[archetype] ? ASSIST_RATE[archetype][bucket] : 0;

  // El jitter de forma mueve toda la producción de la temporada.
  const jitter = SCORING_RANDOM_RANGE.min +
    rng.next() * (SCORING_RANDOM_RANGE.max - SCORING_RANDOM_RANGE.min);
  const perMatchGoals = goalRate * goalMult(career.attrs) * quality * teamMult * jitter;
  const perMatchAssists = assistRate * assistMult(career.attrs) * quality * teamMult * jitter;

  for (let match = 0; match < matches; match += 1) {
    stats.gls += sampleCount(perMatchGoals, rng);
    stats.ast += sampleCount(perMatchAssists, rng);
  }

  if (isGK) {
    const csChance = Math.max(
      SEASON_TUNING.cleanSheetMin,
      Math.min(
        SEASON_TUNING.cleanSheetMax,
        SEASON_TUNING.cleanSheetBase + (3 - bucket) * SEASON_TUNING.cleanSheetPerBucket,
      ),
    );
    for (let match = 0; match < matches; match += 1) {
      if (rng.next() < csChance) stats.cleanSheets += 1;
    }
  }

  return stats;
}

/** Lesión de temporada (null si no hubo) según chance + riesgo por atributos. */
function rollSeasonInjury(career, rng) {
  const chance = INJURY_CHANCE_PER_SEASON * injuryRisk(career.attrs);
  if (rng.next() >= chance) return null;
  const injury = pickWeighted(INJURY_TYPES, rng);
  return {
    season: career.season,
    age: career.age,
    type: injury.type,
    label: injury.label,
    ovrDelta: injury.ovrDelta,
  };
}

/**
 * Títulos de la temporada (array, normalmente 0 o 1 según
 * MAX_TROPHIES_PER_SEASON). Usa la reputación efectiva (estrella en club chico)
 * y el multiplicador estrella. La copa continental solo se tira en divisiones
 * con hasContinental (Primera Avergas); la copa doméstica, en hasDomesticCup.
 */
function rollSeasonTrophies(career, rng) {
  const division = divisions.find((d) => d.nivel === career.club.division);
  if (!division) return [];

  const domesticRep = career.domesticRep;
  const continentalRep = division.hasContinental ? domesticRep : 0;
  const eff = effectiveReputationForTrophies(career.ovr, domesticRep, continentalRep);
  const starMult = starMultiplier(career.overallVsBaseline);

  const candidates = [
    { type: 'league', prob: TROPHY_PROBS.league[eff.domestic] * starMult },
  ];
  if (division.hasDomesticCup) {
    candidates.push({ type: 'cup', prob: TROPHY_PROBS.cup[eff.domestic] * starMult });
  }
  if (division.hasContinental) {
    candidates.push({ type: 'continental', prob: TROPHY_PROBS.continental[eff.continental] * starMult });
  }

  const won = [];
  for (const candidate of candidates) {
    if (won.length >= MAX_TROPHIES_PER_SEASON) break;
    if (rng.next() < Math.min(1, candidate.prob)) {
      const meta = TROPHY_TYPES[candidate.type];
      won.push({
        season: career.season,
        type: candidate.type,
        label: meta.label,
        icon: meta.icon,
        clubKey: clubKey(career.club),
        clubName: career.club.name,
      });
    }
  }
  return won;
}

/**
 * Delta de OVR de la temporada. El rango completo del bloque de edad
 * (growthRangeForAge) es el delta POR CHECKPOINT: se reparte entre las
 * temporadas que dura el checkpoint (difficultyInfo.seasonsPerDecision) y el
 * resto fraccional se devuelve en `carry` para acumularlo en la temporada
 * siguiente. Si el streak de poca rotación alcanzó el TRIGGER, ese año aplica
 * una penalización extra (el OVR retrocede al menos 1).
 * Devuelve { delta, carry, lowRotationTriggered }.
 */
function rollSeasonGrowth(career, rng) {
  const isGK = career.position === 'ARQ';
  const seasonsPerDecision = (career.difficultyInfo && career.difficultyInfo.seasonsPerDecision) || 1;
  const range = growthRangeForAge(career.age, career.profile, isGK);
  const blockDelta = range[0] + rng.next() * (range[1] - range[0]);

  const share = (blockDelta + (career.growthCarry || 0)) / seasonsPerDecision;
  const rounded = Math.round(share);
  const carry = share - rounded;

  const lowRotationTriggered = (career.lowRotationStreak || 0) >= LOW_ROTATION_STREAK.TRIGGER;
  const delta = lowRotationTriggered ? Math.min(rounded, -1) : rounded;

  return { delta, carry, lowRotationTriggered };
}

/**
 * Simula UNA temporada completa de la carrera y devuelve una NUEVA carrera
 * (no muta la original; usa cloneCareer).
 *
 * options:
 *   - rng:  RNG inyectable ({ next(), int(min, max) }).
 *   - seed: semilla entera → createSeededRng (determinismo para tests/saves).
 *
 * Secuencia de la temporada:
 *   1) Partidos previstos (rol + reputación) ajustados por resistencia física.
 *   2) Lesión posible: reduce partidos; el castigo de OVR aplica al cierre.
 *   3) Producción (goles/asistencias/vallas) con el OVR con el que jugó.
 *   4) Título de temporada (máximo MAX_TROPHIES_PER_SEASON).
 *   5) Streak de poca rotación (con el rol con el que disputó la temporada).
 *   6) Crecimiento del bloque de edad (reparto por checkpoint) + castigo por
 *      lesión, acotado por clampOvr; actualiza overallPeak.
 *   7) Acumula careerStats, archiva la temporada en seasonHistory y resetea
 *      seasonStats para la temporada entrante.
 *   8) Avanza age/season y registra eventos del motor (lesión/título/racha).
 *   9) Recalcula estado derivado (rep, baseline, rol, valor de mercado) vía
 *      recomputeCareer.
 *
 * El resumen de la temporada queda en `career.lastSeasonReport` (para la UI).
 * El retiro NO se aplica acá: si al cerrar la temporada el jugador alcanzó la
 * edad de retiro, el reporte lo marca (`mandatoryRetirement`) y el flujo debe
 * llamar a retireCareer. Mercado de pases, checkpoint y logros: pasos previstos
 * para los siguientes bloques del engine.
 */
export function simulateSeason(career, options = {}) {
  const next = cloneCareer(career);

  // Guardas: una carrera retirada (o con edad de retiro alcanzada) no simula.
  if (next.retired || next.age >= AGE.RETIRE) return next;

  const rng = resolveRng(options);
  const seasonStart = next.season;
  const ageStart = next.age;
  const ovrStart = next.ovr;
  const roleAtSeason = next.role;
  const events = [];

  // 1) Partidos de la temporada.
  let matches = Math.round(estimateMatches(next, rng) * staminaMult(next.attrs));
  matches = Math.max(0, Math.min(MATCHES_PER_SEASON.max, matches));

  // 2) Lesión: baja disponibilidad de partidos esa temporada.
  const injury = rollSeasonInjury(next, rng);
  if (injury) {
    matches = Math.round(matches * SEASON_TUNING.injuryAvailabilityFactor);
    next.injuries += 1;
    next.injuryHistory.push(injury);
    events.push({
      season: seasonStart,
      type: 'injury',
      message: `Temporada condicionada: ${injury.label}.`,
    });
  }

  // 3) Producción con el OVR con el que afrontó la temporada.
  const stats = simulateSeasonScoring(next, matches, rng);

  // 4) Títulos (0..MAX_TROPHIES_PER_SEASON).
  const trophies = rollSeasonTrophies(next, rng);
  for (const trophy of trophies) {
    events.push({
      season: seasonStart,
      type: 'trophy',
      message: `${trophy.icon} ${trophy.label} con ${trophy.clubName}.`,
    });
  }
  next.trophies.push(...trophies);

  // 5) Streak de poca rotación con el rol con el que jugó la temporada.
  const playedLowRotation = LOW_ROTATION_ROLES.includes(roleAtSeason);
  next.lowRotationStreak = playedLowRotation ? (next.lowRotationStreak || 0) + 1 : 0;

  // 6) Crecimiento (reparto del checkpoint) + castigo por lesión.
  const growth = rollSeasonGrowth(next, rng);
  const growthDelta = growth.delta;
  const injuryDelta = injury ? injury.ovrDelta : 0;
  next.growthCarry = growth.carry;
  if (growth.lowRotationTriggered) {
    next.lowRotationStreak = 0;
    events.push({
      season: seasonStart,
      type: 'low_rotation',
      message: 'Varias temporadas de poca rotación: el físico se resiente.',
    });
  }
  next.ovr = clampOvr(next.ovr + growthDelta + injuryDelta);
  next.overallPeak = Math.max(next.overallPeak, next.ovr);

  // 7) Estadísticas: acumular a la carrera y archivar la temporada.
  next.careerStats.pj += stats.pj;
  next.careerStats.gls += stats.gls;
  next.careerStats.ast += stats.ast;
  next.careerStats.cleanSheets += stats.cleanSheets;
  next.careerStats.matches.push({
    season: seasonStart,
    pj: stats.pj,
    gls: stats.gls,
    ast: stats.ast,
    cleanSheets: stats.cleanSheets,
  });

  const seasonReport = {
    season: seasonStart,
    age: ageStart,
    position: next.position,
    role: roleAtSeason,
    club: {
      key: clubKey(next.club),
      name: next.club.name,
      short: next.club.short,
      division: next.club.division,
    },
    pj: stats.pj,
    gls: stats.gls,
    ast: stats.ast,
    cleanSheets: stats.cleanSheets,
    ovrStart,
    ovrEnd: next.ovr,
    ovrDelta: next.ovr - ovrStart,
    growthDelta,
    injuryDelta,
    injury,
    trophies,
    lowRotationStreak: next.lowRotationStreak,
    lowRotationPenalty: growth.lowRotationTriggered,
    mandatoryRetirement: ageStart + 1 >= AGE.RETIRE,
  };

  next.seasonHistory.push(seasonReport);
  next.seasonStats = { pj: 0, gls: 0, ast: 0, cleanSheets: 0, matches: [] };

  // 8) Avanzar calendario y registrar los eventos del motor.
  next.age += 1;
  next.season += 1;
  next.events = [...(next.events || []), ...events];
  next.lastSeasonReport = seasonReport;

  // 9) Estado derivado recalculado (rol, reps, valor de mercado).
  return recomputeCareer(next);
}

// -----------------------------------------------------------------------------
// 4) MERCADO DE PASES — generateTransferOffers(career, options?)
// -----------------------------------------------------------------------------
// Bloque incremental: genera las ofertas del checkpoint SIN aceptar ninguna.
// Función PURA: no muta career, no muta el mundo ni config; solo lee y devuelve.
//
// Reglas respetadas de config.js (sección 10 y 10b):
// - OFFER_RULES.transferOfferCount ofertas por checkpoint ("quedarme" es una
//   opción aparte, stayAlwaysAvailable, no se devuelve como oferta).
// - OFFER_RULES.firstDivisionMinOvr: sin ese OVR no llegan ofertas de Primera.
// - OFFER_RULES.maxDivisionJumpUp / maxDivisionDrop acotan el salto de
//   división de cada oferta respecto de la división actual (jerarquía de DOS
//   categorías: Primera / Segunda; no existe una tercera).
// - playerTier + random walk de tier (OFFER_RULES.walkTier) deciden el nivel
//   NATURAL del destino de cada oferta (implementado acá con el RNG inyectable,
//   porque la variante de config usa Math.random interno).
// - FIRST_DIVISION_PUSH.firstDivisionOfferChance: en Segunda, un jugador con el
//   OVR y el rendimiento suficientes puede recibir Primera desde la PRIMERA
//   ventana. No depende de las temporadas que lleva en el club.
// - homeBiasWeight(ovr): con OVR bajo el mercado tiende a quedarse cerca
//   (misma división/barrio del club actual); con OVR alto, mercado libre.
// - marketValue estima el valor del jugador para cada oferta.
//
// options: { seed } para reproducibilidad o { rng } con la interfaz
// { next(): number, int(min, max): number } (la misma de createSeededRng).

/**
 * División objetivo para un tier caminado (-1..5) en la jerarquía jugable de
 * DOS categorías. La banda que antes era "Tercera" ahora es Segunda.
 *   tier >= 4 (OVR >= 83, crack) → Primera
 *   resto                        → Segunda
 */
function divisionForTier(tier) {
  return tier >= 4 ? TOP_DIVISION : BASE_DIVISION;
}

/** Random walk del tier con RNG inyectado (mismas probabilidades de config). */
function walkTierWithRng(tier, rng) {
  const clamped = Math.max(-1, Math.min(5, tier));
  const { stay, down } = OFFER_RULES.walkTier;
  const r = rng.next();
  if (clamped === -1) return r < stay ? -1 : 0;
  if (clamped === 5) return r < stay ? 5 : 4;
  if (r < down) return clamped - 1;
  if (r < down + stay) return clamped;
  return clamped + 1;
}

/** Acota la división objetivo a los saltos permitidos por OFFER_RULES. */
function clampTargetDivision(current, target, ovr) {
  const maxUp = current + OFFER_RULES.maxDivisionJumpUp;
  const minDown = current - OFFER_RULES.maxDivisionDrop;
  let clamped = Math.max(minDown, Math.min(maxUp, target));
  // Techo/piso REAL del mundo jugable: nunca una división que no exista.
  clamped = Math.max(TOP_DIVISION, Math.min(BASE_DIVISION, clamped));
  // Sin el OVR requerido, la Primera no ofrece (firstDivisionMinOvr).
  if (clamped === TOP_DIVISION && ovr < OFFER_RULES.firstDivisionMinOvr) clamped = BASE_DIVISION;
  return clamped;
}

/**
 * División objetivo de UNA oferta del mercado (jerarquía de DOS categorías).
 *
 * 1) Camina el tier del jugador y mapea el resultado a un nivel natural.
 * 2) Acota el salto con las reglas de OFFER_RULES (clampTargetDivision).
 * 3) Si el resultado no es Primera, tira la chance de ascenso de Primera:
 *    el OVR y el RENDIMIENTO del jugador —no las temporadas en el club—
 *    habilitan que el mercado de Primera aparezca ya, desde la primera ventana
 *    (FIRST_DIVISION_PUSH.firstDivisionOfferChance). Una tirada por oferta.
 *
 * Con OVR por debajo de firstDivisionMinOvr la chance es 0: sin el OVR
 * requerido la Primera no existe como destino (la regla sigue vigente).
 */
function offerTargetDivision(career, ovr, tier, rng) {
  const current = career.club.division;
  const natural = divisionForTier(tier);
  let target = clampTargetDivision(current, natural, ovr);

  const upgradeChance = firstDivisionOfferChance({
    ovr,
    overallVsBaseline: career.overallVsBaseline,
    role: career.role,
  });
  if (target !== TOP_DIVISION && rng.next() < upgradeChance) {
    target = TOP_DIVISION;
  }
  return target;
}

/** Peso de una candidata: cercanía al OVR del jugador + sesgo local. */
function candidateWeight(club, career, homeWeight) {
  const fit = 1 / (1 + Math.abs(career.ovr - clubBaseline(club)));
  const homeBoost = club.division === career.club.division ? 1 : 0;
  const barrioBoost = club.barrio === career.club.barrio ? 1 : 0;
  return fit * (1 + homeWeight * (homeBoost + barrioBoost));
}

/**
 * Motivo/contexto de la oferta, legible para la UI.
 * @returns {{ type: string, message: string }}
 */
function offerReason(career, club, targetBase) {
  const delta = targetBase - clubBaseline(career.club);
  const divisionDelta = club.division - career.club.division;
  if (divisionDelta < 0) {
    return {
      type: 'promotion',
      message: 'Proyecto ambicioso: te quieren como pieza clave del ascenso.',
    };
  }
  if (divisionDelta > 0) {
    return {
      type: 'safe_move',
      message: 'Te buscan para ser protagonista y recuperar rodaje.',
    };
  }
  if (delta >= 4) {
    return { type: 'big_club', message: 'Salto lateral a un plantel más fuerte.' };
  }
  if (delta <= -4) {
    return {
      type: 'leading_role',
      message: 'Te ofrecen un proyecto para liderar el equipo.',
    };
  }
  return { type: 'lateral', message: 'Interés de un club de nivel similar.' };
}

/**
 * Genera las ofertas del mercado de pases del checkpoint.
 * Devuelve SIEMPRE un array nuevo (posiblemente vacío). No acepta ninguna
 * transferencia: eso lo hace acceptTransfer, que aún no existe.
 *
 * @param {object} career Estado actual de la carrera (no se muta).
 * @param {{ seed?: number, rng?: { next: () => number, int: (min:number, max:number) => number } }} [options]
 * @returns {Array<object>} Ofertas para la UI.
 */
export function generateTransferOffers(career, options = {}) {
  // 0) RNG inyectable: rng explícito > seed > Math.random.
  const rng = options.rng || (options.seed != null ? createSeededRng(options.seed) : defaultRng);

  // 1) Si no corresponde generar ofertas, [] (sin mutar nada).
  const canOffer = Boolean(
    career &&
    !career.retired &&
    Number.isFinite(career.ovr) &&
    Number.isFinite(career.age) &&
    career.age >= AGE.START &&
    career.club &&
    findClub(career.club.slug)?.slug === career.club.slug,
  );
  if (!canOffer) return [];

  const ovr = clampOvr(career.ovr);
  const isGK = career.position === 'ARQ';
  const currentDivision = career.club.division;
  const baseTier = playerTier(ovr);
  const homeWeight = homeBiasWeight(ovr);
  const potential = Math.max(ovr, career.overallPeak || ovr);

  const offers = [];
  const usedSlugs = new Set([career.club.slug]);

  for (let i = 0; i < OFFER_RULES.transferOfferCount; i += 1) {
    // 2) Nivel de la oferta: random walk del tier del jugador + chance de
    //    ascenso a Primera por OVR/rendimiento (ver offerTargetDivision).
    const tier = walkTierWithRng(baseTier, rng);
    const targetDivision = offerTargetDivision(career, ovr, tier, rng);

    // 3) Candidatas de esa división (club actual excluido, sin repetidos).
    const candidates = clubsByDivision(targetDivision).filter(
      (club) => !usedSlugs.has(club.slug),
    );
    if (candidates.length === 0) {
      // División agotada: reintenta con la división actual como máximo seguro.
      const fallback = clubsByDivision(currentDivision).filter(
        (club) => !usedSlugs.has(club.slug),
      );
      if (fallback.length === 0) continue;
      candidates.push(...fallback);
    }

    // 4) Selección ponderada: fit con el baseline + homeBiasWeight.
    const weighted = candidates.map((club) => ({
      club,
      weight: candidateWeight(club, career, homeWeight),
    }));
    const chosen = pickWeighted(weighted, rng).club;
    usedSlugs.add(chosen.slug);

    const targetBase = clubBaseline(chosen);
    const reason = offerReason(career, chosen, targetBase);
    const expectedRole = roleBucket(ovr - targetBase, isGK);

    offers.push({
      id: `offer-${career.season}-${i + 1}`,
      // Destino.
      club: {
        key: clubKey(chosen),
        slug: chosen.slug,
        name: chosen.name,
        short: chosen.short,
        colors: { ...chosen.colors },
        barrio: chosen.barrio,
        stadium: chosen.stadium,
      },
      division: chosen.division,
      divisionDelta: chosen.division - currentDivision,
      // Contexto y condiciones.
      reason: reason.type,
      message: reason.message,
      // Datos para la UI.
      clubBaseline: targetBase,
      clubOvr: chosen.ovr,
      clubReputation: domesticReputation(chosen),
      playerOvr: ovr,
      expectedRole,
      roleLabel: ROLE_LABELS[expectedRole],
      estimatedValue: marketValue({
        ovr,
        age: career.age,
        reputation: domesticReputation(chosen),
        potential,
      }),
      age: career.age,
      position: career.position,
      ovrVsBaseline: ovr - targetBase + roleMargin(career.attrs),
    });
  }

  return offers;
}

// -----------------------------------------------------------------------------
// 5) ACEPTAR OFERTA — acceptTransfer(career, offer)
// -----------------------------------------------------------------------------
// Bloque incremental: consume UNA oferta generada por generateTransferOffers y
// devuelve una NUEVA carrera con el traspaso aplicado. Función PURA:
// - No muta `career` (trabaja siempre sobre cloneCareer, como simulateSeason).
// - No muta `offer` (solo la lee).
// - No genera nuevas ofertas ni simula temporadas: eso sigue siendo tarea del
//   flujo (generateTransferOffers / simulateSeason).
//
// Estrategia ante entradas inválidas (oferta rota, club inexistente, mismo
// club actual, división inconsistente, números no finitos, carrera retirada,
// etc.): se devuelve una NUEVA carrera SIN cambios. Nunca se lanza: son casos
// normales de UI, no excepciones.
//
// Historial de clubes (clubHistory): lista de etapas ("stints"). Cada entrada
// registra el club al que el jugador LLEGA:
//   { club, division, fromAge, fromSeason, via }
// El cierre de cada etapa queda implícito en el fromAge/fromSeason de la
// entrada siguiente (o en la edad/temporada actuales si es la última). Así la
// UI puede reconstruir rangos tipo "16-18 años · Boca Juniors · D2" sin
// datos redundantes que puedan desincronizarse.
// Compatibilidad: los saves anteriores a este bloque tienen clubHistory vacío
// (nunca hubo traspasos: solo existía simulateSeason, que no mueve clubes).
// En el primer traspaso se siembra la etapa inicial del club de cantera,
// reconstruida desde AGE.START con la temporada de creación
// (season - (age - AGE.START)).

/** Referencia estable y liviana de un club, para historial y eventos. */
function clubRef(club) {
  return {
    key: clubKey(club),
    slug: club.slug,
    name: club.name,
    short: club.short,
    barrio: club.barrio,
    stadium: club.stadium,
    division: club.division,
    colors: { ...club.colors },
  };
}

/** Entrada de clubHistory: el club al que el jugador llega, y cuándo. */
function clubHistoryEntry(club, fromAge, fromSeason, via) {
  return {
    club: clubRef(club),
    division: club.division,
    fromAge,
    fromSeason,
    via,
  };
}

/**
 * Acepta una oferta del mercado de pases y devuelve una NUEVA carrera.
 *
 * Secuencia al aceptar:
 *   1) Valida la carrera (no retirada, números finitos que consume el
 *      recálculo de estado derivado, club actual existente en el mundo) y la
 *      oferta (club, división y valor finito). Inválida → nueva carrera sin
 *      cambios.
 *   2) Resuelve el club destino contra el mundo (el slug es el id estable de
 *      los saves; el key compuesto "division/slug" sirve de fallback) y
 *      exige que sea distinto al actual y con la división declarada.
 *   3) Siembra la etapa inicial en clubHistory si está vacía (saves previos)
 *      y registra la etapa del club destino.
 *   4) Reemplaza el club actual por el club canónico del mundo (copia fresca).
 *   5) Invalida las ofertas pendientes guardadas en el save, si existen.
 *   6) Registra el evento de carrera con la convención del motor
 *      ({ season, type, message }) más los datos del movimiento.
 *   7) Recalcula el estado derivado (reputación, baseline, rol, valor de
 *      mercado) vía recomputeCareer. OVR, atributos, estadísticas, trofeos,
 *      logros y eventos previos quedan intactos.
 *
 * @param {object} career Estado actual de la carrera (no se muta).
 * @param {object} offer  Oferta generada por generateTransferOffers (no se muta).
 * @returns {object} Nueva carrera con el traspaso, o sin cambios si la
 *                   entrada es inválida (nunca lanza).
 */
export function acceptTransfer(career, offer) {
  // 0) Carrera inutilizable: no hay nada que transferir (sin lanzar).
  if (!career || typeof career !== 'object') return career;

  // Copia de trabajo: desde acá la carrera original jamás se toca.
  const next = cloneCareer(career);

  // 1) Validación de la carrera (mismo espíritu que generateTransferOffers,
  //    más los números finitos que consume el recálculo de estado derivado).
  const attrsOk = Boolean(
    next.attrs &&
    typeof next.attrs === 'object' &&
    Object.values(next.attrs).every((value) => Number.isFinite(value)),
  );
  //    club: null es válido SOLO para una carrera nueva esperando su elección
  //    de debut (nace sin club); con club presente la validación estricta de
  //    siempre (slug real del mundo).
  const clubOk = (next.club == null)
    || (typeof next.club.slug === 'string' && findClub(next.club.slug)?.slug === next.club.slug);
  const careerValid = Boolean(
    !next.retired &&
    Number.isFinite(next.ovr) &&
    Number.isFinite(next.age) &&
    next.age >= AGE.START &&
    Number.isFinite(next.season) &&
    Number.isFinite(next.overallPeak) &&
    attrsOk &&
    clubOk,
  );
  if (!careerValid) return next;

  // 2) Validación de la oferta: datos presentes y numéricos finitos.
  const offerValid = Boolean(
    offer &&
    typeof offer === 'object' &&
    offer.club &&
    typeof offer.club === 'object' &&
    Number.isFinite(offer.division) &&
    Number.isFinite(offer.estimatedValue),
  );
  if (!offerValid) return next;

  // 3) Club destino: resolverlo contra el mundo y exigir coherencia:
  //    distinto al club actual, con división declarada y división real.
  const target = (typeof offer.club.slug === 'string' && offer.club.slug)
    ? findClub(offer.club.slug)
    : findClubByKey(offer.club.key);
  if (!target) return next;                                   // club inexistente
  if (next.club && target.slug === next.club.slug) return next; // mismo club actual
  if (offer.division !== target.division) return next;         // oferta inconsistente
  if (!divisions.some((d) => d.nivel === offer.division)) return next; // división inválida

  // 4) Historial de clubes: la etapa inicial solo se siembra si la carrera YA
  //    tenía club (compatibilidad con saves previos). La carrera nueva que
  //    nace sin club entra directo con SU primera etapa (la del debut elegido).
  if (next.club && (!Array.isArray(next.clubHistory) || next.clubHistory.length === 0)) {
    next.clubHistory = [clubHistoryEntry(
      next.club,
      AGE.START,
      next.season - (next.age - AGE.START),
      'career_start',
    )];
  }
  next.clubHistory = [
    ...(Array.isArray(next.clubHistory) ? next.clubHistory : []),
    clubHistoryEntry(target, next.age, next.season, next.club ? 'transfer' : 'career_start'),
  ];

  // 5) Nuevo club actual: copia fresca del club canónico del mundo (nunca se
  //    comparte referencia con los datos del mundo ni con la oferta).
  const fromClub = next.club;
  next.club = { ...target, colors: { ...target.colors } };

  // 6) Ofertas pendientes guardadas en el save: invalidadas si existen.
  if (Array.isArray(next.pendingOffers)) next.pendingOffers = [];
  if (Array.isArray(next.offers)) next.offers = [];

  // 7) Evento de carrera con la convención del motor (season/type/message)
  //    más los datos del movimiento de división y el contexto del traspaso.
  const transferEvent = {
    season: next.season,
    type: 'transfer',
    message: fromClub
      ? `Traspaso de ${fromClub.name} (D${fromClub.division}) a ${target.name} (D${target.division}).`
      : `Firma en ${target.name} (D${target.division}): primer contrato profesional.`,
    ...(fromClub ? { fromClub: clubRef(fromClub), fromDivision: fromClub.division } : {}),
    toClub: clubRef(target),
    toDivision: target.division,
    playerOvr: next.ovr,
    estimatedValue: offer.estimatedValue,
  };
  next.events = [...(next.events || []), transferEvent];

  // 8) Estado derivado del nuevo club: reputación, baseline, rol y valor de
  //    mercado (misma vía que simulateSeason).
  return recomputeCareer(next);
}

// -----------------------------------------------------------------------------
// 6) QUEDARSE EN EL CLUB — resolveStay(career, options?)
// -----------------------------------------------------------------------------
// Bloque incremental: representa la decisión "QUEDARME" del checkpoint (la
// opción que OFFER_RULES.stayAlwaysAvailable promete junto a las ofertas).
// Función PURA: no muta `career`, devuelve una NUEVA carrera (cloneCareer).
//
// Reglas respetadas de config.js (sección 10):
// - OFFER_RULES.loyaltyOvrBonus: bonus de lealtad [min, max] de OVR al
//   quedarse (portado del evento rival_offer de copero). Se muestrea con el
//   RNG inyectable del motor (rng > seed > default) y aplica clampOvr, con
//   overallPeak y estado derivado re-normalizados por recomputeCareer (la
//   MISMA vía que simulateSeason y acceptTransfer). Con delta 0 el OVR, el
//   valor y todo lo demás quedan intactos.
// - OFFER_RULES.stayAlwaysAvailable: quedarse no consume ni ejecuta ninguna
//   oferta: solo invalida las decisiones pendientes del checkpoint.
//
// Ofertas pendientes (coherencia con el resto del engine):
// - pendingOffers / offers (arrays del save): limpiadas si existen, igual que
//   hace acceptTransfer al cerrar un checkpoint con traspaso.
// - pendingTransfer (metadata de eventos interactivos de events.js): al
//   quedarse la decisión de traspaso queda resuelta como "no transferirse",
//   así que se limpia (null). NO se ejecuta acceptTransfer.
//
// Evento de permanencia: misma convención del motor que injury/trophy/
// transfer ({ season, type, message }). Sin sistema nuevo de eventos.
//
// Retiro: NO implementa retireCareer (tarea del flujo). Si la carrera ya está
// retirada o alcanzó la edad de retiro, devuelve una copia intacta (misma
// guarda que simulateSeason) sin bonus ni eventos.
//
// Entradas inválidas (null, undefined, objetos incompletos): copia segura sin
// lanzar excepciones (misma estrategia que acceptTransfer/simulateSegment).
//
// Contrato de retorno:
// {
//   career: <nueva carrera>,
//   action: 'stay',
//   loyaltyOvrBonus: <delta de OVR aplicado (0 si no aplicó)>,
// }

export function resolveStay(career, options = {}) {
  // 0) Entrada inutilizable: copia segura sin lanzar (casos normales de UI).
  const base = (career && typeof career === 'object') ? career : {};
  const next = cloneCareer(base);

  // 1) Retiro (ya retirada o edad alcanzada): copia intacta, sin bonus ni
  //    eventos (misma guarda que simulateSeason; no inventa lógica nueva).
  if (next.retired || (Number.isFinite(next.age) && next.age >= AGE.RETIRE)) {
    return { career: next, action: 'stay', loyaltyOvrBonus: 0 };
  }

  // 2) Carrera válida para el bonus de lealtad: OVR y club presentes y
  //    finitos/coherentes (misma exigencia de club que generateTransferOffers).
  //    Sin carrera válida no hay bonus ni evento: copia intacta.
  const stayValid = Boolean(
    !next.retired &&
    Number.isFinite(next.ovr) &&
    next.club &&
    findClub(next.club.slug)?.slug === next.club.slug,
  );
  if (!stayValid) {
    return { career: next, action: 'stay', loyaltyOvrBonus: 0 };
  }

  // 3) Bonus de lealtad (OFFER_RULES.loyaltyOvrBonus): entero muestreado del
  //    rango [min, max] con el RNG del motor. Con rango vacío o delta 0 no
  //    toca nada (no RNG innecesario en el resultado observable).
  const rng = resolveRng(options);
  const [minBonus, maxBonus] = OFFER_RULES.loyaltyOvrBonus;
  const lo = Math.min(minBonus, maxBonus);
  const hi = Math.max(minBonus, maxBonus);
  const loyaltyOvrBonus = (hi > lo) ? rng.int(lo, hi) : lo;

  if (loyaltyOvrBonus !== 0) {
    next.ovr = clampOvr(next.ovr + loyaltyOvrBonus);
    next.overallPeak = Math.max(next.overallPeak ?? next.ovr, next.ovr);
  }

  // 4) Ofertas pendientes resueltas: quedarse NO ejecuta acceptTransfer, solo
  //    cierra el checkpoint. Mismo criterio de limpieza que acceptTransfer.
  if (Array.isArray(next.pendingOffers)) next.pendingOffers = [];
  if (Array.isArray(next.offers)) next.offers = [];
  if (next.pendingTransfer != null) next.pendingTransfer = null;

  // 5) Evento de permanencia (convención { season, type, message }).
  next.events = [...(next.events || []), {
    season: next.season,
    type: 'stay',
    message: `Seguís en ${next.club.name} (D${next.club.division}).`
      + (loyaltyOvrBonus > 0 ? ` El club te renueva con confianza: +${loyaltyOvrBonus} de OVR.` : ''),
    clubKey: clubKey(next.club),
    clubSlug: next.club.slug,
    loyaltyOvrBonus,
  }];

  // 6) Estado derivado re-normalizado (rep, baseline, rol, valor de mercado):
  //    la MISMA vía que simulateSeason/acceptTransfer. Si el bonus fue 0 es
  //    determinista y no altera ningún valor.
  return { career: recomputeCareer(next), action: 'stay', loyaltyOvrBonus };
}

// -----------------------------------------------------------------------------
// 7) OFERTAS DE CANTERA (DEBUT) — generateYouthOffers(careerOrPlayer, options?)
// -----------------------------------------------------------------------------
// Primera elección de club del modo carrera. El pool es SIEMPRE ARGENTINO
// (countryCode 'AR', dato real del catálogo) y las 3 ofertas salen de UNA SOLA
// división, sorteada entre las elegibles del jugador:
//   - elegibles: startingDivisionsForOvr(ovr) → [1, 2] (OVR >= 76) o [2] (debajo)
//   - la división inicial se sortea con el RNG del motor (no hay RNG paralelo):
//     mismo seed → misma división; seeds distintos → puede cambiar Primera/Segunda
//   - la oferta nunca sale de una tercera categoría (no existe en el mundo)
// El pool de cada división es amplio (AR: 9 clubes en Primera, 57 en Segunda),
// así que las 3 ofertas no son siempre las mismas.
//
// Reglas del bloque:
// - Función PURA: no muta `career` (ni club, ni clubHistory, ni events), no
//   crea transferencias y no toca offers pendientes. Eso lo hará el flujo
//   (flow/UI) llamando a acceptTransfer con la oferta elegida.
// - createCareer() nace SIN club; si la entrada trae un club (override
//   explícito initialClubSlug de tests o carrera en curso), ese club se
//   excluye del pool para no ofrecer el propio club actual.
// - Selección: muestreo ponderado SIN repetición con el RNG del motor
//   (rng > seed > Math.random). El peso favorece los clubes de MENOR OVR DENTRO
//   de la división sorteada (cuadrático contra el tope del pool), sin limitarse
//   a los 3 menores absolutos: todos los clubes del pool pueden salir, con
//   distinto seed cambian las ofertas y con el mismo seed se repiten exactas.
// - El OVR del club nunca se muestra en la UI: es dato interno de la oferta.
// - Estrategia ante entradas inutilizables (null, career retirada, sin OVR
//   derivable, datos no finitos): [] sin lanzar excepciones.
//
// Acepta una CAREER (createCareer u objeto mínimo con ovr/attrs/position/age)
// o un PLAYER crudo de data.js (rating + atributos): el OVR se resuelve con
// initialOvr(player.rating) o career.ovr, siempre clamped.
// -----------------------------------------------------------------------------

/** Atributos neutros para carreras mínimas sin attrs (no NaN en roleMargin). */
const NEUTRAL_ATTRS = { pace: 5, shooting: 5, passing: 5, dribbling: 5, defense: 5, physical: 5 };

/** País del pool inicial de debut (dato real del catálogo: countryCode). */
const YOUTH_POOL_COUNTRY = 'AR';

/**
 * División del debut: sorteo UNIFORME entre las elegibles del OVR del jugador
 * con el RNG del motor (nunca un RNG paralelo, nunca Math.random).
 * Con una sola elegible no se consume azar (no hay nada que sortear).
 */
function pickYouthDivision(eligible, rng) {
  if (!Array.isArray(eligible) || eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];
  return eligible[rng.int(0, eligible.length - 1)];
}

/** Pool de cantera de UNA división: clubes argentinos de ese nivel interno. */
function youthDivisionPool(nivel, excludeSlug) {
  return clubs.filter((club) => club.countryCode === YOUTH_POOL_COUNTRY
    && club.division === nivel
    && Number.isFinite(club.ovr)
    && club.slug !== excludeSlug);
}

/**
 * Pool del debut: el de la división sorteada y, si quedara vacío (país sin
 * clubes de ese nivel), el de la siguiente elegible como fallback. Jamás una
 * división fuera de las elegibles del jugador.
 */
function youthInitialPool(eligible, preferred, excludeSlug) {
  const order = [preferred, ...eligible.filter((nivel) => nivel !== preferred)];
  for (const nivel of order) {
    const pool = youthDivisionPool(nivel, excludeSlug);
    if (pool.length > 0) return pool;
  }
  return [];
}

/**
 * Peso de una candidata: favorece el MENOR OVR DENTRO de la división sorteada
 * (cuadrático contra el tope del pool). Todos los clubes del pool pueden salir,
 * pero los clubes modestos salen con bastante más frecuencia (no son siempre
 * los 3 menores).
 */
function youthPoolWeight(club, poolMaxOvr) {
  const delta = poolMaxOvr + 1 - club.ovr;
  return delta * delta;
}

/** Mensaje de la oferta de debut, legible para la UI. */
function youthOfferMessage(club, division) {
  return `Oferta de debut de ${club.name} (${division.name}): te vimos en la cantera y queremos tu primer contrato profesional.`;
}

/**
 * Genera las ofertas de debut/cantera (hasta OFFER_RULES.youthOfferCount).
 * Devuelve SIEMPRE un array nuevo (posiblemente vacío). No acepta ninguna
 * transferencia: eso lo hace acceptTransfer con la oferta que elija el jugador.
 *
 * @param {object} input Carrera (createCareer o mínima) o player de data.js.
 * @param {{ seed?: number, rng?: { next: () => number, int: (min:number, max:number) => number } }} [options]
 * @returns {Array<object>} Ofertas de debut para la UI.
 */
export function generateYouthOffers(input, options = {}) {
  // 0) Entrada inutilizable: [] sin lanzar (casos normales de UI/flow).
  if (!input || typeof input !== 'object' || input.retired) return [];

  // 1) OVR del debut: de la carrera (ovr) o del player crudo (rating), clamped.
  const isCareer = Number.isFinite(input.ovr);
  const rawOvr = isCareer ? input.ovr : (Number.isFinite(input.rating) ? initialOvr(input.rating) : NaN);
  if (!Number.isFinite(rawOvr)) return [];
  const ovr = clampOvr(rawOvr);

  // 2) Atributos tolerantes: career completa → sus attrs; career mínima sin
  //    attrs → neutros; player crudo → sus stats de data.js. Nunca NaN.
  const attrs = (input.attrs && Object.values(input.attrs).every((v) => Number.isFinite(v)))
    ? input.attrs
    : (input.pace != null && Number.isFinite(input.pace) ? {
        pace: input.pace,
        shooting: input.shooting,
        passing: input.passing,
        dribbling: input.dribbling,
        defense: input.defense,
        physical: input.physical,
      } : NEUTRAL_ATTRS);
  if (!Object.values(attrs).every((v) => Number.isFinite(v))) return [];

  // 3) RNG inyectable con la misma cadena del motor: rng > seed > Math.random.
  const rng = (options.rng && typeof options.rng.next === 'function')
    ? options.rng
    : (options.seed != null ? createSeededRng(options.seed) : defaultRng);

  const age = Number.isFinite(input.age) ? input.age : AGE.START;
  if (age < AGE.START) return []; // antes de la edad de debut no hay cantera
  const position = input.position || (isCareer ? 'MED' : suggestedPosition({ ...attrs }));
  const isGK = position === 'ARQ';
  const count = OFFER_RULES.youthOfferCount;

  // 4) División del debut: SE SORTEA entre las elegibles del OVR del jugador
  //    (no todas las carreras arrancan en Segunda ni todas en Primera). El club
  //    actual (si la entrada trae uno por override) queda excluido del pool.
  const excludeSlug = (input.club && typeof input.club.slug === 'string') ? input.club.slug : null;
  const eligible = startingDivisionsForOvr(ovr);
  if (eligible.length === 0) return [];
  const preferred = pickYouthDivision(eligible, rng);
  const pool = youthInitialPool(eligible, preferred, excludeSlug);
  if (pool.length === 0) return [];
  const poolMaxOvr = Math.max(...pool.map((club) => club.ovr));

  const offers = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    // 5) Club: muestreo ponderado SIN repetición con el RNG del motor
    //    (rng > seed > Math.random): el club más modesto del pool pesa más.
    const chosen = pickWeighted(
      pool.map((club) => ({ club, weight: youthPoolWeight(club, poolMaxOvr) })),
      rng,
    ).club;
    pool.splice(pool.indexOf(chosen), 1);

    // 6) Oferta de debut con la estructura que consume acceptTransfer + UI.
    //    clubOvr/clubBaseline/etc. son datos INTERNOS: la UI NO los muestra.
    const division = divisions.find((d) => d.nivel === chosen.division)
      || { name: `División ${chosen.division}` };
    const base = clubBaseline(chosen);
    const rep = domesticReputation(chosen);
    const expectedRole = roleBucket(ovr - base, isGK);

    offers.push({
      id: `youth-offer-${i + 1}`,
      club: {
        key: clubKey(chosen),
        slug: chosen.slug,
        name: chosen.name,
        short: chosen.short,
        colors: { ...chosen.colors },
        barrio: chosen.barrio,
        stadium: chosen.stadium,
      },
      division: chosen.division,
      // Contexto: debut / cantera.
      reason: 'youth_debut',
      message: youthOfferMessage(chosen, division),
      // Datos para la lógica interna (la UI no muestra el OVR del club).
      clubBaseline: base,
      clubOvr: chosen.ovr,
      clubReputation: rep,
      playerOvr: ovr,
      expectedRole,
      roleLabel: ROLE_LABELS[expectedRole],
      estimatedValue: marketValue({ ovr, age, reputation: rep, potential: ovr }),
      age,
      position,
      ovrVsBaseline: ovr - base + roleMargin(attrs),
    });
  }

  return offers;
}


// -----------------------------------------------------------------------------
// 8) SEGMENTO DE TEMPORADAS — simulateSegment(career, seasons, options?)
// -----------------------------------------------------------------------------
// Orquestador PURO: simula `seasons` temporadas consecutivas reutilizando
// simulateSeason() como motor de cada temporada. NO recalcula OVR, crecimiento,
// valor, reputación ni stats: toda la evolución viene de simulateSeason();
// acá solo se encadena y se corta cuando corresponde.
//
// Contrato:
// - No muta `career` (ni club, clubHistory, events, seasonHistory, careerStats):
//   devuelve una carrera NUEVA (cloneCareer + simulateSeason, que ya clonan).
// - RNG con la misma prioridad del resto del engine:
//     options.rng → options.seed (createSeededRng) → RNG por defecto.
//   Con seed se crea UNA instancia para TODO el segmento: cada temporada
//   consume la siguiente tira de azar (nunca la misma repetida por temporada).
//   Nunca usa Math.random() directamente.
// - Simulación SECUENCIAL: cada temporada se simula sobre el resultado de la
//   anterior (OVR, valor, edad, stats acumulados, streaks e historial
//   evolucionan entre temporada y temporada).
// - Retiro: respeta la lógica ACTUAL de simulateSeason. Si la carrera ya está
//   retirada o alcanza la edad de retiro durante el segmento, se detiene, no
//   intenta simular temporadas posteriores y lo reporta en stoppedReason.
//   No aplica el retiro en sí (retireCareer sigue siendo tarea del flujo).
// - `seasons` inválido (null, undefined, NaN, Infinity, <= 0): devuelve una
//   copia válida de la carrera sin simular nada, sin lanzar excepciones.
//   Si es decimal se normaliza con Math.floor (determinista: 2.9 → 2).
// - lastSeasonReport, pendingCelebrations y events los administra
//   simulateSeason(); este bloque solo los conserva entre temporadas.
//
// Devuelve (para la UI):
// {
//   career: <carrera final>,
//   seasonsSimulated: <temporadas realmente simuladas>,
//   seasonReports: [<reporte de cada temporada, en orden cronológico>],
//   stoppedReason: null | 'retirement',
// }

export function simulateSegment(career, seasons, options = {}) {
  // 0) Carrera inutilizable: sin simular, sin lanzar (casos de UI/flow).
  if (!career || typeof career !== 'object') {
    return { career, seasonsSimulated: 0, seasonReports: [], stoppedReason: null };
  }

  // 1) Normalización determinista de `seasons`. Number() cubre los casos
  //    pedidos (null → 0; undefined/NaN/Infinity → no finito) y decimales.
  //    Nada válido → copia intacta, cero temporadas.
  const requested = Number(seasons);
  const target = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 0;

  // 2) RNG del segmento con la prioridad estándar del engine (rng > seed >
  //    default). El mismo rng acompaña todas las temporadas del segmento.
  const rng = resolveRng(options);
  const seasonOptions = { rng };

  // 3) Simulación secuencial. El pre-check replica la guarda de simulateSeason
  //    (retired / edad de retiro) para no intentar temporadas de más; el
  //    post-check detecta el retiro alcanzado en la temporada recién cerrada.
  let current = cloneCareer(career);
  const seasonReports = [];
  let seasonsSimulated = 0;
  let stoppedReason = null;

  for (let i = 0; i < target; i += 1) {
    if (current.retired || current.age >= AGE.RETIRE) {
      stoppedReason = 'retirement';
      break;
    }

    current = simulateSeason(current, seasonOptions);
    seasonsSimulated += 1;
    // El reporte lo publica simulateSeason (lastSeasonReport, el mismo objeto
    // archivado en seasonHistory): se reutiliza, no se duplica información.
    if (current.lastSeasonReport) seasonReports.push(current.lastSeasonReport);

    if (current.retired || current.age >= AGE.RETIRE) {
      // La temporada recién cerrada alcanzó el retiro obligatorio: el segmento
      // termina acá (el detalle queda en el reporte: mandatoryRetirement).
      stoppedReason = 'retirement';
      break;
    }
  }

  return { career: current, seasonsSimulated, seasonReports, stoppedReason };
}

// -----------------------------------------------------------------------------
// 9) RETIRO DE CARRERA — retireCareer(career)
// -----------------------------------------------------------------------------
// Bloque incremental: cierra formalmente la carrera cuando el jugador se
// retira (por edad obligatoria o decisión del flujo). Función PURA:
// - No muta `career`: devuelve una NUEVA carrera (cloneCareer, como el resto
//   del engine). Nunca se toca la original.
// - No simula temporadas, no avanza edad/temporada, no toca OVR ni valor de
//   mercado: cierra la carrera EN su estado actual. La decisión de CUÁNDO
//   retirarse sigue siendo tarea del flujo (simulateSeason marca
//   mandatoryRetirement; el flujo llama acá).
// - No recalcula estadísticas ni estado derivado: el cierre usa SOLO lo ya
//   acumulado (careerStats, seasonHistory, clubHistory, trophies,
//   overallPeak). Sin sistema paralelo de stats y sin RNG (es determinista).
//
// Estado de cierre:
// - retired: true — el flag que TODAS las guardas del motor ya respetan
//   (simulateSeason, simulateSegment, generateTransferOffers, acceptTransfer,
//   resolveStay y generateYouthOffers rechazan carreras retiradas).
// - pendingOffers / offers / pendingTransfer: decisiones pendientes de
//   traspaso limpiadas (misma limpieza que acceptTransfer/resolveStay al
//   cerrar un checkpoint). No se inventan si el save no las tiene.
// - events: UN evento de retiro con la convención del motor
//   ({ season, type, message } + datos del cierre). No se duplica: si la
//   carrera ya está retirada, se devuelve una copia intacta.
// - achievements: se evalúa el catálogo ACHIEVEMENTS de config.js (las reglas
//   de logros de retiro que YA existen: partidos, goles, asistencias, peak de
//   OVR, títulos, clubes y lesiones). Acumulativo: se conservan los logros
//   previos y solo se agregan los nuevos, sin duplicados (por id).
//
// Idempotencia: retireCareer(retireCareer(c)) produce lo mismo que
// retireCareer(c) — la guarda de `retired` corta en la segunda llamada.
//
// Entradas inválidas (null, undefined, strings, numbers, objetos incompletos):
// copia segura sin lanzar excepciones (misma estrategia de resolveStay/
// acceptTransfer/simulateSegment). Nunca se inventa una carrera desde cero.
//
// Contrato de retorno: retireCareer(career) → nueva career (retorno directo,
// consistente con createCareer/simulateSeason; sin wrapper { career, action }
// porque no hace falta: no hay decisiones que reportar).

/** Stats de carrera con fallbacks seguros (sin NaN) para checks y evento. */
function retirementStats(career) {
  const stats = (career.careerStats && typeof career.careerStats === 'object')
    ? career.careerStats
    : {};
  const num = (value) => (Number.isFinite(value) ? value : 0);
  return { pj: num(stats.pj), gls: num(stats.gls), ast: num(stats.ast) };
}

/** Clubes distintos de la carrera: etapas de clubHistory + club actual. */
function careerClubCount(career) {
  const slugs = new Set();
  const history = Array.isArray(career.clubHistory) ? career.clubHistory : [];
  for (const entry of history) {
    if (entry && entry.club && entry.club.slug) slugs.add(entry.club.slug);
  }
  if (career.club && career.club.slug) slugs.add(career.club.slug);
  return slugs.size;
}

/**
 * Evalúa el catálogo ACHIEVEMENTS (config.js) sobre la carrera completa y
 * devuelve los logros acumulados: los previos intactos + los nuevos, sin
 * duplicar por id. Solo produce entradas del catálogo ({ id, label, season }),
 * con la misma forma de entrada que ya usa el save ({ id, label }).
 */
function evaluateRetirementAchievements(career) {
  const existing = Array.isArray(career.achievements) ? career.achievements : [];
  // Ids ya conseguidos (tolera entradas string de saves hipotéticos).
  const earnedIds = new Set(
    existing
      .map((entry) => (entry && typeof entry === 'object' ? entry.id : entry))
      .filter((id) => typeof id === 'string'),
  );

  // Argumentos de las reglas del catálogo:
  //   check(t, ovrPeak, trophies, clubCount, injuries) con t = { pj, gls, ast }.
  const stats = retirementStats(career);
  // overallPeak es el que el engine ya mantiene durante la carrera (se respeta
  // tal cual); si el save no lo trae, el OVR actual es el fallback prudente.
  const ovrPeak = Number.isFinite(career.overallPeak)
    ? career.overallPeak
    : (Number.isFinite(career.ovr) ? career.ovr : 0);
  const trophies = Array.isArray(career.trophies) ? career.trophies : [];
  const clubCount = careerClubCount(career);
  const injuries = Number.isFinite(career.injuries) ? career.injuries : 0;
  const season = Number.isFinite(career.season) ? career.season : null;

  const earned = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!achievement || typeof achievement.id !== 'string') continue;
    if (earnedIds.has(achievement.id)) continue;
    let achieved = false;
    try {
      achieved = Boolean(achievement.check(stats, ovrPeak, trophies, clubCount, injuries));
    } catch {
      achieved = false; // una regla rota del catálogo jamás tumba el retiro
    }
    if (achieved) {
      earned.push({ id: achievement.id, label: achievement.label, season });
      earnedIds.add(achievement.id);
    }
  }
  return [...existing, ...earned];
}

/** Evento de retiro con la convención { season, type, message } del motor. */
function retirementEvent(career) {
  const stats = retirementStats(career);
  const trophies = Array.isArray(career.trophies) ? career.trophies : [];
  const trophiesNoun = trophies.length === 1 ? 'título' : 'títulos';

  let message = 'Se retira del fútbol';
  if (Number.isFinite(career.age)) message += ` a los ${career.age} años`;
  if (career.club && career.club.name) {
    const divisionLabel = Number.isFinite(career.club.division)
      ? ` (D${career.club.division})`
      : '';
    message += `. Su último club fue ${career.club.name}${divisionLabel}`;
  }
  message += `. Cierre de carrera: ${stats.pj} PJ, ${stats.gls} goles, `
    + `${stats.ast} asistencias y ${trophies.length} ${trophiesNoun}.`;

  const event = {
    season: Number.isFinite(career.season) ? career.season : null,
    type: 'retirement',
    message,
  };
  // Datos de cierre con las mismas claves que usan los demás eventos.
  if (career.club && typeof career.club === 'object') {
    if (career.club.slug != null) event.clubSlug = career.club.slug;
    if (career.club.slug != null && career.club.division != null) {
      event.clubKey = clubKey(career.club);
    }
  }
  event.playerOvr = Number.isFinite(career.ovr) ? career.ovr : null;
  event.overallPeak = Number.isFinite(career.overallPeak) ? career.overallPeak : null;
  event.pj = stats.pj;
  event.gls = stats.gls;
  event.ast = stats.ast;
  event.trophies = trophies.length;
  return event;
}

/**
 * Cierra formalmente la carrera cuando el jugador se retira y devuelve una
 * NUEVA carrera (la original queda intacta). Ver el bloque 9 para el detalle
 * del contrato: pura, idempotente, sin simular nada, con los logros del
 * catálogo ACHIEVEMENTS evaluados sobre toda la carrera.
 *
 * @param {object} career Estado actual de la carrera (no se muta).
 * @returns {object} Nueva carrera con el retiro aplicado (o copia segura si
 *                   la entrada no es una carrera utilizable; nunca lanza).
 */
export function retireCareer(career) {
  // 0) Entrada inutilizable: copia segura sin lanzar (casos normales de UI).
  const base = (career && typeof career === 'object') ? career : {};
  const next = cloneCareer(base);

  // 1) Idempotencia: carrera ya retirada → copia intacta. Sin duplicar
  //    eventos/logros, sin tocar stats, sin volver a cerrar la carrera.
  if (next.retired === true) return next;

  // 2) Cierre del estado: retired es el flag que las guardas del motor ya
  //    respetan (no hay que inventar ningún mecanismo nuevo de cierre).
  next.retired = true;

  // 3) Sin decisiones pendientes de traspaso (misma limpieza que
  //    acceptTransfer/resolveStay al cerrar un checkpoint).
  if (Array.isArray(next.pendingOffers)) next.pendingOffers = [];
  if (Array.isArray(next.offers)) next.offers = [];
  if (next.pendingTransfer != null) next.pendingTransfer = null;

  // 4) Logros de retiro: catálogo ACHIEVEMENTS de config.js, acumulativo y
  //    sin duplicados. Todo lo demás (stats, trophies, peak, valor, eventos
  //    previos) queda exactamente como estaba.
  next.achievements = evaluateRetirementAchievements(next);

  // 5) Evento de retiro, una sola vez (la guarda de (1) evita duplicados).
  next.events = [...(next.events || []), retirementEvent(next)];

  return next;
}


