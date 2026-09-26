// ============================================================================
// Smoke del CATÁLOGO COMPLETO dentro del Career Mode (estabilización)
// Uso: node scripts/smoke-career-all-clubs.mjs
//
// Recorre LOS 296 clubes del universo cerrado contra el flujo REAL de carrera
// (flow.js + engine.js) y contra la capa de presentación (careerFormat.js):
//
//  A) Los 296 clubes cumplen el contrato del engine (campos, OVR, división,
//     key, reputación, escudo) y todas las búsquedas resuelven.
//  B) Cada club resuelve su parte visual (clubVisual / reportClubVisual) y sus
//     logos declarados existen en public/.
//  C) Flujo completo por club: debut (cantera) → temporadas → evento →
//     decisión → mercado (aceptar transferencia / quedarse) → retiro.
//  D) Cada transición que toca un club deja un club del catálogo en la carrera
//     (club + clubHistory) y sin NaN/Infinity en ningún estado.
//  E) Persistencia: el estado se serializa y se relee con el club vigente del
//     catálogo (misma regla que usa useCareer).
//
// NO corre npm build ni instala dependencias.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { players } from '../src/data.js';
import {
  CAREER_WORLD_VERSION,
  allClubs,
  clubBaseline,
  clubKey,
  clubsByDivision,
  divisions,
  domesticReputation,
  findClub,
  findClubByKey,
  startingDivisionsForOvr,
} from '../src/data/careerWorld.js';
import { CREST_FILES } from '../src/data/careerWorld/crests.generated.js';
import { AGE } from '../src/features/career/config.js';
import {
  createCareer,
  generateTransferOffers,
  generateYouthOffers,
} from '../src/features/career/engine.js';
import {
  FLOW_PHASES,
  advanceSeason,
  chooseCareerAction,
  chooseYouthClub,
  getCareerDecisionOptions,
  startCareer,
} from '../src/features/career/flow.js';
import {
  CAREER_SAVE_SCHEMA_VERSION,
  deserializeCareerState,
  serializeCareerState,
} from '../src/features/career/persistence.js';
import { clubVisual, reportClubVisual } from '../src/features/career/components/careerFormat.js';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const RETIRE_MAX = AGE.RETIRE;

let failures = 0;
const fail = (label) => { failures += 1; console.error('  x FAIL:', label); };
const assert = (cond, label) => { if (!cond) fail(label); };

/** true si ningún número del árbol es NaN/Infinity. */
const deepScan = (value) => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(deepScan);
  return Object.values(value).every(deepScan);
};

const HEX = /^#[0-9a-f]{6}$/i;
const catalog = allClubs();
const player = players.find((p) => p.name === 'Alan') || players[0];

/** Envelope de save tal como lo escribe saveCareerState (misma forma). */
const envelopeOf = (state) => JSON.stringify({
  schemaVersion: CAREER_SAVE_SCHEMA_VERSION,
  worldVersion: CAREER_WORLD_VERSION,
  savedAt: Date.now(),
  state: JSON.parse(serializeCareerState(state).json),
});

/** La carrera solo guarda clubes del catálogo (slug + key vigentes). */
const clubInCatalog = (clubRef) => Boolean(
  clubRef
  && typeof clubRef === 'object'
  && findClub(clubRef.slug)
  && clubRef.key === clubKey(clubRef),
);

// ============================================================================
// A) Catálogo completo: contrato del engine
// ============================================================================
console.log('\n== A) Catálogo completo ==');
console.log(`   clubes: ${catalog.length} · divisiones internas: ${[1, 2].map((n) => `D${n}=${clubsByDivision(n).length}`).join(' ')}`);
console.log(`   divisiones declaradas: ${divisions.map((d) => `${d.nivel}:${d.name}`).join(' · ')}`);

assert(catalog.length === 296, `el catálogo tiene 296 clubes (${catalog.length})`);

const CONTRACT_FIELDS = ['slug', 'id', 'key', 'name', 'short', 'shortName', 'barrio', 'stadium',
  'city', 'country', 'countryCode', 'countryFlag', 'league', 'leagueId', 'leagueLevel',
  'division', 'ovr', 'overall', 'baseline', 'domesticReputation', 'continentalReputation',
  'internationalReputation', 'refTier', 'founded', 'colors', 'crest'];

