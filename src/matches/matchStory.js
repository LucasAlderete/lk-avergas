// ============================================================================
// HISTORIA DEL PARTIDO — resultado por diferencia, MVP / peor, medallas
// ============================================================================
// El marcador absoluto no importa: si el rojo ganó por 4, se guarda
// { winner: 'teamB', margin: 4 }. Empate es winner: 'draw' y margin 0.
//
// Los puntos del MVP/peor son los votos de ESE partido: se suman los deltas
// con signo. El que más recibió en neto es MVP; el que más negativo, el peor.
// Empates: entran todos los que empataron el máximo o el mínimo.
import { teamForY } from '../components/lineupRules.js';

export const TEAM_LABEL = Object.freeze({
  teamA: 'azul',
  teamB: 'rojo',
});

export const MEDALS = Object.freeze([
  { id: 'first-mvp', label: 'MVP por primera vez' },
  { id: 'streak-played-5', label: '5 partidos jugados seguidos' },
  { id: 'streak-won-3', label: '3 partidos ganados seguidos' },
  { id: 'played-10', label: '10 partidos jugados' },
]);

const MAX_MARGIN = 20;

export function parseResult(raw) {
  const winner = String(raw?.winner || '').trim();
  if (winner === 'draw') return { winner: 'draw', margin: 0 };
  if (winner !== 'teamA' && winner !== 'teamB') return null;
  const margin = Math.round(Number(raw?.margin));
  if (!Number.isFinite(margin) || margin < 1 || margin > MAX_MARGIN) return null;
  return { winner, margin };
}

export function resultLine(result) {
  const parsed = parseResult(result);
  if (!parsed) return 'Todavía no hay resultado';
  if (parsed.winner === 'draw') return 'Empate';
  const side = TEAM_LABEL[parsed.winner];
  const goles = parsed.margin === 1 ? '1 gol' : `${parsed.margin} goles`;
  return `Ganó el ${side} por ${goles}`;
}

export function packedSlots(slots) {
  const out = [];
  const seen = new Set();
  for (const slot of Array.isArray(slots) ? slots : []) {
    const name = String(slot?.name || '').trim();
    const x = Number(slot?.x);
    const y = Number(slot?.y);
    if (!name || seen.has(name) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(name);
    out.push({ name, x, y });
  }
  return out;
}

export function teamsFromSlots(slots) {
  const teams = { teamA: [], teamB: [] };
  for (const slot of packedSlots(slots)) {
    teams[teamForY(slot.y)].push(slot.name);
  }
  return teams;
}

export function playedNames(match) {
  const fromSlots = packedSlots(match?.slots).map((slot) => slot.name);
  if (fromSlots.length) return fromSlots;
  const names = [];
  const seen = new Set();
  for (const name of Array.isArray(match?.players) ? match.players : []) {
    const clean = String(name || '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    names.push(clean);
  }
  return names;
}

export function playerTeam(match, name) {
  const slot = packedSlots(match?.slots).find((item) => item.name === name);
  return slot ? teamForY(slot.y) : null;
}

export function playedIn(match, name) {
  return playedNames(match).includes(name);
}

export function wonMatch(match, name) {
  const result = parseResult(match?.result);
  if (!result || result.winner === 'draw') return false;
  return playerTeam(match, name) === result.winner;
}

// Suma neta de votos recibidos en un partido: +1 y -1 se cancelan.
export function netReceived(ballots) {
  const totals = {};
  for (const ballot of ballots || []) {
    for (const [name, deltas] of Object.entries(ballot || {})) {
      if (!name) continue;
      let sum = totals[name] || 0;
      for (const value of Object.values(deltas || {})) {
        const n = Number(value);
        if (Number.isFinite(n)) sum += n;
      }
      totals[name] = sum;
    }
  }
  return totals;
}

export function highlights(nets) {
  const entries = Object.entries(nets || {}).filter(([, value]) => Number.isFinite(value));
  const mvp = [];
  const worst = [];
  if (!entries.length) return { mvp, worst };
  const max = Math.max(...entries.map(([, value]) => value));
  const min = Math.min(...entries.map(([, value]) => value));
  if (max > 0) {
    for (const [name, value] of entries) {
      if (value === max) mvp.push(name);
    }
  }
  if (min < 0) {
    for (const [name, value] of entries) {
      if (value === min) worst.push(name);
    }
  }
  mvp.sort();
  worst.sort();
  return { mvp, worst };
}

// Quién subió y quién bajó en NETO en ese partido (todos los votos juntos).
export function swingOf(nets) {
  const up = [];
  const down = [];
  for (const [name, value] of Object.entries(nets || {})) {
    const net = Number(value);
    if (!name || !Number.isFinite(net) || net === 0) continue;
    if (net > 0) up.push({ name, net });
    else down.push({ name, net });
  }
  up.sort((a, b) => b.net - a.net || a.name.localeCompare(b.name, 'es'));
  down.sort((a, b) => a.net - b.net || a.name.localeCompare(b.name, 'es'));
  return { up, down };
}

export function signedNet(net) {
  const value = Number(net);
  if (!Number.isFinite(value) || value === 0) return '0';
  return value > 0 ? `+${value}` : String(value);
}

export function historyCard(doc, ballots) {
  const slots = packedSlots(doc?.slots);
  const result = parseResult(doc?.result);
  const nets = netReceived(ballots);
  const marks = highlights(nets);
  const swing = swingOf(nets);
  return {
    id: doc?.id || (doc?._id != null ? String(doc._id) : ''),
    status: doc?.status || 'closed',
    day: doc?.day || '',
    mode: Number(doc?.mode) || 5,
    createdAt: doc?.createdAt || null,
    closedAt: doc?.closedAt || null,
    players: Array.isArray(doc?.players) ? doc.players : [],
    slots,
    teams: teamsFromSlots(slots),
    result,
    mvp: marks.mvp,
    worst: marks.worst,
    up: swing.up,
    down: swing.down,
  };
}

function byCreatedAt(a, b) {
  return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
}

export function medalsOf(name, matches) {
  const earned = new Set();
  let playedStreak = 0;
  let winStreak = 0;
  let playedTotal = 0;
  const ordered = [...(matches || [])]
    .filter((match) => match && match.status !== 'open')
    .sort(byCreatedAt);

  for (const match of ordered) {
    if ((match.mvp || []).includes(name)) earned.add('first-mvp');
    if (!playedIn(match, name)) {
      playedStreak = 0;
      winStreak = 0;
      continue;
    }
    playedTotal += 1;
    playedStreak += 1;
    if (wonMatch(match, name)) winStreak += 1;
    else winStreak = 0;
    if (playedStreak >= 5) earned.add('streak-played-5');
    if (winStreak >= 3) earned.add('streak-won-3');
    if (playedTotal >= 10) earned.add('played-10');
  }

  return MEDALS.map((medal) => ({
    ...medal,
    earned: earned.has(medal.id),
  }));
}
