// ============================================================================
// REGLAS DE LA CANCHA — lógica pura de la alineación (sin React)
// ============================================================================
// Son DOS EQUIPOS que comparten la cancha: 5 arriba (azules) y 5 abajo (rojos)
// en fútbol 5, o 6 y 6 en fútbol 6. El tope es POR EQUIPO, no total: por eso
// en fútbol 5 entran 10 jugadores.
//
// Reglas:
//   1) La cancha es entera: un jugador se suelta en cualquier punto y puede
//      cruzar el medio sin ningún tope.
//   2) El equipo sale de la mitad donde cae el jugador (arriba A / abajo B) y
//      sólo define el color.
//   3) Cada mitad tiene como máximo los jugadores de la modalidad (5 o 6), así
//      que nunca puede haber más de 10 (o 12) en la cancha, ni 10 y 0.
//   4) Un jugador de la lista SÓLO puede agregar: nunca sustituye a nadie. Si
//      la mitad destino está llena no entra y no sale nadie.
//   5) Entre los que YA están en la cancha, soltar uno encima de otro los
//      intercambia de posición, en cualquier momento.
//   6) Arrastrar un jugador de la cancha a la lista lo saca de la cancha.
//   7) Si la cancha está vacía, cualquier jugador de la lista puede entrar:
//      nunca queda trabada sin jugadores.
//
// Funciones puras: reciben un lineup y devuelven uno nuevo, sin mutar el
// original. Testeable sin DOM (scripts/smoke-lineup-rules.mjs).

import { alignmentPlayers, currentNameOf, players as plantel, poolOf, POOL } from '../data.js';

const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));

export const MIDLINE = 50;
export const PITCH_BOUNDS = { minX: 7, maxX: 93, minY: 5, maxY: 95 };
// Radio de "lo tiro encima": en % de la cancha, del tamaño de un jugador.
export const SWAP_RADIUS = 12;

// Modalidades disponibles: 5, 6 o 7 jugadores POR EQUIPO.
export const MODES = [5, 6, 7];
export const normalizeMode = (mode) => (MODES.includes(Number(mode)) ? Number(mode) : 5);

// Jugadores POR EQUIPO (por mitad). El total es el doble.
export const sizeForMode = (mode) => normalizeMode(mode);
export const totalForMode = (mode) => sizeForMode(mode) * 2;
// El equipo sale de la mitad: arriba A, abajo B.
export const teamForY = (y) => (y < MIDLINE ? 'teamA' : 'teamB');
export const otherTeam = (team) => (team === 'teamA' ? 'teamB' : 'teamA');
export const TEAMS = ['teamA', 'teamB'];

// Formación por defecto de cada equipo: se usa el prefijo según la modalidad
// (5, 6 o 7). teamB es el espejo de teamA respecto del medio.
export const FORMATION = {
  teamA: [[50, 9], [24, 25], [76, 25], [40, 40], [60, 40], [50, 32], [50, 45]],
  teamB: [[50, 91], [24, 75], [76, 75], [40, 60], [60, 60], [50, 68], [50, 55]],
};

export function clampToPitch(x, y) {
  return [
    clamp(x, PITCH_BOUNDS.minX, PITCH_BOUNDS.maxX),
    clamp(y, PITCH_BOUNDS.minY, PITCH_BOUNDS.maxY),
  ];
}

// Empuja un punto dentro de la mitad que le corresponde.
function forceHalf(y, team) {
  return team === 'teamA'
    ? clamp(y, PITCH_BOUNDS.minY, MIDLINE - 3)
    : clamp(y, MIDLINE + 3, PITCH_BOUNDS.maxY);
}

export const allNames = () => alignmentPlayers.map((item) => item.name);

const PLANTEL_NAMES = new Set(plantel.map((item) => item.name));

