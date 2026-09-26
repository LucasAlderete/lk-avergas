// ============================================================================
// CONFIG DEL MODO CARRERA — reglas de balance (Paso 2)
// ============================================================================
// Configuración PURA del dominio: tablas, umbrales y funciones de balance que
// consumirá el motor (features/career/engine.js, paso 3). Sin React, sin
// localStorage, sin efectos. Todo lo exportable del juego vive acá para poder
// balancear sin números mágicos dispersos en el motor.
//
// Referencia de mecánicas: copero-clone (motor de Copero recreado), adaptado a
// fútbol 5/6 y a los jugadores reales del grupo (data.js):
// - Escala de partidos por temporada menor que fútbol 11 (24–36).
// - Tasas de gol/asistencia recalibradas (futsal = más goles por partido).
// - Perfil de desarrollo DERIVADO de los atributos del amigo (determinista),
//   no aleatorio: cada amigo tiene el mismo "destino atlético".
// - OVR inicial derivado de player.rating (con tope para que el chiste de
//   Tigre 99 no rompa el balance).
//
// Este archivo NO decide nada en runtime: expone datos + funciones puras.
// ============================================================================

// ---------------------------------------------------------------------------
// 1) CICLO DE VIDA Y OVR
// ---------------------------------------------------------------------------

export const AGE = {
  START: 16,   // edad de debut en cantera
  RETIRE: 40,  // retiro obligatorio
};

export const OVR = {
  MIN: 35,        // piso absoluto (lesiones acumuladas pueden degradar)
  MAX: 95,        // techo absoluto de crecimiento
  INITIAL_CAP: 92, // tope del OVR inicial ( Tigre tiene rating 99 "de chiste")
  INITIAL_FLOOR: 45, // nadie debuta con menos de 45
};

/** Acota un OVR a los límites absolutos del juego (redondeado). */
export const clampOvr = (value) =>
  Math.max(OVR.MIN, Math.min(OVR.MAX, Math.round(value)));

/** OVR inicial del amigo a partir de su rating de data.js. */
export const initialOvr = (rating) =>
  Math.max(OVR.INITIAL_FLOOR, Math.min(OVR.INITIAL_CAP, Math.round(rating)));

// ---------------------------------------------------------------------------
// 2) DIFICULTADES
// ---------------------------------------------------------------------------
// Igual que en copero-clone, las tres dificultades comparten UN solo motor:
// lo único que cambia es seasonsPerDecision (cada cuántas temporadas el
// jugador toma decisiones / recibe eventos / mercado de pases).

export const DIFFICULTIES = {
  rapida: {
    id: 'rapida',
    label: 'Rápida',
    description: 'Carrera exprés: decisiones cada 4 temporadas, saltos grandes.',
    seasonsPerDecision: 4,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'Equilibrio: decisiones cada 2 temporadas.',
    seasonsPerDecision: 2,
  },
  intensa: {
    id: 'intensa',
    label: 'Intensa',
    description: 'Control total: decisiones cada temporada.',
    seasonsPerDecision: 1,
  },
};

/** Orden de presentación en UI (setup). */
export const DIFFICULTY_ORDER = ['rapida', 'normal', 'intensa'];

// ---------------------------------------------------------------------------
// 3) POSICIONES (fútbol 5/6)
// ---------------------------------------------------------------------------
// Cuatro posiciones. `archetype` es la clave que usa el motor para buscar
// tasas de gol/asistencia; `isGK` activa la rama de arquero (curva de
// crecimiento propia, rangos de aparición propios, sin goles).

export const POSITIONS = [
  { id: 'ARQ', label: 'Arquero',      short: 'ARQ', archetype: 'goalkeeper', isGK: true },
  { id: 'DEF', label: 'Defensor',     short: 'DEF', archetype: 'defensive',  isGK: false },
  { id: 'MED', label: 'Mediocampista', short: 'MED', archetype: 'creator',   isGK: false },
  { id: 'DEL', label: 'Delantero',    short: 'DEL', archetype: 'attacker',   isGK: false },
];

