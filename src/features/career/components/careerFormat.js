// ============================================================================
// HELPERS DE PRESENTACIÓN — pantalla del Modo Carrera (Paso 11A)
// ============================================================================
// SOLO formatea y etiqueta datos que YA existen (career, ofertas, reportes de
// temporada, eventos). Reglas de este archivo:
//
// - CERO lógica de carrera: no calcula OVR, valor de mercado, roles,
//   probabilidades, crecimiento ni transiciones. Si un dato no está, devuelve
//   un fallback visible ('—'), nunca inventa números.
// - CERO storage/DOM/React: no toca localStorage, document ni hooks.
// - Reutiliza catálogos EXISTENTES como datos de UI (config.js: etiquetas de
//   posición/rol/perfil/edad; careerWorld.js: nombres de división, colores de
//   club y metadatos del mundo). No duplica ninguno.
//
// Nota sobre `cleanText` (parche de presentación, sin tocar el motor):
//   El catálogo de eventos (features/career/events.js) está guardado con bytes
//   UTF-8 re-interpretados como Latin-1/Windows-1252, así que sus textos llegan
//   al navegador como "El telÃ©fono del malviaje" o "ðŸ“ž". `cleanText` los
//   repara SOLO para mostrarlos (idempotente: un texto ya correcto se devuelve
//   intacto). La corrección real del archivo queda pendiente para un paso
//   posterior: acá no se modifica events.js.
// ============================================================================

import { AGE, GROWTH_META, ROLE_LABELS, positionById } from '../config.js';
import { divisions, findClub, findClubByKey } from '../../../data/careerWorld.js';
import { FLOW_PHASES } from '../flow.js';
import { CREST_FILES } from '../../../data/careerWorld/crests.generated.js';

export const DASH = '—';

/** Convierte un nombre de club en slug (misma lógica que careerWorld.js). */
function slugify(name) {
  return name
    ? name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : '';
}

// ---------------------------------------------------------------------------
// Números y valores
// ---------------------------------------------------------------------------

/** Número seguro para mostrar (no finito → fallback). */
export function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/** Dato numérico como texto, con '—' cuando falta. */
export function statText(value) {
  return Number.isFinite(value) ? String(value) : DASH;
}

/** Delta con signo explícito: +3 / -2 / 0. */
export function signed(value) {
  const n = safeNumber(value, 0);
  return `${n > 0 ? '+' : ''}${n}`;
}

/**
 * Valor de mercado en "pesos avergas" (el entero que devuelve marketValue):
 *   13000000 → "$13M" · 950000 → "$950K" · 30000 → "$30K".
 */