const contractIssues = [];
for (const club of catalog) {
  const gaps = CONTRACT_FIELDS.filter((f) => club[f] === undefined || club[f] === null || club[f] === '');
  if (gaps.length) contractIssues.push(`${club.slug}: faltan ${gaps.join(', ')}`);
  if (!club.colors || !HEX.test(club.colors.primary || '') || !HEX.test(club.colors.secondary || '')) {
    contractIssues.push(`${club.slug}: colores inválidos`);
  }
  if (!Number.isFinite(club.ovr) || club.ovr < 30 || club.ovr > 99) contractIssues.push(`${club.slug}: OVR fuera de rango (${club.ovr})`);
  if (club.baseline !== club.ovr || club.overall !== club.ovr) contractIssues.push(`${club.slug}: baseline/overall ≠ ovr`);
  if (clubBaseline(club) !== club.ovr || domesticReputation(club) !== club.domesticReputation) {
    contractIssues.push(`${club.slug}: clubBaseline/domesticReputation no coinciden con el club`);
  }
  const expectedDiv = divisions.find((d) => club.ovr >= d.ovrMin);
  if (!expectedDiv || club.division !== expectedDiv.nivel) contractIssues.push(`${club.slug}: división interna incoherente con el OVR ${club.ovr}`);
  if (!Number.isFinite(club.domesticReputation) || club.domesticReputation < 0 || club.domesticReputation > 5) {
    contractIssues.push(`${club.slug}: reputación doméstica fuera de 0-5`);
  }
  if (club.key !== `${club.division}/${club.slug}` || club.key !== clubKey(club)) contractIssues.push(`${club.slug}: key inválida (${club.key})`);
  if (!club.crest || club.crest.type !== 'procedural' || !club.crest.symbol) contractIssues.push(`${club.slug}: descriptor de escudo incompleto`);
  if (!startingDivisionsForOvr(club.ovr).includes(club.division)) contractIssues.push(`${club.slug}: su división no es elegible para su OVR`);
}
assert(contractIssues.length === 0, `los 296 clubes cumplen el contrato del engine (${contractIssues.length} problemas)`);
contractIssues.slice(0, 15).forEach((row) => console.error('      ·', row));

const lookupIssues = catalog.filter((club) => findClub(club.slug) !== club || findClubByKey(club.key) !== club);
assert(lookupIssues.length === 0, `findClub/findClubByKey resuelven los 296 clubes (${lookupIssues.length} fallos)`);

// ============================================================================
// B) Visual por club (careerFormat) + logos declarados
// ============================================================================
console.log('\n== B) Visual por club ==');

let withLogo = 0;
let withFallback = 0;
let logoFilesChecked = 0;
const visualIssues = [];
for (const club of catalog) {
  const visual = clubVisual(club);
  const fromReport = reportClubVisual({ key: club.key, name: club.name, short: club.short, division: club.division });
  if (!visual.name || !visual.short) { visualIssues.push(`${club.slug}: visual sin nombre/sigla`); continue; }
  if (visual.primary !== club.colors.primary || visual.secondary !== club.colors.secondary) visualIssues.push(`${club.slug}: colores visuales ≠ catálogo`);
  if (visual.division !== club.division) visualIssues.push(`${club.slug}: división visual ≠ catálogo (${visual.division})`);
  if (!visual.country || !visual.league) visualIssues.push(`${club.slug}: país/liga sin resolver`);
  if (fromReport.name !== visual.name || fromReport.crestSrc !== visual.crestSrc || fromReport.short !== visual.short) {
    visualIssues.push(`${club.slug}: reportClubVisual no coincide con clubVisual`);
  }
  if (visual.crestSrc) {
    withLogo += 1;
    if (!fs.existsSync(path.join(PUBLIC_DIR, visual.crestSrc))) visualIssues.push(`${club.slug}: logo declarado pero ausente (${visual.crestSrc})`);
    else logoFilesChecked += 1;
  } else {
    withFallback += 1;
    if (!visual.symbol || !visual.crestShape) visualIssues.push(`${club.slug}: fallback procedural incompleto`);
  }
}
assert(visualIssues.length === 0, `clubVisual/reportClubVisual sin problemas en los 296 clubes (${visualIssues.length})`);
visualIssues.slice(0, 15).forEach((row) => console.error('      ·', row));
assert(logoFilesChecked === withLogo, `todos los logos declarados existen en public/ (${logoFilesChecked}/${withLogo})`);
console.log(`   con logo real: ${withLogo} · con fallback procedural: ${withFallback} · archivos verificados: ${logoFilesChecked}/${Object.keys(CREST_FILES).length} entradas del mapa`);

// Tolerancia: un club sin datos del catálogo no debe romper la UI.
const bare = clubVisual({ name: 'Club Sin Datos', short: 'CSD', colors: null });
assert(Boolean(bare.name) && Boolean(bare.primary) && Boolean(bare.crestShape), 'clubVisual tolera un club sin colores ni escudo (fallback)');
assert(reportClubVisual(null).name === clubVisual(null).name, 'reportClubVisual tolera un reporte sin club');

