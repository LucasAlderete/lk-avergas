// ============================================================================
// INFORME DE VOTOS — el "código" que la persona copia y manda por WhatsApp
// ============================================================================
// No hay backend, así que el ida y vuelta es manual: cada persona vota en su
// celu, copia su informe y lo manda por WhatsApp; el dueño junta los informes
// y los pasa por el script `scripts/apply-vote-reports.mjs` para que queden
// baked en la app.
//
// El formato es una sola línea de ASCII puro, porque WhatsApp mete comillas
// raras y negritas pero NO toca este tipo de texto:
//
//   AV1|Etiqueta|Jugador:atributo+1,atributo-1;Jugador2:atributo+2
//   ^magic ^opcional ^los votos
//
// Ejemplo real:  AV1|Lucas|Chino:passing+1,pace-1;Emi:shooting+1
//
// Se elige texto plano y no base64 a propósito: si algo se rompe, se lee y se
// corrige a mano. Es corto (5 puntos como máximo) y WhatsApp no lo corta.

import { RATING_STATS } from '../data.js';
import { POINTS_PER_PLAYER, TOTAL_POINTS, canCast, costOfPlayer, spent } from './voteRules.js';

export const REPORT_TAG = 'AV1';
const SEP = '|';
const PLAYER_SEP = ';';
const STAT_SEP = ',';

const KEYS = RATING_STATS.map((stat) => stat.key);
const isValidKey = (key) => KEYS.includes(key);

// Limpia lo que WhatsApp haya podido pegar alrededor del código.
const clean = (value) => String(value ?? '').replace(/[‘’“”]/g, "'").trim();

// Arma la línea de informe a partir de una boleta.
// `label` es el nombre de la persona (opcional, para saber de quién es).
export function buildReport(ballot, label = '') {
  const parts = [];
  for (const [name, deltas] of Object.entries(ballot || {})) {
    const stats = Object.entries(deltas || {})
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}${value > 0 ? '+' : ''}${value}`)
      .join(STAT_SEP);
    if (stats) parts.push(`${name}:${stats}`);
  }
  return [REPORT_TAG, clean(label).replace(/\|/g, '-'), parts.join(PLAYER_SEP)].join(SEP);
}

// Interpreta un informe. NO valida los límites: eso lo hace validateReport,
// para poder mostrarle el error a la persona.
//
// Tolera que el código NO empiece la línea: en WhatsApp es normal que alguien
// escriba "mi voto: AV1|..." o lo pegue dentro de un mensaje.
export function parseReport(text) {
  const cleaned = clean(text);
  const start = cleaned.indexOf(`${REPORT_TAG}${SEP}`);
  if (start < 0) return { ok: false, error: `No es un informe de votos (falta el ${REPORT_TAG})`, label: '', ballot: {} };
  // Corta justo en el fin de la línea del código.
  const line = cleaned.slice(start).split('\n')[0].trim();

  const [, label = '', payload = ''] = line.split(SEP);
  const ballot = {};
  for (const chunk of payload.split(PLAYER_SEP).filter(Boolean)) {
    const [name, stats] = chunk.split(':');
    if (!name || !stats) return { ok: false, error: `Informe roto cerca de "${chunk}"`, label, ballot: {} };
    for (const stat of stats.split(STAT_SEP).filter(Boolean)) {
      const matched = /^([a-z]+)([+-]\d+)$/.exec(stat);
      if (!matched || !isValidKey(matched[1])) {
        return { ok: false, error: `Atributo desconocido: "${stat}"`, label, ballot: {} };
      }
      ballot[name] = { ...(ballot[name] || {}), [matched[1]]: (ballot[name]?.[matched[1]] || 0) + Number(matched[2]) };
    }
  }
  return { ok: true, error: '', label: clean(label), ballot };
}

// Revisa que el informe respete los límites. Devuelve todos los problemas juntos
// para poder reportarlos de una.
export function validateReport(ballot) {
  const errors = [];
  const total = spent(ballot);
  if (total > TOTAL_POINTS) errors.push(`usa ${total} puntos y el máximo es ${TOTAL_POINTS}`);
  for (const [name, deltas] of Object.entries(ballot || {})) {
    const cost = costOfPlayer(deltas);
    if (cost > POINTS_PER_PLAYER) errors.push(`le da ${cost} puntos a ${name} y el máximo es ${POINTS_PER_PLAYER}`);
    // Reconstruye la boleta atributo por atributo para aplicar las reglas.
    let replay = {};
    for (const [key, direction] of Object.entries(deltas)) {
      const check = canCast(replay, name, key, direction);
      if (!check.ok) errors.push(`${name}/${key}: ${check.reason}`);
      replay = { ...replay, [name]: { ...(replay[name] || {}), [key]: (replay[name]?.[key] || 0) + direction } };
    }
  }
  return errors;
}

// Atajo: parsea y valida en un paso.
export function readReport(text) {
  const parsed = parseReport(text);
  if (!parsed.ok) return { ...parsed, ballot: {}, errors: [parsed.error] };
  const errors = validateReport(parsed.ballot);
  return { ok: errors.length === 0, label: parsed.label, ballot: parsed.ballot, errors };
}
