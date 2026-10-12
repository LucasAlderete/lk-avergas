// ============================================================================
// SIMULACIÓN DE BALANCE — Mi carrera (Monte Carlo)
// ============================================================================
// Juega N carreras completas por jugador con decisiones al azar y resume cómo
// crece el OVR: con qué arranca, a qué edad y valor llega al pico, y en qué
// división debuta. Sirve para comparar el balance antes/después de tocar el
// motor (la misma idea que usa el creador de Copero para balancear).
//
// Uso: node scripts/sim-career-balance.mjs [carrerasPorJugador=200]
// ============================================================================
import { players } from '../src/data.js';
import {
  FLOW_PHASES,
  advanceSeason,
  chooseCareerAction,
  chooseYouthClub,
  getCareerDecisionOptions,
  startCareer,
} from '../src/features/career/flow.js';

const RUNS = Number(process.argv[2]) || 200;

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function playCareer(player, seed) {
  const rand = makeRng(seed);
  let state = startCareer(player, { difficulty: 'normal', seed });
  const start = state.career.ovr;
  let debutDivision = null;
  for (let guard = 0; guard < 400; guard += 1) {
    const { phase } = state;
    if (phase === FLOW_PHASES.RETIRED || phase === FLOW_PHASES.STOPPED) break;
    if (phase === FLOW_PHASES.DEBUT) {
      const offers = state.youthOffers || [];
      const pick = offers[Math.floor(rand() * offers.length)];
      debutDivision = pick?.division ?? null;
      state = chooseYouthClub(state, pick);
    } else if (phase === FLOW_PHASES.SEASON) {
      state = advanceSeason(state, { seed: seed + guard });
    } else if (phase === FLOW_PHASES.EVENT) {
      const choices = state.currentEvent?.event?.choices || [];
      const pick = choices[Math.floor(rand() * choices.length)];
      state = chooseCareerAction(state, 'choose_event_choice', pick?.id, { seed: seed + guard });
    } else if (phase === FLOW_PHASES.DECISION || phase === FLOW_PHASES.TRANSFER) {
      const options = getCareerDecisionOptions(state);
      if (phase === FLOW_PHASES.TRANSFER && (state.transferOffers || []).length) {
        state = chooseCareerAction(state, 'transfer', state.transferOffers[0], { seed: seed + guard });
      } else if (options.includes('transfer') && rand() < 0.5) {
        state = chooseCareerAction(state, 'transfer', null, { seed: seed + guard });
      } else if (options.includes('stay')) {
        state = chooseCareerAction(state, 'stay', null, { seed: seed + guard });
      } else if (options.includes('retire')) {
        state = chooseCareerAction(state, 'retire', null, { seed: seed + guard });
      } else break;
    } else break;
  }
  const history = state.career.seasonHistory || [];
  const peak = state.career.overallPeak;
  const peakRow = history.find((row) => row.ovrEnd === peak);
  return { start, potential: state.career.potential, peak, peakAge: peakRow?.age ?? null, debutDivision, final: state.career.ovr };
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };
const avg = (arr) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

const rows = [];
for (const player of players.filter((p) => p.lore)) {
  const results = [];
  for (let i = 0; i < RUNS; i += 1) results.push(playCareer(player, 1000 + i * 7919));
  const peaks = results.map((r) => r.peak);
  const peakAges = results.map((r) => r.peakAge).filter((a) => a != null);
  const divs = results.map((r) => r.debutDivision).filter((d) => d != null);
  rows.push({
    jugador: player.name,
    ovrReal: player.rating,
    ovrInicial: results[0].start,
    techoProm: avg(results.map((r) => r.potential)),
    picoProm: avg(peaks),
    'pico p10-p90': `${pct(peaks, 0.1)}-${pct(peaks, 0.9)}`,
    llega90: `${Math.round((peaks.filter((p) => p >= 90).length / peaks.length) * 100)}%`,
    llega95: `${Math.round((peaks.filter((p) => p >= 95).length / peaks.length) * 100)}%`,
    edadPico: avg(peakAges),
    divDebut: avg(divs),
  });
}
console.table(rows);