// ============================================================================
// C/D) Flujo completo por club: debut → temporadas → evento → decisión →
//      mercado → retiro, con el club siempre dentro del catálogo
// ============================================================================
console.log('\n== C) Flujo de carrera por club (296) ==');

const stats = {
  flows: 0, youthPicked: 0, seasons: 0, events: 0, decisions: 0, stays: 0,
  transfersAccepted: 0, retirements: 0, offersSeen: 0, finished: 0, badOffers: 0,
};
const flowIssues = [];
let ovrMin = Infinity;
let ovrMax = -Infinity;

/**
 * Resuelve UN checkpoint (evento / decisión / mercado) y devuelve el estado
 * siguiente. Nunca deja el estado a medias: si el mercado no trae ofertas,
 * sigue con 'stay' (o 'retire' cuando sea lo único disponible).
 */
function resolveCheckpoint(state, seed, preferStay = false) {
  const options = getCareerDecisionOptions(state);

  if (state.phase === FLOW_PHASES.EVENT) {
    const choices = state.currentEvent?.event?.choices;
    if (!Array.isArray(choices) || choices.length === 0) return { state, kind: 'event_sin_opciones' };
    stats.events += 1;
    return { state: chooseCareerAction(state, 'choose_event_choice', choices[0].id, { seed }), kind: 'event' };
  }

  if (state.phase === FLOW_PHASES.DECISION || state.phase === FLOW_PHASES.TRANSFER) {
    if (state.phase === FLOW_PHASES.DECISION) stats.decisions += 1;

    // El recorrido alterna los dos caminos reales del checkpoint: aceptar la
    // primera oferta de mercado o quedarse en el club (resolveStay).
    if (!preferStay && options.includes('transfer')) {
      const opened = chooseCareerAction(state, 'transfer', null, { seed });
      const list = Array.isArray(opened.transferOffers) ? opened.transferOffers : [];
      if (opened.phase === FLOW_PHASES.TRANSFER && list.length > 0) {
        stats.offersSeen += list.length;
        for (const offer of list) {
          const worldClub = offer.club ? findClub(offer.club.slug) : null;
          if (!worldClub || worldClub.division !== offer.division || worldClub.key !== offer.club.key) {
            stats.badOffers += 1;
          }
        }
        const taken = chooseCareerAction(opened, 'transfer', list[0], { seed });
        if (taken.lastAction?.ok === true) stats.transfersAccepted += 1;
        return { state: taken, kind: 'transfer' };
      }
      if (opened.lastAction?.ok === true) return { state: opened, kind: 'mercado_vacio' };
    }

    if (options.includes('stay')) {
      stats.stays += 1;
      return { state: chooseCareerAction(state, 'stay', null, { seed }), kind: 'stay' };
    }
    if (options.includes('retire')) {
      stats.retirements += 1;
      return { state: chooseCareerAction(state, 'retire', null, { seed }), kind: 'retire' };
    }
    return { state, kind: 'sin_opciones' };
  }

  return { state, kind: 'fase_no_resoluble' };
}