export function formatMoney(value) {
  if (!Number.isFinite(value) || value < 0) return DASH;
  if (value >= 1000000) {
    const millions = value / 1000000;
    const rounded = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1);
    return `$${rounded.replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

/**
 * Estrellas decorativas a partir del OVR ya calculado por el motor (nunca al
 * revés): solo es un adorno visual de 0 a 5, redondeando ovr/20. No reemplaza
 * al número de OVR, que siempre se muestra al lado.
 */
export function ovrStars(ovr) {
  const value = safeNumber(ovr, 0);
  return Math.max(0, Math.min(5, Math.round(value / 20)));
}

/** Cinco estrellas para la reputación doméstica (0-5) que reporta el motor. */
export function repStars(reputation) {
  return Math.max(0, Math.min(5, Math.round(safeNumber(reputation, 0))));
}

// ---------------------------------------------------------------------------
// Etiquetas de catálogos existentes (datos, no lógica)
// ---------------------------------------------------------------------------

/** Posición: label larga ("Mediocampista"). */
export function positionLabel(id) {
  return positionById(id)?.label || id || DASH;
}

/** Posición: sigla corta ("MED"). */
export function positionShort(id) {
  return positionById(id)?.short || id || '—';
}

/** Rol del motor (starter/high_rotation/...) → etiqueta de config.js. */
export function roleLabel(role) {
  return ROLE_LABELS[role] || role || DASH;
}

/** Perfil de desarrollo (early/normal/late) → blurb corto de config.js. */
export function profileLabel(profile) {
  return GROWTH_META[profile]?.blurb || null;
}

/** Edad de debut del mundo de carrera (dato, no cálculo). */
export function careerStartAge() {
  return AGE.START;
}

/** Fase del flow → título legible. */
export function phaseLabel(phase) {
  return {
    [FLOW_PHASES.DEBUT]: 'Debut',
    [FLOW_PHASES.SEASON]: 'Temporada en curso',
    [FLOW_PHASES.EVENT]: 'Evento',
    [FLOW_PHASES.DECISION]: 'Decisión de carrera',
    [FLOW_PHASES.TRANSFER]: 'Mercado abierto',
    [FLOW_PHASES.RETIRED]: 'Retirado',
    [FLOW_PHASES.STOPPED]: 'Detenido',
  }[phase] || 'Sin carrera';
}

/** Descripción corta de cada fase, para el strip de estado. */
export function phaseHint(phase) {
  return {
    [FLOW_PHASES.DEBUT]: 'Elegí el club donde empieza tu carrera.',
    [FLOW_PHASES.SEASON]: 'Todo listo para jugar la próxima temporada.',
    [FLOW_PHASES.EVENT]: 'Algo pasó en el vestuario: hay que decidir.',
    [FLOW_PHASES.DECISION]: 'Se cerró la temporada: elegí el próximo paso.',
    [FLOW_PHASES.TRANSFER]: 'Los clubes te están buscando.',
    [FLOW_PHASES.RETIRED]: 'La pelota quedó quieta. Mirá la película completa.',
    [FLOW_PHASES.STOPPED]: 'La carrera se detuvo.',
  }[phase] || 'Documentando la carrera.';
}

// ---------------------------------------------------------------------------
// Ofertas y decisiones: motivos legibles
// ---------------------------------------------------------------------------

/** Motivo de una oferta de mercado (offer.reason) → etiqueta corta. */
export function offerReasonLabel(reason) {
  return {
    promotion: 'Proyecto de ascenso',
    safe_move: 'Recuperar rodaje',
    big_club: 'Plantel más fuerte',
    leading_role: 'Rol protagónico',
    lateral: 'Nivel similar',
    youth_debut: 'Oferta de cantera',
  }[reason] || null;
}

/** Etiqueta del salto de división de una oferta ("Sube 1 división"). */
export function divisionDeltaLabel(delta) {
  if (!Number.isFinite(delta) || delta === 0) return 'Misma división';
  if (delta < 0) return delta === -1 ? 'Sube una división' : `Sube ${Math.abs(delta)} divisiones`;
  return delta === 1 ? 'Baja una división' : `Baja ${delta} divisiones`;
}

// ---------------------------------------------------------------------------
// Feedback de la última acción (lastAction de flow.js)
// ---------------------------------------------------------------------------

const REASON_TEXT = {
  offer_not_available: 'Esa oferta ya no está disponible. Elegí otra.',
  offer_rejected: 'El club rechazó la operación. Probá con otra oferta.',
  wrong_phase: 'Esa acción no corresponde en este momento de la carrera.',
  retirement_due: 'Con el retiro pendiente, la única decisión posible es retirarse.',
  retired: 'La carrera ya está cerrada.',
  stopped: 'La carrera está detenida.',
  invalid_choice: 'Esa opción del evento no es válida. Probá con otra.',
  invalid_state: 'No pudimos leer la carrera guardada. Reiniciala para seguir.',
  invalid_player: 'Ese jugador no se pudo convertir en carrera. Probá con otro.',
  retirement_reached: 'El jugador alcanzó la edad de retiro: toca cerrar la carrera.',
  no_offers: 'No hay ofertas sobre la mesa: seguí en tu club o retirate.',
  unknown_action: 'Acción desconocida para el motor.',
};

/**
 * Traduce `lastAction` (contrato de flow.js) a un mensaje de UI.
 * Devuelve { tone: 'ok' | 'warn', text } o null cuando no hay nada que decir.
 */
export function feedbackOf(lastAction) {
  if (!lastAction || typeof lastAction !== 'object' || !lastAction.action) return null;

  if (lastAction.ok !== true) {
    return {
      tone: 'warn',
      text: REASON_TEXT[lastAction.reason] || 'La acción no se pudo completar.',
    };
  }

  switch (lastAction.action) {
    case 'start':
      return { tone: 'ok', text: 'Carrera iniciada. La cantera te está mirando.' };
    case 'choose_youth_club':
      return { tone: 'ok', text: '¡Debut firmado! Ya tenés club de cantera.' };
    case 'advance_season':
      return { tone: 'ok', text: 'Temporada simulada.' };
    case 'choose_event_choice': {
      const delta = Number.isFinite(lastAction.ovrDelta)
        ? `OVR ${signed(lastAction.ovrDelta)}`
        : 'Decisión tomada';
      return {
        tone: 'ok',
        text: lastAction.isTransfer ? `${delta} · se abrió un interés de traspaso` : delta,
      };
    }
    case 'stay': {
      const bonus = safeNumber(lastAction.loyaltyOvrBonus, 0);
      return {
        tone: 'ok',
        text: bonus > 0 ? `Seguís en el club con +${bonus} OVR de lealtad.` : 'Seguís en el club.',
      };
    }
    case 'transfer':
      // `opened: true` = se abrió el mercado (ya no es una acción del usuario:
      // la dispara la pantalla al llegar al checkpoint). Sin mensaje.
      return lastAction.opened === true
        ? null
        : { tone: 'ok', text: 'Traspaso confirmado: nuevo club, nueva camiseta.' };
    case 'retire':
      return { tone: 'ok', text: 'Carrera cerrada. Bien jugado.' };
    default:
      return { tone: 'ok', text: 'Acción completada.' };
  }
}

// ---------------------------------------------------------------------------
// Textos (parche de presentación para el mojibake del catálogo de eventos)
// ---------------------------------------------------------------------------

const NON_ASCII_RE = /[^\x00-\x7F]/;
// Marcadores de mojibake: pares Â/Ã + continuación, o caracteres del bloque
// Windows-1252 alto (que aparecen al interpretar bytes UTF-8 como cp1252).
const MOJIBAKE_PAIR_RE = /[\u00c2\u00c3][\u0080-\u00bf]/;
const CP1252_CHARS_RE = /[\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/;

const looksLikeMojibake = (text) => MOJIBAKE_PAIR_RE.test(text) || CP1252_CHARS_RE.test(text);

// Windows-1252 (0x80-0x9F) → byte original, para poder re-decodificar UTF-8.
const CP1252_BYTES = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Repara texto con mojibake UTF-8→Windows-1252 (solo presentación).
 * - Texto sin mojibake → se devuelve idéntico (camino rápido).
 * - Texto irreparable (o texto legítimo con comillas tipográficas) → se
 *   devuelve tal cual: la validación UTF-8 con `fatal` lo garantiza.
 */
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  if (value === '' || !NON_ASCII_RE.test(value)) return value;
  if (!looksLikeMojibake(value)) return value;

  const bytes = [];
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x100) {
      bytes.push(code);
    } else if (CP1252_BYTES[code] != null) {
      bytes.push(CP1252_BYTES[code]);
    } else {
      return value; // Caracter ajeno al patrón: no arriesgamos la reparación.
    }
  }

  try {
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    // Si quedó mojibake residual, la reparación no sirvió: se devuelve el original.
    return looksLikeMojibake(repaired) ? value : repaired;
  } catch {
    return value;
  }
}

/** División del mundo (nivel 1..2: Primera / Segunda) o null. */
export function divisionOf(nivel) {
  return divisions.find((item) => item.nivel === nivel) || null;
}

/** Nombre de la división ("Primera Avergas"). */
export function divisionName(nivel) {
  return divisionOf(nivel)?.name || (Number.isFinite(nivel) ? `División ${nivel}` : DASH);
}

/** Nombre corto de la división ("PRIMERA A"). */
export function divisionShort(nivel) {
  return divisionOf(nivel)?.short || DASH;
}

/** Iniciales para el escudo placeholder ("Boca Juniors" → "BJ"). */
export function clubInitials(name) {
  if (typeof name !== 'string' || !name.trim()) return '—';
  const initials = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-zÀ-ÿ0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
  return initials || name.slice(0, 2).toUpperCase();
}

/**
 * Identidad visual de un club para el escudo CSS: colores del mundo cuando
 * existen, fallback oscuro neutro cuando no. Nunca lanza.
 *
 * Acepta las dos formas que circulan por la UI: el club COMPLETO del mundo
 * (career.club: país, liga y crest incluidos) o una referencia LIVIANA de
 * oferta/historial (key/name/short/colors). Para las referencias resuelve el
 * club canónico por key o slug y así recupera país, liga y escudo procedural
 * sin inventar datos: si no está en el catálogo, esos campos quedan en null.
 */
export function clubVisual(club) {
  const isObject = Boolean(club) && typeof club === 'object';
  const world = isObject ? (findClubByKey(club.key) || findClub(club.slug)) : null;
  const colors = (isObject && club.colors) || (world && world.colors) || null;
  const crest = (isObject && club.crest) || (world && world.crest) || null;
  const name = (isObject && club.name) || (world && world.name) || '';
  const short = (isObject && club.short) || (world && world.short) || clubInitials(name);
  const slug = (world && world.slug) || (isObject && club.slug) || slugify(name);
  // Logo real cuando existe en el catálogo de imágenes, sino null (fallback procedural)
  const crestSrc = CREST_FILES && CREST_FILES[slug] ? CREST_FILES[slug] : null;
  return {
    name: name || 'Club sin datos',
    short,
    // Escudo procedural: símbolo del descriptor del catálogo (sigla del club)
    // o, si no hay descriptor, la sigla corta que ya existía.
    symbol: (crest && crest.symbol) || short,
    crestShape: (crest && crest.shape) || 'shield',
    primary: (colors && colors.primary) || '#223529',
    secondary: (colors && colors.secondary) || '#0d1512',
    crestSrc, // ruta al logo real (public/career/clubs/<slug>.png) o null
    division: (isObject && Number.isFinite(club.division))
      ? club.division
      : ((world && Number.isFinite(world.division)) ? world.division : null),
    country: (world && world.country) || (isObject && club.country) || null,
    countryFlag: (world && world.countryFlag) || (isObject && club.countryFlag) || null,
    league: (world && world.league) || (isObject && club.league) || null,
  };
}

/**
 * País de un club como etiqueta corta ("🇦🇷 Argentina"), o null cuando el
 * catálogo no lo conoce (referencias viejas o clubes fuera del mundo).
 */
export function clubCountryLabel(club) {
  const visual = clubVisual(club);
  if (!visual.country) return null;
  return visual.countryFlag ? `${visual.countryFlag} ${visual.country}` : visual.country;
}

/**
 * Club de un reporte de temporada (seasonReport.club solo trae
 * key/name/short/division) resuelto contra el mundo para recuperar colores.
 */
export function reportClubVisual(reportClub) {
  if (!reportClub || typeof reportClub !== 'object') return clubVisual(null);
  const worldClub = findClubByKey(reportClub.key);
  return clubVisual({
    ...(worldClub || {}),
    name: reportClub.name || (worldClub && worldClub.name),
    short: reportClub.short || (worldClub && worldClub.short),
    division: Number.isFinite(reportClub.division)
      ? reportClub.division
      : (worldClub && worldClub.division),
  });
}

// ---------------------------------------------------------------------------
// Atributos (career.attrs: 0-10, tal como los entrega el motor)
// ---------------------------------------------------------------------------

const ATTR_LABELS = [
  ['pace', 'Ritmo'],
  ['shooting', 'Disparo'],
  ['passing', 'Pases'],
  ['dribbling', 'Regate'],
  ['defense', 'Defensa'],
  ['physical', 'Físico'],
];

/** Atributos presentes, etiquetados y listos para las barras (omite faltantes). */
export function attrEntries(attrs) {
  if (!attrs || typeof attrs !== 'object') return [];
  return ATTR_LABELS
    .filter(([key]) => Number.isFinite(attrs[key]))
    .map(([key, label]) => ({
      key,
      label,
      value: attrs[key],
      // El motor guarda atributos 0-10: la barra es un porcentaje de esa escala.
      percent: Math.max(0, Math.min(100, attrs[key] * 10)),
      display: attrs[key].toFixed(1),
    }));
}