export const POSITION_IDS = POSITIONS.map((p) => p.id);

export const positionById = (id) => POSITIONS.find((p) => p.id === id);

/**
 * Posición natural sugerida según atributos (0-10). Determinista: el mismo
 * amigo siempre recibe la misma sugerencia; el usuario puede elegir otra.
 * Puntúa cada posición con pesos distintos y devuelve la más alta.
 */
export function suggestedPosition(attrs) {
  const scores = {
    DEL: attrs.shooting * 1.3 + attrs.pace * 0.9 + attrs.dribbling * 0.8,
    MED: attrs.passing * 1.3 + attrs.dribbling * 1.0 + attrs.shooting * 0.6,
    DEF: attrs.defense * 1.3 + attrs.physical * 0.9 + attrs.passing * 0.4,
    // ARQ lleva un descuento: solo se sugiere con perfil defensivo dominante.
    ARQ: attrs.defense * 1.1 + attrs.physical * 0.7 - 1.5,
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------------------------------------------------------------------------
// 4) CRECIMIENTO (curvas por edad)
// ---------------------------------------------------------------------------
// Rangos [min, max] de delta OVR por "bloque de edad" (entre checkpoint y
// checkpoint el motor reparte el delta). Adaptado de copero-clone con
// amplitudes algo menores: en fútbol 5/6 los picos son menos extremos.
// Claves = edad límite superior del bloque (edad <= clave usa ese rango).

export const GROWTH_CURVES = {
  early: {
    18: [6, 14], 20: [5, 13], 22: [3, 9], 24: [0, 6],
    26: [-2, 1], 28: [-3, -1], 30: [-2, 0], 32: [-4, 0],
    34: [-6, -1], 36: [-8, -2], 38: [-10, -3], 40: [-10, -3],
  },
  normal: {
    18: [4, 12], 20: [3, 12], 22: [2, 9], 24: [1, 7],
    26: [0, 3], 28: [-1, 0], 30: [-1, 0], 32: [-3, 0],
    34: [-5, -1], 36: [-7, -2], 38: [-10, -3], 40: [-10, -3],
  },
  late: {
    18: [2, 10], 20: [1, 10], 22: [1, 8], 24: [2, 8],
    26: [1, 4], 28: [0, 1], 30: [0, 1], 32: [-2, 0],
    34: [-5, -1], 36: [-7, -2], 38: [-10, -3], 40: [-10, -3],
  },
};

// Arqueros crecen más lento pero declinan más tarde (curva única).
export const GK_GROWTH_CURVE = {
  18: [2, 10], 20: [2, 10], 22: [2, 9], 24: [2, 8], 26: [1, 7],
  28: [1, 5], 30: [0, 0], 32: [-1, 0], 34: [-2, 0],
  36: [-4, -1], 38: [-6, -2], 40: [-6, -2],
};

// Metadatos para UI y verificación (edad de pico / inicio de declive / techo).
export const GROWTH_META = {
  early:  { peakAge: 25, declineFrom: 26, maxGrowth: 14, blurb: 'Explota joven y declina antes' },
  normal: { peakAge: 27, declineFrom: 28, maxGrowth: 12, blurb: 'Progresión pareja' },
  late:   { peakAge: 30, declineFrom: 31, maxGrowth: 10, blurb: 'Potencial dormido: tardío' },
};

/** Rango de crecimiento [min, max] para edad + perfil (+ curva de arquero). */
export function growthRangeForAge(age, profile, isGK) {
  const table = isGK ? GK_GROWTH_CURVE : GROWTH_CURVES[profile] || GROWTH_CURVES.normal;
  const ages = Object.keys(table).map(Number).sort((a, b) => a - b);
  const bracket = ages.find((a) => age <= a) ?? ages[ages.length - 1];
  return table[bracket];
}

/**
 * Perfil de desarrollo DERIVADO de atributos (no aleatorio): suma ponderada
 * de atributos ofensivos/técnicos. Un mismo amigo tiene siempre el mismo
 * perfil → su carrera es reconocible, y la aleatoriedad viene del mundo.
 */
export function developmentProfileFromBias(bias) {
  if (bias >= 7) return 'early';
  if (bias >= 4.5) return 'normal';
  return 'late';
}

// Temporadas consecutivas con poco rodaje que disparan penalización extra.
export const LOW_ROTATION_STREAK = { TRIGGER: 4 };

// ---------------------------------------------------------------------------
// 5) ROLES Y APARICIONES (partidos por temporada)
// ---------------------------------------------------------------------------
// El rol sale de comparar OVR del jugador contra el baseline del club
// (careerWorld.clubBaseline). Con roleMargin, los atributos de velocidad y
// regate suman puntos extra a esa comparación.

export const ROLE_THRESHOLDS = {
  outfield: { starter: 0, high_rotation: -4, low_rotation: -8 }, // debajo → substitute
  goalkeeper: { starter: 0, substitute: -6 },                    // debajo → third_keeper
};

export const ROLES = {
  outfield: ['starter', 'high_rotation', 'low_rotation', 'substitute'],
  goalkeeper: ['starter', 'substitute', 'third_keeper'],
};

export const ROLE_LABELS = {
  starter: 'Titular',
  high_rotation: 'Alta rotación',
  low_rotation: 'Baja rotación',
  substitute: 'Suplente',
  third_keeper: 'Tercer arquero',
};

/**
 * Rol del jugador según su diferencia contra el baseline del club.
 * (Portado de roleBucket de copero-clone.)
 */
export function roleBucket(overallVsBaseline, isGK) {
  if (isGK) {
    if (overallVsBaseline >= ROLE_THRESHOLDS.goalkeeper.starter) return 'starter';
    if (overallVsBaseline >= ROLE_THRESHOLDS.goalkeeper.substitute) return 'substitute';
    return 'third_keeper';
  }
  if (overallVsBaseline >= ROLE_THRESHOLDS.outfield.starter) return 'starter';
  if (overallVsBaseline >= ROLE_THRESHOLDS.outfield.high_rotation) return 'high_rotation';
  if (overallVsBaseline >= ROLE_THRESHOLDS.outfield.low_rotation) return 'low_rotation';
  return 'substitute';
}

// Partidos de liga por temporada (fútbol 5/6: menos que los 40-50 del pro).
export const MATCHES_PER_SEASON = { min: 24, max: 36 };

// Rango de partidos jugados por rol (antes de multiplicadores).
export const APPEARANCE_RANGES = {
  outfield: {
    starter: [26, 34], high_rotation: [18, 26],
    low_rotation: [10, 18], substitute: [4, 10],
  },
  goalkeeper: { starter: [26, 34], substitute: [3, 10], third_keeper: [0, 4] },
};

// Multiplicador de apariciones según reputación doméstica del club (1-5):
// los clubes chicos rotan menos y juegan menos partidos oficiales.
export const APPEARANCE_MULT_BY_REP = [0.6, 0.7, 0.8, 0.9, 0.95, 1];

/** Multiplicador de apariciones para una reputación doméstica dada (1-5). */
export function appearanceMultiplier(domesticRep) {
  const index = Math.max(1, Math.min(5, Math.round(domesticRep)));
  return APPEARANCE_MULT_BY_REP[index];
}

// ---------------------------------------------------------------------------
// 6) GOLES Y ASISTENCIAS (fútbol 5/6)
// ---------------------------------------------------------------------------
// Índice 0..6 = bucket de dominio (ver scoringBucket): 0 = muy superior al
// equipo, 6 = muy inferior. Tasas por PARTIDO adaptadas de copero-clone:
// el futsal es más goleador que fútbol 11, pero con menos partidos por
// temporada → promedios por temporada similares y más protagonismo.

export const SCORING_BUCKET_COUNT = 7;

export function scoringBucket(overallVsBaseline) {
  if (overallVsBaseline >= 10) return 0;
  if (overallVsBaseline >= 6) return 1;
  if (overallVsBaseline >= 3) return 2;
  if (overallVsBaseline >= -2) return 3;
  if (overallVsBaseline >= -5) return 4;
  if (overallVsBaseline >= -9) return 5;
  return 6;
}

export const GOAL_RATE = {
  attacker:   [1.05, 0.80, 0.60, 0.45, 0.28, 0.14, 0.05],
  creator:    [0.55, 0.42, 0.32, 0.22, 0.14, 0.07, 0.03],
  defensive:  [0.12, 0.09, 0.07, 0.05, 0.02, 0.00, 0.00],
  goalkeeper: [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
};

export const ASSIST_RATE = {
  attacker:   [0.45, 0.34, 0.24, 0.17, 0.11, 0.08, 0.05],
  creator:    [0.78, 0.62, 0.48, 0.34, 0.20, 0.10, 0.05],
  defensive:  [0.14, 0.10, 0.07, 0.04, 0.02, 0.00, 0.00],
  goalkeeper: [0.02, 0.01, 0.01, 0.00, 0.00, 0.00, 0.00],
};

// Multiplicador por fuerza del plantel (compañeros/serve) según reputación
// doméstica del club (índice = rep 0..5; en nuestro mundo rep 1..5).
export const TEAM_STRENGTH_SCORING_MULT = [0.55, 0.70, 0.85, 1.00, 1.10, 1.20];

/** Curva de calidad del jugador sobre su producción ofensiva. */
export function overallScoringCurve(ovr) {
  if (ovr <= 65) return 0.6;
  if (ovr <= 80) return 0.6 + ((ovr - 65) / 15) * 0.25;
  if (ovr <= 85) return 0.85 + ((ovr - 80) / 5) * 0.15;
  if (ovr <= 95) return 1.0 + ((ovr - 85) / 10) * 0.1;
  return 1.1;
}

// Variación aleatoria aplicada por el motor a goles/asistencias.
export const SCORING_RANDOM_RANGE = { min: 0.9, max: 1.1 };

// ---------------------------------------------------------------------------
// 7) FÓRMULAS DE ATRIBUTOS (players[] en escala 0-10)
// ---------------------------------------------------------------------------
// Funciones puras que traducen los atributos del amigo en multiplicadores del
// motor. Rangos garantizados (ver script de verificación del paso 2).

/** Goles: dominado por shooting (0.75 – 1.25). */
export const goalMult = (attrs) => 0.75 + (attrs.shooting / 10) * 0.5;

/** Asistencias: dominado por passing (0.75 – 1.25). */
export const assistMult = (attrs) => 0.75 + (attrs.passing / 10) * 0.5;

/** Resistencia: física influye en cuántos partidos aguanta (0.85 – 1.15). */
export const staminaMult = (attrs) => 0.85 + (attrs.physical / 10) * 0.3;

/** Riesgo de lesión: a menos físico, más riesgo (0.75 – 1.25). El lore puede
 *  modificarlo DESDE EL ENGINE/loreEvents (ej: Rulo), no acá. */
export const injuryRisk = (attrs) => 1.25 - (attrs.physical / 10) * 0.5;

/** Bonus al comparar contra el baseline del club (0 – 3): pace + dribbling. */
export const roleMargin = (attrs) => ((attrs.pace + attrs.dribbling) / 2) * 0.3;

/** Suma ponderada de atributos (0 – 10) que define el perfil de desarrollo. */
export const growthBias = (attrs) =>
  attrs.shooting * 0.2 + attrs.dribbling * 0.2 + attrs.passing * 0.2 +
  attrs.defense * 0.2 + attrs.pace * 0.1 + attrs.physical * 0.1;

// Rangos válidos documentados (los usa el script de verificación).
export const ATTR_FORMULA_RANGES = {
  goalMult: [0.75, 1.25],
  assistMult: [0.75, 1.25],
  staminaMult: [0.85, 1.15],
  injuryRisk: [0.75, 1.25],
  roleMargin: [0, 3],
  growthBias: [0, 10],
};

// ---------------------------------------------------------------------------
// 8) LESIONES
// ---------------------------------------------------------------------------
// Tabla portada de copero-clone: peso relativo (weightedPick en el motor) y
// penalización de OVR. La lógica de riesgos especiales por lore (Rulo, etc.)
// se agregará en engine.js/loreEvents.js, NO acá.

export const INJURY_CHANCE_PER_SEASON = 0.07;

export const INJURY_TYPES = [
  { type: 'hamstring',            label: 'Desgarro isquiotibial',        weight: 24, ovrDelta: -3 },
  { type: 'meniscus',             label: 'Lesión de menisco',            weight: 18, ovrDelta: -2 },
  { type: 'acl',                  label: 'Rotura de ligamento cruzado',  weight: 14, ovrDelta: -5 },
  { type: 'tibia_fibula',         label: 'Fractura de tibia y peroné',   weight: 8,  ovrDelta: -8 },
  { type: 'achilles',             label: 'Rotura de tendón de Aquiles',  weight: 4,  ovrDelta: -10 },
  { type: 'ankle_sprain',         label: 'Esguince de tobillo',          weight: 14, ovrDelta: -1 },
  { type: 'calf_tear',            label: 'Desgarro de gemelo',           weight: 8,  ovrDelta: -2 },
  { type: 'metatarsal_fracture',  label: 'Fractura de metatarso',        weight: 5,  ovrDelta: -4 },
  { type: 'shoulder_dislocation', label: 'Luxación de hombro',           weight: 3,  ovrDelta: -4 },
  { type: 'disc_hernia',          label: 'Hernia de disco',              weight: 2,  ovrDelta: -5 },
];

// ---------------------------------------------------------------------------
// 9) TROFEOS
// ---------------------------------------------------------------------------
// Probabilidad base por temporada según reputación efectiva del club (0-5).
// La "efectiva" la calcula effectiveReputationForTrophies: un crack (OVR 85+)
// en un club chico infla las chances (portado de copero-clone).
// La copa continental SOLO existe para Primera Avergas (hasContinental en
// careerWorld); el motor filtra con esa bandera.

export const TROPHY_TYPES = {
  league:       { label: 'Liga',                  icon: '🏆' },
  cup:          { label: 'Copa Avergas',          icon: '🥈' },
  continental:  { label: 'Copa Continental',      icon: '🌟' },
};

export const TROPHY_PROBS = {
  league:      [0.00, 0.01, 0.05, 0.25, 0.45, 0.70], // rep 0..5
  cup:         [0.02, 0.06, 0.12, 0.25, 0.35, 0.42],
  continental: [0.00, 0.00, 0.03, 0.15, 0.20, 0.30], // solo D1
};

// Máximo un trofeo por temporada (el motor corta al primero que sale).
export const MAX_TROPHIES_PER_SEASON = 1;

/** Multiplicador estrella: dominar a tu equipo aumenta chances de título. */
export function starMultiplier(overallVsBaseline) {
  if (overallVsBaseline >= 10) return 1.6;
  if (overallVsBaseline >= 6) return 1.3;
  if (overallVsBaseline >= 3) return 1.1;
  return 1;
}

/**
 * Reputación efectiva para trofeos: si el jugador es una estrella (OVR >= 85)
 * en un club de rep baja/medio, infla la reputación con la que se tiran los
 * dados (adaptado de effectiveReputationForTrophies de copero-clone).
 * Recibe reputaciones numéricas para no acoplar config al catálogo.
 */
export function effectiveReputationForTrophies(ovr, domesticRep, continentalRep) {
  const t = Math.max(0, Math.min(5, continentalRep));
  let bumpDom = 0, bumpCont = 0;
  if (ovr >= 90) {
    if (t === 3) { bumpDom = 1; bumpCont = 1; }
    else if (t === 2) { bumpDom = 2; bumpCont = 1; }
    else if (t <= 1) { bumpDom = 2; bumpCont = 2; }
  } else if (ovr >= 85 && t <= 3) {
    bumpDom = 1;
    bumpCont = t <= 1 ? 1 : 0;
  }
  return {
    domestic: Math.max(0, Math.min(5, domesticRep + bumpDom)),
    continental: Math.max(0, Math.min(5, continentalRep + bumpCont)),
  };
}

// ---------------------------------------------------------------------------
// 10) MERCADO DE PASES / OFERTAS (reglas; generación en engine.js)
// ---------------------------------------------------------------------------

export const OFFER_RULES = {
  // Cantidad de ofertas.
  youthOfferCount: 3,     // debut en cantera
  transferOfferCount: 2,  // mercado de pases en cada checkpoint

  // "Quedarme" siempre es una opción válida junto a las ofertas.
  stayAlwaysAvailable: true,

  // Bonus de lealtad (portado del evento rival_offer de copero): quedarse en
  // el club actual puede dar un pequeño plus de OVR [min, max].
  loyaltyOvrBonus: [0, 1],

  // Requisitos de OVR: debajo de este umbral no llegan ofertas de Primera.
  firstDivisionMinOvr: 74,

  // Saltos de división permitidos en una oferta (jerarquía de DOS categorías:
  // 1 = Primera, 2 = Segunda). maxDivisionJumpUp acota cuánto puede CAER una
  // oferta (nivel interno más alto) y maxDivisionDrop cuánto puede SUBIR
  // (nivel interno más bajo): desde Segunda, Primera está a un paso.
  maxDivisionJumpUp: 2,
  maxDivisionDrop: 1,

  // Caminata de nivel entre ofertas ("random walk" portado de walkTier):
  // 80% mismo nivel, 10% sube, 10% baja (con bordes forzados hacia adentro).
  walkTier: { stay: 0.8, down: 0.1, up: 0.1 },
};

// ---------------------------------------------------------------------------
// 10b) PROGRESIÓN SEGUNDA → PRIMERA (ascenso de categoría temprano)
// ---------------------------------------------------------------------------
// El salto de Segunda a Primera NO se reserva para el final de la carrera: en
// cuanto el JUGADOR está listo (OVR sobre `firstDivisionMinOvr` y rendimiento
// acorde a su club) el mercado de Primera entra al pool de destinos, sin
// importar cuántas temporadas lleva en Segunda.
//
// `firstDivisionOfferChance` es la probabilidad POR OFERTA de que el mercado
// de una división inferior traiga un club de Primera. La consume
// generateTransferOffers() (engine.js) con el RNG inyectable del motor:
// determinista con seed, nunca Math.random.
//
//   Segunda + OVR/rendimiento buenos  → Primera puede aparecer en la 1ª ventana.
//   Segunda + rendimiento mediocre    → Primera tarda más (chance baja).
//   Segunda + OVR/rendimiento malos   → Primera puede no aparecer.

export const FIRST_DIVISION_PUSH = {
  baseChance: 0.16,          // con el OVR justo en firstDivisionMinOvr
  ovrStep: 0.06,             // +6% por punto de OVR sobre el umbral
  maxChance: 0.90,           // tope por oferta
  goodStanding: 6,           // overallVsBaseline >= 6 → consagrado en su club
  goodStandingBonus: 0.20,
  okStanding: 2,             // overallVsBaseline >= 2 → rendimiento razonable
  okStandingBonus: 0.10,
  poorStanding: 0,           // overallVsBaseline < 0 → rinde por debajo del plantel
  poorStandingPenalty: 0.15,
  benchRoles: ['low_rotation', 'substitute', 'third_keeper'],
  benchPenalty: 0.15,        // poco rodaje: el mercado de Primera duda
};

/**
 * Probabilidad (0..maxChance) de que UNA oferta del mercado sea de Primera para
 * un jugador que compite en una división inferior. Depende del OVR del jugador
 * respecto de `firstDivisionMinOvr` y de su rendimiento (overallVsBaseline: OVR
 * + rol contra el nivel del plantel, y el rol que se ganó). NO depende de las
 * temporadas que lleva en el club.
 *
 * @param {{ ovr: number, overallVsBaseline?: number, role?: string|null, minOvr?: number }} input
 * @returns {number} probabilidad por oferta (0 si el OVR no habilita Primera).
 */
export function firstDivisionOfferChance({ ovr, overallVsBaseline = 0, role = null, minOvr = OFFER_RULES.firstDivisionMinOvr }) {
  if (!Number.isFinite(ovr) || !Number.isFinite(minOvr) || ovr < minOvr) return 0;
  const cfg = FIRST_DIVISION_PUSH;
  let chance = cfg.baseChance + (ovr - minOvr) * cfg.ovrStep;

  const standing = Number.isFinite(overallVsBaseline) ? overallVsBaseline : 0;
  if (standing >= cfg.goodStanding) chance += cfg.goodStandingBonus;
  else if (standing >= cfg.okStanding) chance += cfg.okStandingBonus;
  else if (standing < cfg.poorStanding) chance -= cfg.poorStandingPenalty;

  if (typeof role === 'string' && cfg.benchRoles.includes(role)) chance -= cfg.benchPenalty;

  return Math.max(0, Math.min(cfg.maxChance, chance));
}

/** Tier de jugador (-1..5) según OVR — decide el "nivel" de sus ofertas. */
export function playerTier(overall) {
  return overall >= 87 ? 5 : overall >= 83 ? 4 : overall >= 78 ? 3 :
    overall >= 73 ? 2 : overall >= 65 ? 1 : overall >= 55 ? 0 : -1;
}

/** Camina el tier una oferta alrededor del actual (usa Math.random). */
export function walkTier(tier) {
  const clamped = Math.max(-1, Math.min(5, tier));
  const { stay, down } = OFFER_RULES.walkTier;
  const r = Math.random();
  if (clamped === -1) return r < stay ? -1 : 0;
  if (clamped === 5) return r < stay ? 5 : 4;
  if (r < down) return clamped - 1;
  if (r < down + stay) return clamped;
  return clamped + 1;
}

// Sesgo "de tu tierra" del referente: con OVR bajo, las ofertas tienden a
// quedarse cerca (mismo barrio/división); con OVR alto, mercado libre.
export const HOME_BIAS_WEIGHT = {
  highOvr: 0,      // ovr >= 83: cero sesgo local
  midOvr: 0.5,     // ovr >= 73
  lowOvr: 0.85,    // debajo
  thresholdHigh: 83,
  thresholdMid: 73,
};

/** Peso de sesgo local para un OVR dado (lo consume el generador de ofertas). */
export function homeBiasWeight(overall) {
  if (overall >= HOME_BIAS_WEIGHT.thresholdHigh) return HOME_BIAS_WEIGHT.highOvr;
  if (overall >= HOME_BIAS_WEIGHT.thresholdMid) return HOME_BIAS_WEIGHT.midOvr;
  return HOME_BIAS_WEIGHT.lowOvr;
}

// ---------------------------------------------------------------------------
// 11) VALOR DE MERCADO
// ---------------------------------------------------------------------------
// Fórmula portada y extendida de copero-clone: cúbica en OVR, con factor por
// edad, multiplicador por reputación del club y bonus por potencial (cuánto
// le falta a su techo de desarrollo), que hace valiosos a los jóvenes.

export const MARKET_VALUE = {
  MIN: 30000,        // valor mínimo
  OVR_FLOOR: 40,     // debajo de este OVR la base vale 0
  REP_WEIGHT: 0.04,  // +4% por punto de reputación del club
  POTENTIAL_WEIGHT: 0.025, // +2.5% por punto de potencial no alcanzado
  AGE_DECAY_START: 30,     // desde acá el valor cae
  AGE_DECAY_FLOOR: 0.15,   // nunca cae por debajo de este factor
  ROUND_TO: 1000,
};

/**
 * Valor de mercado en "pesos avergas".
 * @param {{ ovr: number, age: number, reputation?: number, potential?: number }} p
 */
export function marketValue({ ovr, age, reputation = 0, potential = ovr }) {
  const cfg = MARKET_VALUE;
  const base = Math.pow(Math.max(0, ovr - cfg.OVR_FLOOR), 3) * 100;
  let ageFactor = 1;
  if (age > cfg.AGE_DECAY_START) {
    ageFactor = Math.max(cfg.AGE_DECAY_FLOOR, 1 - (age - cfg.AGE_DECAY_START) * 0.1);
  }
  const repMult = 1 + Math.max(0, Math.min(5, reputation)) * cfg.REP_WEIGHT;
  const potentialMult = 1 + Math.max(0, potential - ovr) * cfg.POTENTIAL_WEIGHT;
  const raw = base * ageFactor * repMult * potentialMult;
  return Math.max(cfg.MIN, Math.round(raw / cfg.ROUND_TO) * cfg.ROUND_TO);
}

// ---------------------------------------------------------------------------
// 12) EVENTOS Y LOGROS
// ---------------------------------------------------------------------------

// Probabilidad de que un checkpoint incluya un evento interactivo.
export const EVENT_CHANCE_PER_CHECKPOINT = 0.55;

// Logros de retiro (check puros; el motor los evalúa al final).
// Adaptados a las magnitudes de fútbol 5/6 (menos partidos que el pro).
export const ACHIEVEMENTS = [
  { id: 'centurion',      label: 'Centurión del Barrio', check: (t) => t.pj >= 100 },
  { id: 'goleador',       label: 'Máximo Goleador',      check: (t) => t.gls >= 80 },
  { id: 'asistidor',      label: 'Cerebro del Equipo',   check: (t) => t.ast >= 60 },
  { id: 'leyenda',        label: 'Leyenda del Universo', check: (t, ovrPeak) => ovrPeak >= 88 },
  { id: 'campeon',        label: 'Campeón Serial',       check: (t, ovrPeak, trophies) => trophies.length >= 3 },
  { id: 'trotamundos',    label: 'Trotamundos',          check: (t, ovrPeak, trophies, clubCount) => clubCount >= 4 },
  { id: 'indestructible', label: 'Indestructible',       check: (t, ovrPeak, trophies, clubCount, injuries) => injuries === 0 && t.pj >= 50 },
];

// ---------------------------------------------------------------------------
// 13) RESUMEN DE EXPORTS PARA engine.js
// ---------------------------------------------------------------------------
// El motor esperará consumir: AGE/OVR/clampOvr/initialOvr · DIFFICULTIES ·
// POSITIONS/positionById/suggestedPosition · GROWTH_*/growthRangeForAge/
// developmentProfileFromBias · ROLE_THRESHOLDS/roleBucket/ROLE_LABELS ·
// APPEARANCE_RANGES/appearanceMultiplier/MATCHES_PER_SEASON ·
// scoringBucket/GOAL_RATE/ASSIST_RATE/TEAM_STRENGTH_SCORING_MULT/
// overallScoringCurve/SCORING_RANDOM_RANGE · goalMult/assistMult/staminaMult/
// injuryRisk/roleMargin/growthBias · INJURY_TYPES/INJURY_CHANCE_PER_SEASON ·
// TROPHY_TYPES/TROPHY_PROBS/starMultiplier/effectiveReputationForTrophies ·
// OFFER_RULES/playerTier/walkTier/homeBiasWeight · FIRST_DIVISION_PUSH/
// firstDivisionOfferChance (progresión Segunda → Primera) · marketValue ·
// EVENT_CHANCE_PER_CHECKPOINT · ACHIEVEMENTS.