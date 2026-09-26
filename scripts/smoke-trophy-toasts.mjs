// ============================================================================
// Smoke del aviso temporal de títulos — CareerTrophyToast (Career Mode)
// Uso: node scripts/smoke-trophy-toasts.mjs
//
// Cubre el comportamiento del aviso de campeón SIN tocar el flujo principal:
//   A) Sintaxis/importación de los módulos involucrados.
//   B) Sin fases nuevas: FLOW_PHASES intacto y sin estados de aviso.
//   C) El registro celebratedTrophyIds nace vacío y SOBREVIVE a las
//      acciones del flow (normalizeState lo preserva).
//   D) Detección: sin título → nada; 1 título → 1; varios → N en orden;
//      una vez marcado → no se vuelve a detectar (sin duplicados).
//   E) Recarga del save: round-trip → nada repite un título ya avisado.
//   F) Save legado (sin registro): siembra el histórico sin avisarlo y los
//      títulos nuevos después de la siembra sí se detectan.
//   G) Título real del engine: advanceSeason con rng rígido (determinista).
//
// NO corre npm build ni instala dependencias.
// ============================================================================
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { players } from '../src/data.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOW_REL = 'src/features/career/flow.js';
const HOOK_REL = 'src/features/career/useCareer.js';
const TOAST_REL = 'src/features/career/components/CareerTrophyToast.jsx';

const flow = await import(pathToFileURL(path.join(root, FLOW_REL)).href);
const { FLOW_PHASES } = flow;
const persistence = await import(pathToFileURL(path.join(root, 'src/features/career/persistence.js')).href);
const world = await import(pathToFileURL(path.join(root, 'src/data/careerWorld.js')).href);
const { CAREER_SAVE_SCHEMA_VERSION, serializeCareerState, deserializeCareerState, validateCareerState } = persistence;
const { CAREER_WORLD_VERSION, allClubs } = world;
const {
  trophyCelebrationId,
  pendingTrophyToasts,
  withCelebratedTrophyIds,
  baselineCelebratedTrophyIds,
} = await import(pathToFileURL(path.join(root, HOOK_REL)).href);

const player = players.find((p) => p.name === 'Alan') || players[0];

/** Envelope de save con la MISMA forma que saveCareerState (misma validación). */
const envelopeOf = (state) => JSON.stringify({
  schemaVersion: CAREER_SAVE_SCHEMA_VERSION,
  worldVersion: CAREER_WORLD_VERSION,
  savedAt: Date.now(),
  state: JSON.parse(serializeCareerState(state).json),
});

// ============================================================================
// A) Sintaxis / importación
// ============================================================================
console.log('== A) Sintaxis e importación ==');
for (const rel of [FLOW_REL, HOOK_REL]) {
  const check = spawnSync(process.execPath, ['--check', rel], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, `node --check ${rel}`);
  if (check.status !== 0) console.error(check.stderr);
}
assert(typeof trophyCelebrationId === 'function', 'helpers del aviso exportados por useCareer.js');
assert(typeof pendingTrophyToasts === 'function' && typeof withCelebratedTrophyIds === 'function'
  && typeof baselineCelebratedTrophyIds === 'function', 'pending/with/baseline exportados');

// ============================================================================
// B) Sin fases nuevas: el flujo sigue siendo exactamente el mismo
// ============================================================================
console.log('\n== B) Sin fases nuevas en flow.js ==');
assert(JSON.stringify(Object.keys(FLOW_PHASES))
  === JSON.stringify(['DEBUT', 'SEASON', 'EVENT', 'DECISION', 'TRANSFER', 'RETIRED', 'STOPPED']),
'FLOW_PHASES intacto (mismas 7 fases de siempre)');
const flowSource = fs.readFileSync(path.join(root, FLOW_REL), 'utf8');
assert(!/TROPHY_CHECKPOINT|WAITING_FOR_TROPHY|CONTINUE_AFTER_TROPHY/.test(flowSource),
  'flow.js sin estados de checkpoint/aviso de títulos');
const toastSource = fs.readFileSync(path.join(root, TOAST_REL), 'utf8');
assert(!/<button/i.test(toastSource), 'el componente no renderiza botones (no requiere click)');
assert(/VISIBLE_MS\s*=\s*2400/.test(toastSource),
  'cada aviso dura ~2.4s visibles (+ animaciones ≈ 2.7s, dentro de 2.5-3s)');

