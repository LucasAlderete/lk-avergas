// ============================================================================
// REGLAS DEL VOTO — lógica pura (sin React, sin storage)
// ============================================================================
// Modelo: cada persona tiene una "boleta" con los puntos que reparte sobre los
// atributos de los jugadores y el OVR se recalcula.
//
//   - TOTAL_POINTS: puntos por persona POR PARTIDO (5). Al cerrar, la boleta
//     queda trabada y el próximo partido te da otros 5. El OVR NO se resetea.
//   - POINTS_PER_PLAYER: tope de puntos por jugador (2).
//   - Un punto = +1 (sumar) o -1 (restar) sobre el atributo en escala 0-99.
//   - Sólo se vota a los del plantel que estaban en cancha al abrir el partido.
//   - El OVR de cada jugador es el promedio de sus 6 atributos YA Sumados los
//     votos de todos los partidos: por eso es dinámico.
//
// Una boleta es un objeto: { [nombreJugador]: { pace: 1, shooting: -1 } }
// Los deltas que valen 0 no se guardan.

import { RATING_STATS, players, statOf } from '../data.js';

export const TOTAL_POINTS = 5;
export const POINTS_PER_PLAYER = 2;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

// Atributo base del jugador en 0-99 (sin votos). Viene de data.js para que el
// OVR base y el OVR con votos se calculen exactamente igual.
const baseOf = (player, key) => statOf(player, key);

export const emptyBallot = () => ({});

// Cuántos puntos usa un jugador dentro de la boleta (suma de los valores
// absolutos: +1 y -1 cuentan 1 cada uno).
export const costOfPlayer = (deltas) => Object.values(deltas || {}).reduce((sum, value) => sum + Math.abs(value), 0);

// Puntos ya gastados en total.
export const spent = (ballot) => Object.values(ballot || {}).reduce((sum, deltas) => sum + costOfPlayer(deltas), 0);

export const remaining = (ballot) => Math.max(0, TOTAL_POINTS - spent(ballot));

// Boleta en filas para el admin: a quién le cargó puntos y en qué atributo.
export function ballotSummary(ballot) {
  const rows = [];
  for (const [player, deltas] of Object.entries(ballot || {})) {
    const parts = [];
    for (const stat of RATING_STATS) {
      const delta = Number(deltas?.[stat.key] || 0);
      if (!delta) continue;
      parts.push({ key: stat.key, label: stat.label, delta });
    }
    if (parts.length) rows.push({ player, parts });
  }
  return rows;
}

// Por qué no se puede aplicar un voto: sirve para explicarle al usuario.
export function canCast(ballot, playerName, key, direction) {
  const current = ballot?.[playerName] || {};
  const next = { ...current, [key]: (current[key] || 0) + direction };
  if (next[key] === 0) delete next[key];
  if (costOfPlayer(next) > POINTS_PER_PLAYER) {
    return { ok: false, code: 'player-limit', reason: `Máximo ${POINTS_PER_PLAYER} puntos por jugador` };
  }
  const trial = { ...(ballot || {}), [playerName]: next };
  if (!Object.keys(next).length) delete trial[playerName];
  if (spent(trial) > TOTAL_POINTS) {
    return { ok: false, code: 'no-points', reason: 'No te quedan puntos' };
  }
  return { ok: true, code: 'ok', reason: '' };
}

// Aplicar un voto. Devuelve la MISMA referencia si no se acepta, para que React
// no re-renderice al pedo.
export function castVote(ballot, playerName, key, direction) {
  const current = ballot || {};
  if (!canCast(current, playerName, key, direction).ok) return current;
  const next = { ...current, [playerName]: { ...(current[playerName] || {}) } };
  next[playerName][key] = (next[playerName][key] || 0) + direction;
  if (next[playerName][key] === 0) delete next[playerName][key];
  if (!Object.keys(next[playerName]).length) delete next[playerName];
  return next;
}

// Saca la boleta de UNA persona de la lista guardada en el navegador.
//
// Importante: acá sólo se borra lo local de `voterId`. Los votos que ya
// aplicaste desde los informes de WhatsApp viven en src/data/castedVotes.js,
// van en el bundle y los ve todo el mundo: desde el celu no se tocan (ni
// tendría sentido, no serían los únicos).
//
// Devuelve la MISMA referencia si esa persona no había votado, para que React
// no re-renderice al pedo (mismo criterio que castVote).
export function clearBallot(ballots, voterId) {
  const current = ballots || [];
  if (!current.some((row) => row?.voterId === voterId)) return current;
  return current.filter((row) => row?.voterId !== voterId);
}

// Suma las boletas de todos: { [jugador]: { atributo: deltaTotal } }
export function aggregateBallots(ballots) {
  const total = {};
  for (const ballot of ballots || []) {
    for (const [name, deltas] of Object.entries(ballot || {})) {
      const target = total[name] || (total[name] = {});
      for (const [key, value] of Object.entries(deltas || {})) {
        target[key] = (target[key] || 0) + value;
      }
    }
  }
  return total;
}

// OVR = promedio de los atributos YA redondeados a 0-99: se usa `statOf`, que
// es el mismo número que muestra la barra de la ficha. Así el OVR no se mueve
// solo por redondeo cuando no hay votos.
const overallOfAttributes = (attributes) => Math.round(
  RATING_STATS.reduce((sum, stat) => sum + (attributes[stat.key] || 0), 0) / RATING_STATS.length,
);

// Jugador con los votos ya aplicados: atributos y OVR recalculados.
export function withVotes(player, deltas) {
  const attributes = {};
  for (const stat of RATING_STATS) {
    attributes[stat.key] = clamp(baseOf(player, stat.key) + (deltas?.[stat.key] || 0), 0, 99);
  }
  return { ...player, attributes, rating: overallOfAttributes(attributes) };
}

// El roster completo (Plantel) con todos los votos aplicados.
export function dynamicRoster(deltas) {
  return players.map((player) => withVotes(player, deltas?.[player.name]));
}

// Lo mismo pero incluyendo los jugadores que sólo están en la Alineación.
export function dynamicAlignmentRoster(deltas, alignmentRoster) {
  return alignmentRoster.map((player) => withVotes(player, deltas?.[player.name]));
}