catalog.forEach((club, index) => {
  const seed = 1000 + index;
  let state = startCareer(player, {
    difficulty: index % 3 === 0 ? 'intensa' : 'normal',
    seed,
    initialDivision: club.division,
    initialClubSlug: club.slug,
  });
  stats.flows += 1;

  if (!state || !state.career) { flowIssues.push(`${club.slug}: startCareer no devolvió carrera`); return; }
  if (state.career.club?.slug !== club.slug) { flowIssues.push(`${club.slug}: no se respetó el club elegido (${state.career.club?.slug})`); return; }
  if (!clubInCatalog(state.career.club)) { flowIssues.push(`${club.slug}: la carrera arranca con un club fuera del catálogo`); return; }

  // Debut: elegir la primera oferta de cantera (contrato de flow.chooseYouthClub).
  if (state.phase === FLOW_PHASES.DEBUT && Array.isArray(state.youthOffers) && state.youthOffers.length > 0) {
    const allowed = startingDivisionsForOvr(state.career.ovr);
    for (const offer of state.youthOffers) {
      const worldClub = offer.club ? findClub(offer.club.slug) : null;
      if (!worldClub) flowIssues.push(`${club.slug}: oferta de cantera fuera del catálogo`);
      else if (!allowed.includes(offer.division)) flowIssues.push(`${club.slug}: oferta de cantera fuera de la división permitida (D${offer.division})`);
      else if (worldClub.division !== offer.division) flowIssues.push(`${club.slug}: división de la oferta ≠ catálogo`);
      else if (offer.clubOvr !== worldClub.overall) flowIssues.push(`${club.slug}: OVR de la oferta ≠ catálogo`);
      else if (offer.club.key !== worldClub.key) flowIssues.push(`${club.slug}: key de la oferta ≠ catálogo`);
    }
    state = chooseYouthClub(state, state.youthOffers[0]);
    stats.youthPicked += 1;
    const debutClub = state.career.club;
    if (state.phase !== FLOW_PHASES.SEASON) flowIssues.push(`${club.slug}: tras el debut la fase es ${state.phase}`);
    if (!clubInCatalog(debutClub)) flowIssues.push(`${club.slug}: club de debut fuera del catálogo (${debutClub?.slug})`);
    // Contrato del engine (acceptTransfer): etapa inicial sembrada + etapa del debut.
    const stages = state.career.clubHistory || [];
    if (stages.length !== 2) flowIssues.push(`${club.slug}: clubHistory del debut con ${stages.length} etapas (se esperaban 2)`);
    if (!stages.every((entry) => clubInCatalog(entry.club))) flowIssues.push(`${club.slug}: clubHistory con un club fuera del catálogo`);
    if (stages[stages.length - 1]?.club?.slug !== debutClub.slug) {
      flowIssues.push(`${club.slug}: la última etapa del debut no es el club firmado`);
    }
  }

  // Temporadas y checkpoints hasta el retiro.
  let steps = 0;
  while (state.phase !== FLOW_PHASES.RETIRED && steps < 120) {
    steps += 1;
    if (state.phase === FLOW_PHASES.SEASON) {
      const before = state.career.season;
      state = advanceSeason(state, { seed: seed + steps });
      stats.seasons += 1;
      if (state.career.season - before > 1) flowIssues.push(`${club.slug}: advanceSeason saltó temporadas`);
      continue;
    }
    const step = resolveCheckpoint(state, seed + steps * 7, index % 2 === 1);
    if (step.kind === 'fase_no_resoluble' || step.kind === 'sin_opciones' || step.kind === 'event_sin_opciones') {
      flowIssues.push(`${club.slug}: checkpoint no resoluble (${step.kind} en fase ${state.phase})`);
      break;
    }
    state = step.state;
  }
  if (state.phase !== FLOW_PHASES.RETIRED) flowIssues.push(`${club.slug}: la carrera no cerró en ${steps} pasos (fase ${state.phase})`);
  else stats.finished += 1;

  // D) Integridad del estado final: solo clubes del catálogo y números finitos.
  const stages = [...(state.career.clubHistory || []), { club: state.career.club }];
  const outside = stages.filter((entry) => !clubInCatalog(entry?.club));
  if (outside.length) flowIssues.push(`${club.slug}: ${outside.length} etapa(s) con club fuera del catálogo`);
  if (!deepScan(state)) flowIssues.push(`${club.slug}: estado con NaN/Infinity`);
  if (!(state.career.seasonHistory || []).every((row) => deepScan(row))) flowIssues.push(`${club.slug}: seasonHistory con NaN/Infinity`);
  if (!(state.career.trophies || []).every((row) => deepScan(row))) flowIssues.push(`${club.slug}: trophies con NaN/Infinity`);
  if (!Number.isFinite(state.career.ovr)) flowIssues.push(`${club.slug}: OVR no finito`);
  else { ovrMin = Math.min(ovrMin, state.career.ovr); ovrMax = Math.max(ovrMax, state.career.ovr); }
  if (!(state.career.age >= AGE.START && state.career.age <= RETIRE_MAX + 1)) flowIssues.push(`${club.slug}: edad fuera de rango (${state.career.age})`);
});

assert(flowIssues.length === 0, `ningún club rompe el flujo de carrera (${flowIssues.length} problemas)`);
flowIssues.slice(0, 20).forEach((row) => console.error('      ·', row));
assert(stats.youthPicked > 250, `la mayoría de las carreras pasaron por el debut (${stats.youthPicked}/${stats.flows})`);
assert(stats.seasons > 296, `se simularon temporadas en todas las carreras (${stats.seasons})`);
assert(stats.finished > 250, `la mayoría de las carreras llegó al retiro (${stats.finished}/${stats.flows})`);
assert(stats.badOffers === 0, `todas las ofertas de mercado apuntan a clubes del catálogo (${stats.badOffers} inconsistentes)`);
assert(stats.transfersAccepted > 0 && stats.stays > 0 && stats.retirements > 0,
  `se ejercitaron transferencia (${stats.transfersAccepted}), continuidad (${stats.stays}) y retiro (${stats.retirements})`);