// Quienes del plantel están en cancha. Los Random no se votan ni abren partido.
export function playedFromLineup(lineup) {
  const names = [];
  const seen = new Set();
  for (const slot of lineup?.slots || []) {
    const name = slot?.name;
    if (!PLANTEL_NAMES.has(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

// Quiénes NO están en la cancha: la lista general de disponibles.
export function benchOf(lineup) {
  const onPitch = new Set(lineup.slots.map((slot) => slot.name));
  return allNames().filter((name) => !onPitch.has(name));
}

export function benchByPool(lineup) {
  const groups = { [POOL.squad]: [], [POOL.randoms]: [], [POOL.premium]: [] };
  for (const name of benchOf(lineup)) {
    const player = alignmentPlayers.find((item) => item.name === name);
    const pool = poolOf(player);
    (groups[pool] || groups[POOL.squad]).push(name);
  }
  return groups;
}

export function cloneLineup(lineup) {
  return { mode: lineup.mode, slots: lineup.slots.map((slot) => ({ ...slot })) };
}

export function findSlot(lineup, name) {
  return lineup.slots.find((slot) => slot.name === name) || null;
}

function toCoordinate(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Quién arranca en la cancha, en el orden en que ocupan los huecos de la base
// (los primeros 5 van al equipo de arriba, los 5 siguientes al de abajo).
// Es una lista fija, no "los primeros N de la lista": así la formación es la
// que querés y no depende del orden en que estén cargados en data.js.
export const STARTERS = [
  'Lk', 'Rui', 'Chino', 'Gonzi', 'Nahue',
  'JJ', 'Alan', 'Kike', 'Sailor', 'Cru',
];

// Lesionados de arranque. No llegan a la cancha, así que no pueden estar en la
// lista de arriba (el smoke lo comprueba: si se pisan, es un bug de datos).
export const DEFAULT_INJURIES = ['Rulo', 'Emi'];

export function starterLineup() {
  const mode = 5;
  const perTeam = sizeForMode(mode);
  const known = new Set(allNames());
  // Si algún nombre de STARTERS no existe (lo renombraron), se completa con el
  // resto de la lista para que la cancha no quede con un hueco raro.
  const picked = STARTERS.filter((name) => known.has(name));
  const rest = allNames().filter((name) => !picked.includes(name));
  const names = [...picked, ...rest].slice(0, perTeam * TEAMS.length);
  const slots = [];
  let index = 0;
  for (const team of TEAMS) {
    for (let spot = 0; spot < perTeam; spot += 1) {
      const [x, y] = FORMATION[team][spot];
      slots.push({ name: names[index], x, y });
      index += 1;
    }
  }
  return { mode, slots };
}

// Deja el lineup sano: sin repetidos, sin jugadores desconocidos, con toda
// posición dentro de la cancha y sin pasar el máximo POR EQUIPO.
// Un save roto (null, un string) cae en la formación base.
export function normalizeLineup(lineup) {
  const source = lineup && typeof lineup === 'object' ? lineup : null;
  const mode = normalizeMode(source?.mode);
  const perTeam = sizeForMode(mode);
  const known = new Set(allNames());
  const seen = new Set();
  const perHalf = { teamA: 0, teamB: 0 };
  const slots = [];

  const add = (name, x, y, forcedTeam) => {
    const current = currentNameOf(name);
    if (!known.has(current) || seen.has(current)) return;
    const [px, py] = clampToPitch(toCoordinate(x, MIDLINE), toCoordinate(y, MIDLINE));
    const team = forcedTeam || teamForY(py);
    if (perHalf[team] >= perTeam) return;
    seen.add(current);
    perHalf[team] += 1;
    slots.push({ name: current, x: px, y: forcedTeam ? forceHalf(py, team) : py });
  };

  if (Array.isArray(source?.slots)) {
    for (const slot of source.slots) add(slot?.name, slot?.x, slot?.y);
  } else if (Array.isArray(source?.teamA) || Array.isArray(source?.teamB)) {
    // Migración: los saves viejos tenían teamA/teamB. Se aplanan a una lista,
    // cada equipo a su mitad.
    for (const team of TEAMS) {
      const names = Array.isArray(source[team]) ? source[team] : [];
      const spots = Array.isArray(source.positions?.[team]) ? source.positions[team] : [];
      names.forEach((name, index) => add(name, spots[index]?.[0], spots[index]?.[1], team));
    }
  } else {
    return freshLineup();
  }

  return { mode, slots };
}

export function freshLineup() {
  return normalizeLineup(starterLineup());
}

// Índice del jugador sobre el que se soltó otro (intercambio), o -1.
// `exceptName` es el que se está arrastrando: no se cambia consigo mismo.
export function swapTargetIndex(slots, x, y, exceptName) {
  let target = -1;
  let targetDistance = SWAP_RADIUS ** 2;
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index].name === exceptName) continue;
    const distance = (slots[index].x - x) ** 2 + (slots[index].y - y) ** 2;
    if (distance <= targetDistance) { targetDistance = distance; target = index; }
  }
  return target;
}

// Arma el registro del arrastre a partir del punto donde se empezó a arrastrar.
// Se separa del componente para poder testear la geometría sin DOM: es donde
// más fácil se cuela una errata (un nombre mal escrito rompe el arrastre entero
// sin que se note, porque el error ocurre antes de que exista el arrastre).
export function beginDragRecord(lineup, payload, rect, clientX, clientY) {
  const spot = findSlot(lineup, payload.name);
  // El offset mantiene al jugador bajo el cursor: sin esto salta al centro.
  const onPitch = payload.source === 'pitch' && spot != null;
  return {
    ...payload,
    rect,
    offsetX: onPitch ? ((clientX - rect.left) / rect.width) * 100 - spot.x : 0,
    offsetY: onPitch ? ((clientY - rect.top) / rect.height) * 100 - spot.y : 0,
    startX: clientX,
    startY: clientY,
    clientX,
    clientY,
    moved: false,
    frame: null,
    x: 0,
    y: 0,
  };
}

// Cuántos jugadores hay en cada mitad de la cancha.
export function countByTeam(lineup) {
  const counts = { teamA: 0, teamB: 0 };
  for (const slot of lineup.slots) counts[teamForY(slot.y)] += 1;
  return counts;
}

// Promedio entero del OVR de cada mitad. Sin jugadores: null (en la cancha se
// muestra un guión). `ratingOf` es opcional: si no viene, se usa el OVR base.
export function ratingsByTeam(lineup, ratingOf) {
  const lookup = typeof ratingOf === 'function'
    ? ratingOf
    : (name) => alignmentPlayers.find((player) => player.name === name)?.rating;
  const buckets = { teamA: [], teamB: [] };
  for (const slot of lineup.slots || []) {
    const team = teamForY(slot.y);
    const rating = Number(lookup(slot.name));
    if (!Number.isFinite(rating)) continue;
    buckets[team].push(rating);
  }
  const average = (list) => (
    list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : null
  );
  return { teamA: average(buckets.teamA), teamB: average(buckets.teamB) };
}

// Soltar un jugador.
//   - Si ya estaba en la cancha: se queda donde se soltó, o se intercambia con
//     el que tenía justo debajo del punto de caída. El intercambio siempre se
//     puede: los dos cambian de mitad, así que ningún equipo crece.
//     Un movimiento libre NO puede dejar a un equipo con más jugadores de los
//     que le tocan: si la mitad destino ya está llena, no se mueve.
//   - Si venía de la lista: SÓLO ENTRA en la mitad donde cae. Si esa mitad ya
//     tiene los 5 (o 6) jugadores de la modalidad, no entra y no se saca a nadie.
export function dropPlayer(lineup, name, x, y) {
  const [dropX, dropY] = clampToPitch(x, y);
  const next = cloneLineup(lineup);
  const ownIndex = next.slots.findIndex((slot) => slot.name === name);

  // --- Ya estaba en la cancha: se mueve o se intercambia -------------------
  if (ownIndex >= 0) {
    const overIndex = swapTargetIndex(next.slots, dropX, dropY, name);
    if (overIndex >= 0) {
      // Intercambio: se cruzan las COORDENADAS. Cada nombre se queda en su
      // casilla de la lista y cambia de lugar con el otro. Los dos cruzan de
      // mitad a la vez, así que las cantidades no cambian.
      const mine = next.slots[ownIndex];
      const theirs = next.slots[overIndex];
      next.slots[ownIndex] = { name: mine.name, x: theirs.x, y: theirs.y };
      next.slots[overIndex] = { name: theirs.name, x: mine.x, y: mine.y };
      return next;
    }

    // Movimiento libre: pasar a la otra mitad es un pase de jugador, así que
    // esa mitad tiene que tener lugar. Quedarse en la suya siempre se puede.
    const from = teamForY(next.slots[ownIndex].y);
    const to = teamForY(dropY);
    if (from !== to && countByTeam(next)[to] >= sizeForMode(next.mode)) return lineup;

    next.slots[ownIndex] = { name, x: dropX, y: dropY };
    return next;
  }

  // --- Venía de la lista: sólo puede entrar, nunca reemplazar ---------------
  const team = teamForY(dropY);
  if (countByTeam(next)[team] >= sizeForMode(next.mode)) return lineup;
  next.slots.push({ name, x: dropX, y: dropY });
  return next;
}

// Sacar a un jugador de la cancha (lo arrastraron a la lista).
export function removeFromPitch(lineup, name) {
  const index = lineup.slots.findIndex((slot) => slot.name === name);
  if (index < 0) return lineup;
  const next = cloneLineup(lineup);
  next.slots.splice(index, 1);
  return next;
}

export function canPlaceOnPitch(lineup) {
  const counts = countByTeam(lineup);
  const cap = sizeForMode(lineup.mode);
  return counts.teamA < cap || counts.teamB < cap;
}

// Entra al primer hueco libre (el equipo con menos gente; empate, arriba).
export function addToPitch(lineup, name) {
  if (!name || findSlot(lineup, name)) return lineup;
  if (!allNames().includes(name)) return lineup;
  const counts = countByTeam(lineup);
  const cap = sizeForMode(lineup.mode);
  let team = null;
  if (counts.teamA < cap && counts.teamB < cap) {
    team = counts.teamA <= counts.teamB ? 'teamA' : 'teamB';
  } else if (counts.teamA < cap) team = 'teamA';
  else if (counts.teamB < cap) team = 'teamB';
  else return lineup;
  const [x, y] = FORMATION[team][counts[team]];
  const next = cloneLineup(lineup);
  next.slots.push({ name, x, y });
  return next;
}

// Cambio de modalidad: completa cada mitad desde la lista y recorta si sobra.
export function changeMode(lineup, nextMode) {
  if (nextMode === lineup.mode) return lineup;
  const next = cloneLineup(lineup);
  next.mode = nextMode;
  const perTeam = sizeForMode(nextMode);
  const extras = benchOf(next);

  // Primero recorta: los que sobran de su mitad vuelven a la lista.
  const kept = [];
  const perHalf = { teamA: 0, teamB: 0 };
  for (const slot of next.slots) {
    const team = teamForY(slot.y);
    if (perHalf[team] >= perTeam) continue;
    perHalf[team] += 1;
    kept.push(slot);
  }
  next.slots = kept;

  // Después completa hasta el máximo de cada equipo.
  for (const team of TEAMS) {
    while (perHalf[team] < perTeam && extras.length > 0) {
      const [x, y] = FORMATION[team][perHalf[team]];
      next.slots.push({ name: extras.shift(), x, y });
      perHalf[team] += 1;
    }
  }

  return next;
}