// ============================================================================
// C) El registro nace vacío y SOBREVIVE a las acciones del flow
// ============================================================================
console.log('\n== C) celebratedTrophyIds sobrevive a las acciones del flow ==');
let st = flow.startCareer(player, { seed: 11, difficulty: 'intensa' });
assert(Array.isArray(st.celebratedTrophyIds) && st.celebratedTrophyIds.length === 0,
  'startCareer: celebratedTrophyIds nace []');
const registry = ['2025:league:legado'];
st = withCelebratedTrophyIds(st, registry);
assert(JSON.stringify(st.celebratedTrophyIds) === JSON.stringify(registry), 'withCelebratedTrophyIds agrega ids');
const afterYouth = flow.chooseYouthClub(st, st.youthOffers[0]);
assert(JSON.stringify(afterYouth.celebratedTrophyIds) === JSON.stringify(registry),
  'chooseYouthClub: registro preservado (normalizeState)');

let s = afterYouth;
for (let i = 0; i < 40 && s.phase !== FLOW_PHASES.DECISION && s.phase !== FLOW_PHASES.RETIRED; i += 1) {
  if (s.phase === FLOW_PHASES.SEASON) { s = flow.advanceSeason(s, { seed: 300 + i }); continue; }
  if (s.phase === FLOW_PHASES.EVENT) {
    s = flow.chooseCareerAction(s, 'choose_event_choice', s.currentEvent.event.choices[0].id, { seed: 400 + i });
    continue;
  }
  break;
}
assert(s.phase === FLOW_PHASES.DECISION, `se llega al checkpoint de decisión (fase: ${s.phase})`);
assert(JSON.stringify(s.celebratedTrophyIds) === JSON.stringify(registry),
  'advanceSeason + eventos: registro preservado');
const stayed = flow.chooseCareerAction(s, 'stay', null, { seed: 9 });
assert(JSON.stringify(stayed.celebratedTrophyIds) === JSON.stringify(registry),
  "chooseCareerAction('stay'): registro preservado");

// ============================================================================
// D) Detección: sin título / un título / varios / una sola vez
// ============================================================================
console.log('\n== D) Detección de títulos (career.trophies − registro) ==');
const fresh = flow.startCareer(player, { seed: 3, difficulty: 'intensa' });
assert(Array.isArray(pendingTrophyToasts(fresh)) && pendingTrophyToasts(fresh).length === 0,
  'temporada sin título → nada que avisar');
assert(pendingTrophyToasts(null).length === 0 && pendingTrophyToasts({}).length === 0,
  'estados sin carrera → [] (nunca lanza)');

// Títulos con EXACTAMENTE la forma que genera rollSeasonTrophies.
const trophyA = { season: 2026, type: 'league', label: 'Liga', icon: '🏆', clubKey: 'test-club', clubName: 'Test Club' };
const trophyB = { season: 2026, type: 'cup', label: 'Copa Avergas', icon: '🥈', clubKey: 'test-club', clubName: 'Test Club' };

const withOne = { ...fresh, career: { ...fresh.career, trophies: [trophyA] } };
const pendingOne = pendingTrophyToasts(withOne);
assert(pendingOne.length === 1 && pendingOne[0] === trophyA, '1 título → 1 aviso pendiente');
const markedOne = withCelebratedTrophyIds(withOne, pendingOne.map(trophyCelebrationId));
assert(pendingTrophyToasts(markedOne).length === 0, 'marcado → 0 pendientes (re-render no duplica)');
assert(withCelebratedTrophyIds(markedOne, pendingOne.map(trophyCelebrationId)) === markedOne,
  'marcar dos veces → mismo estado (idempotente, sin write extra)');

const withTwo = { ...fresh, career: { ...fresh.career, trophies: [trophyA, trophyB] } };
const pendingTwo = pendingTrophyToasts(withTwo);
assert(pendingTwo.length === 2, 'varios títulos → todos encolados (se encadenan, no juntos)');
assert(pendingTwo[0] === trophyA && pendingTwo[1] === trophyB, 'en el orden cronológico del engine');
const markedTwo = withCelebratedTrophyIds(withTwo, pendingTwo.map(trophyCelebrationId));
assert(pendingTrophyToasts(markedTwo).length === 0, 'marcar todos → cola vacía');