console.log(`   flujos ${stats.flows} · debut ${stats.youthPicked} · temporadas ${stats.seasons} · eventos ${stats.events} · decisiones ${stats.decisions}`);
console.log(`   ofertas vistas ${stats.offersSeen} · transferencias ${stats.transfersAccepted} · continuidades ${stats.stays} · retiros ${stats.retirements}`);
console.log(`   OVR al cierre del recorrido: ${ovrMin} – ${ovrMax}`);

// ============================================================================
// E) Persistencia: el save se relee con el club vigente del catálogo
// ============================================================================
console.log('\n== E) Persistencia ==');

const sample = catalog.filter((_, i) => i % 37 === 0);
let roundTrips = 0;
for (const club of sample) {
  const started = startCareer(player, {
    seed: 4242, difficulty: 'normal', initialDivision: club.division, initialClubSlug: club.slug,
  });
  const played = started.phase === FLOW_PHASES.DEBUT
    ? chooseYouthClub(started, started.youthOffers[0])
    : advanceSeason(started, { seed: 7 });

  const serialized = serializeCareerState(played);
  assert(serialized.ok === true, `${club.slug}: el estado se serializa (${serialized.reason || 'ok'})`);
  if (!serialized.ok) continue;

  const restored = deserializeCareerState(envelopeOf(played));
  assert(restored.ok === true, `${club.slug}: el save se relee (${restored.reason || 'ok'})`);
  if (!restored.ok) continue;

  roundTrips += 1;
  if (!clubInCatalog(restored.state.career.club)) fail(`${club.slug}: el club restaurado no está en el catálogo (${restored.state.career.club?.slug})`);
  if (!deepScan(restored.state)) fail(`${club.slug}: el estado restaurado tiene NaN/Infinity`);

  // La carrera restaurada sigue jugable (no quedó un estado congelado).
  const after = advanceSeason(restored.state, { seed: 13 });
  assert(after.career.season >= restored.state.career.season, `${club.slug}: la carrera restaurada puede seguir avanzando`);
}
console.log(`   round-trips de save verificados: ${roundTrips}/${sample.length}`);

// Carrera completa hasta el retiro: historial consistente y cierre limpio.
const longClub = findClub('river-plate') || catalog[0];
let life = startCareer(player, {
  difficulty: 'normal', seed: 2026, initialDivision: longClub.division, initialClubSlug: longClub.slug,
});
if (life.phase === FLOW_PHASES.DEBUT) life = chooseYouthClub(life, life.youthOffers[0]);
let lifeSteps = 0;
while (life.phase !== FLOW_PHASES.RETIRED && lifeSteps < 160) {
  lifeSteps += 1;
  life = life.phase === FLOW_PHASES.SEASON
    ? advanceSeason(life, { seed: 500 + lifeSteps })
    : resolveCheckpoint(life, 900 + lifeSteps).state;
}
assert(life.phase === FLOW_PHASES.RETIRED, `la carrera completa llega al retiro (${lifeSteps} pasos, fase ${life.phase})`);
assert(life.career.retired === true, 'el retiro marca retired = true');
assert((life.career.seasonHistory || []).length >= 1, 'el historial de temporadas quedó registrado');
assert((life.career.clubHistory || []).length >= 1, 'el historial de clubes quedó registrado');
assert((life.career.clubHistory || []).every((h) => clubInCatalog(h.club)), 'cada etapa del historial referencia un club del catálogo');
assert(deepScan(life.career), 'la carrera completa no tiene NaN/Infinity');
assert(getCareerDecisionOptions(life).length === 0, 'una carrera retirada no ofrece más decisiones');
assert(advanceSeason(life).lastAction?.ok === false, 'no se puede avanzar una carrera retirada');
assert(deserializeCareerState(envelopeOf(life)).ok === true, 'una carrera retirada se persiste y se relee');
console.log(`   carrera completa: ${life.career.seasonHistory.length} temporadas · ${life.career.clubHistory.length} etapas · OVR ${life.career.ovr} a los ${life.career.age} años`);

// Guardas del engine que dependen del mundo (no cambian con el catálogo).
const retiredPlayer = { ...createCareer(player), retired: true };
assert(generateYouthOffers(retiredPlayer).length === 0, 'carrera retirada → sin ofertas de cantera');
assert(generateTransferOffers(retiredPlayer, { seed: 3 }).length === 0, 'carrera retirada → sin ofertas de mercado');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);