// ============================================================================
// E) Recarga del save: el registro viaja con el save → nada se repite
// ============================================================================
console.log('\n== E) Recarga del save (round-trip) ==');
assert(validateCareerState(markedTwo).ok === true, 'el estado con registro valida para guardar');
assert(serializeCareerState(markedTwo).ok === true, 'el estado con registro serializa');
const reloaded = deserializeCareerState(envelopeOf(markedTwo));
assert(reloaded.ok === true, 'el save con registro se relee (round-trip)');
assert(reloaded.ok && pendingTrophyToasts(reloaded.state).length === 0,
  'recarga: ningún título ya avisado vuelve a aparecer');
const badRegistry = { ...fresh, celebratedTrophyIds: 42 };
assert(validateCareerState(badRegistry).ok === false,
  "registro con basura → save rechazado ('invalid_celebrated_trophy_ids')");

// ============================================================================
// F) Save legado (sin registro): siembra el histórico sin mostrarlo
// ============================================================================
console.log('\n== F) Saves legados (previos a esta mejora) ==');
const legacy = JSON.parse(JSON.stringify(withTwo));
delete legacy.celebratedTrophyIds;
assert(validateCareerState(legacy).ok === true, 'save legado sin el registro sigue siendo válido');
assert(pendingTrophyToasts(legacy) === null, 'legado → pending null (no inunda con avisos viejos)');
const seeded = baselineCelebratedTrophyIds(legacy);
assert(Array.isArray(seeded.celebratedTrophyIds) && seeded.celebratedTrophyIds.length === 2,
  'la siembra registra los 2 títulos históricos');
assert(pendingTrophyToasts(seeded).length === 0, 'legado: el histórico NO se muestra');
assert(baselineCelebratedTrophyIds(seeded) === seeded, 'la siembra es idempotente');
const nextTrophy = { ...trophyB, season: 2027 };
const afterSeeded = { ...seeded, career: { ...seeded.career, trophies: [...seeded.career.trophies, nextTrophy] } };
assert(pendingTrophyToasts(afterSeeded).length === 1,
  'un título NUEVO después de la siembra sí se detecta (una vez)');

// ============================================================================
// G) Detección real del engine: temporada con título (rng rígido determinista)
// ============================================================================
console.log('\n== G) Título real del engine (advanceSeason con rng rígido) ==');
const elite = allClubs().find((c) => c.division === 1 && c.domesticReputation >= 4);
assert(Boolean(elite), `club élite D1 para la prueba (${elite && elite.slug})`);

// rng rígido con la MISMA interfaz del flow: next() = 0 → todas las tiradas
// "bajas" del motor pasan (título incluido: la probabilidad en un club de rep
// alta es > 0, así que 0 < prob SIEMPRE gana la liga; MAX_TROPHIES corta en 1).
const riggedRng = {
  next: () => 0,
  int(min, max) {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.floor(lo + this.next() * (hi - lo + 1));
  },
};

let champion = flow.startCareer(player, { seed: 7, difficulty: 'intensa', initialClubSlug: elite.slug });
champion = withCelebratedTrophyIds(champion, registry);
// Se entra directo en 'season' con el club de élite (solo estado de prueba:
// el flow y el engine no se tocan; la elección de cantera movería el club).
champion = {
  ...champion,
  phase: FLOW_PHASES.SEASON,
  youthOffers: null,
  career: {
    ...champion.career,
    club: elite,
    domesticRep: elite.domesticReputation,
    clubBaseline: elite.overall,
  },
};
const advanced = flow.advanceSeason(champion, { rng: riggedRng });
assert(advanced.career.trophies.length === 1,
  `el engine rígido ganó exactamente 1 título (${advanced.career.trophies.length})`);
assert(typeof advanced.career.trophies[0].label === 'string' && advanced.career.trophies[0].label.length > 0,
  'el título viene con label legible (dato del engine, sin recalcular)');
assert(JSON.stringify(advanced.celebratedTrophyIds) === JSON.stringify(registry),
  'advanceSeason: el registro sobrevive a simulateSeason');
const pendingReal = pendingTrophyToasts(advanced);
assert(Array.isArray(pendingReal) && pendingReal.length === 1,
  'detección: el título real queda pendiente UNA vez');
const markedReal = withCelebratedTrophyIds(advanced, pendingReal.map(trophyCelebrationId));
assert(pendingTrophyToasts(markedReal).length === 0,
  'tras marcarlo, el mismo título real no se vuelve a detectar');

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-trophy-toasts: TODO OK'
  : `\n❌ smoke-trophy-toasts: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;

