// ============================================================================
// Smoke test de la capa React — useCareer.js (Paso 7 · revisado en Paso 10)
// Uso: node scripts/smoke-use-career.mjs
//
// Node no tiene renderer cliente (sin DOM) y el proyecto NO instala
// infraestructura de testing React (ni Vitest, ni Jest, ni Testing Library),
// así que este smoke NO ejecuta el hook: valida su contrato de forma estática
// y por el flow REAL. El render del cuerpo del hook con react-dom/server y la
// integración con persistence.js se cubren en
// scripts/smoke-use-career-persistence.mjs (Paso 10).
//
//   A) Validación estática de sintaxis (node --check) e imports/exports.
//   B) Verificar que useCareer.js NO usa localStorage / sessionStorage /
//      window / document (ni IndexedDB): cero storage propio, cero DOM. Desde
//      el Paso 10 el acceso al save vive SOLO en persistence.js.
//   C) Verificar que useCareer.js importa './flow.js' + './persistence.js' y
//      SOLO delega ahí (sin importar engine.js/events.js ni usar la API de
//      storage: sin duplicar lógica de carrera ni de persistencia).
//   D) Verificar por el flow REAL (mismo camino que recorre el hook) que las
//      operaciones delegadas funcionan: startCareer → chooseYouthClub →
//      advanceSeason → chooseCareerAction, incluyendo el caso lastAction.ok
//      === false (el hook NO lanza: mantiene el estado rechazado).
//
// El punto D replica la delegación 1:1 del hook sobre flow.js; es la prueba
// de que React → useCareer → flow → engine funciona (el wiring de React se
// verifica además con npm run build y en la pantalla 'career2' del lab).
// ============================================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { players } from '../src/data.js';

let failures = 0;
const assert = (cond, label) => {
  if (!cond) { failures += 1; console.error('  ✗ FAIL:', label); }
  else console.log('  ✓', label);
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_REL = 'src/features/career/useCareer.js';
const hookPath = path.join(root, HOOK_REL);

// Recorrido recursivo: true si ningún número es NaN/Infinity.
const deepScan = (v) => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (Array.isArray(v)) return v.every(deepScan);
  return Object.values(v).every(deepScan);
};

// ============================================================================
// A) Sintaxis del hook
// ============================================================================
console.log('== A) Sintaxis e imports/exports del hook ==');
{
  const check = spawnSync(process.execPath, ['--check', HOOK_REL], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, `node --check ${HOOK_REL}`);
  if (check.status !== 0) console.error(check.stderr);
}

// ============================================================================
// B) Sin storage propio / DOM (lectura estática del fuente SIN comentarios:
//    los comentarios del hook documentan la regla "NO usa X" y su texto
//    contiene las palabras, pero el código no: se analizan solo sentencias).
//    Desde el Paso 10 el hook DELEGA el save en persistence.js: sigue sin
//    mencionar storage y tampoco usa su API directa (getItem/setItem).
// ============================================================================
const source = fs.readFileSync(hookPath, 'utf8');
const sourceNoComments = source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
console.log('== B) Sin storage propio ni DOM ==');
{
  assert(!/localStorage/.test(sourceNoComments), 'NO usa localStorage');
  assert(!/sessionStorage/.test(sourceNoComments), 'NO usa sessionStorage');
  assert(!/indexedDB|IndexedDB/.test(sourceNoComments), 'NO usa IndexedDB');
  assert(!/\bwindow\b/.test(sourceNoComments), 'NO usa window');
  assert(!/\bdocument\b/.test(sourceNoComments), 'NO usa document');
}

// ============================================================================
// C) Imports/exports estáticos + delegación sin duplicar lógica
//    (flow.js para la carrera · persistence.js para el save · Paso 10)
// ============================================================================
console.log('== C) Imports/exports estáticos ==');
{
  const importLines = (source.match(/^import[\s\S]*?from[^\n]+$/gm) || []);
  assert(importLines.some((l) => /from\s*['"]react['"]/.test(l)), "importa hooks desde 'react' (solo hooks)");
  assert(importLines.some((l) => /from\s*['"]\.\/flow\.js['"]/.test(l)), "importa las funciones de './flow.js'");
  assert(importLines.some((l) => /from\s*['"]\.\/persistence\.js['"]/.test(l)), "importa './persistence.js' (única puerta al save)");
  assert(importLines.length === 3, `solo 3 imports (react + flow.js + persistence.js): tiene ${importLines.length}`);
  assert(!/from\s*['"]\.\/engine\.js['"]/.test(source), 'NO importa engine.js (solo via flow: sin duplicar lógica)');
  assert(!/from\s*['"]\.\/events\.js['"]/.test(source), 'NO importa events.js');
  assert(!/getItem|setItem|removeItem/.test(sourceNoComments), 'NO usa la API de storage (todo pasa por persistence.js)');
  assert(/export\s+function\s+useCareer|export\s+const\s+useCareer/.test(source), 'exporta useCareer');
  assert(/export\s+default\s+useCareer/.test(source), 'export default useCareer');
  // API mínima pedida por el Paso 7 (nombres reales del diseño).
  for (const name of ['start', 'chooseYouthClub', 'advanceSeason', 'chooseAction', 'reset', 'decisionOptions', 'lastAction']) {
    assert(new RegExp(`\\b${name}\\b`).test(source), `expone '${name}' en su API`);
  }
  // La API delega (no re-implementa): las llamadas van a los alias flow*.
  assert(/flowStartCareer\(/.test(source), 'start delega en flow.startCareer');
  assert(/flowChooseYouthClub\(/.test(source), 'chooseYouthClub delega en flow.chooseYouthClub');
  assert(/flowAdvanceSeason\(/.test(source), 'advanceSeason delega en flow.advanceSeason');
  assert(/flowChooseCareerAction\(/.test(source), 'chooseAction delega en flow.chooseCareerAction');
  assert(/flowGetCareerDecisionOptions\(/.test(source), 'decisionOptions delega en flow.getCareerDecisionOptions');
  // Persistencia delegada (Paso 10): el hook solo llama a persistence.js.
  assert(/loadCareerState\(\)/.test(sourceNoComments), 'la restauración delega en loadCareerState()');
  assert(/saveCareerState\(state\)/.test(sourceNoComments), 'el autosave delega en saveCareerState(state)');
  assert(/clearCareerState\(\)/.test(sourceNoComments), 'reset delega el borrado en clearCareerState()');
  // No duplica lógica del engine: el hook jamás llama al motor por su cuenta
  // (análisis sobre el fuente sin comentarios).
  for (const engineFn of ['createCareer(', 'simulateSeason(', 'acceptTransfer(', 'resolveStay(', 'retireCareer(', 'generateYouthOffers(', 'generateTransferOffers(', 'rollCareerEvent(', 'applyEventChoice(']) {
    assert(!sourceNoComments.includes(engineFn), `NO llama ${engineFn} directo (lógica 100% en flow/engine)`);
  }
}

// ============================================================================
// C.2) El módulo del hook se importa en Node (react resuelve named exports).
//      NO se ejecuta el hook: Node no renderiza React sin infra de testing.
// ============================================================================
console.log('== C.2) Import real del módulo (sin ejecutar el hook) ==');
{
  let mod = null;
  try {
    mod = await import(pathToFileURL(hookPath).href);
  } catch (err) {
    console.error('  ✗ FAIL: useCareer.js no se pudo importar en Node:', err.message);
    failures += 1;
  }
  assert(mod && typeof mod.useCareer === 'function', 'useCareer.js importa y exporta useCareer (función)');
  assert(mod && typeof mod.default === 'function', 'default export también es useCareer');
}

// ============================================================================
// D) Las operaciones que el hook delega funcionan por el flow REAL.
//    React → useCareer → flow → engine: acá se recorre el mismo camino que
//    recorre el hook (flow.js es la única puerta), replicando su delegación
//    1:1 (clon defensivo del player incluido, como hook.start).
// ============================================================================
console.log('== D) Delegación del hook validada contra flow.js real ==');
{
  const flow = await import(pathToFileURL(path.join(root, 'src', 'features', 'career', 'flow.js')).href);
  const gonzi = players.find((p) => p.name === 'Gonzi');
  const playerJson = JSON.stringify(gonzi);

  // hook.start(player, { seed, difficulty }) → flow.startCareer
  let s = flow.startCareer(JSON.parse(JSON.stringify(gonzi)), { seed: 2026, difficulty: 'intensa' });
  assert(s && s.phase === 'debut', 'start → flow.startCareer: phase "debut"');
  assert(Array.isArray(s.youthOffers) && s.youthOffers.length > 0, 'start: el flow trae ofertas de debut');

  // hook.chooseYouthClub(offer) → flow.chooseYouthClub
  const chosen = s.youthOffers[0];
  s = flow.chooseYouthClub(s, chosen);
  assert(s && s.phase === 'season' && s.lastAction.ok === true, 'chooseYouthClub → phase "season" (ok)');
  assert(s.career.club && s.career.club.slug === chosen.club.slug, 'chooseYouthClub: el club vigente es el de la oferta');

  // hook.advanceSeason() → flow.advanceSeason (hasta un checkpoint de decisión,
  // resolviendo eventos como lo hace el lab con chooseAction('choose_event_choice')).
  let seasons = 0;
  const maxSeasons = 40;
  while (s && s.phase !== 'decision' && seasons < maxSeasons) {
    s = flow.advanceSeason(s, { seed: 1000 + seasons });
    seasons += 1;
    if (s && s.phase === 'event' && s.currentEvent && Array.isArray(s.currentEvent.event.choices) && s.currentEvent.event.choices.length > 0) {
      s = flow.chooseCareerAction(s, 'choose_event_choice', s.currentEvent.event.choices[0].id, { seed: 2000 + seasons });
    }
    if (s && s.phase === 'retired') break;
  }
  assert(s && s.phase === 'decision', `advanceSeason + eventos → se llega a una decisión (${seasons} temporada(s))`);
  const options = flow.getCareerDecisionOptions(s);
  assert(JSON.stringify(options) === JSON.stringify(['stay', 'transfer', 'retire']),
    `decisionOptions en decisión: ['stay', 'transfer', 'retire'] (obtuvo ${JSON.stringify(options)})`);

  // hook.chooseAction('stay') → flow.chooseCareerAction
  const clubBeforeStay = s.career.club.slug;
  s = flow.chooseCareerAction(s, 'stay', null, { seed: 77 });
  assert(s && s.phase === 'season' && s.lastAction.ok === true, "chooseAction('stay') → phase 'season' (ok)");
  assert(s.career.club.slug === clubBeforeStay, "chooseAction('stay'): el club no cambia");

  // Rechazo limpio: acción inválida en fase equivocada NO lanza; el flow
  // devuelve el estado intacto con lastAction.ok === false (el hook lo
  // expone y la UI decide cómo mostrarlo).
  const snapshot = JSON.stringify(s);
  const rejected = flow.chooseCareerAction(s, 'retire', null, {});
  assert(rejected && rejected.lastAction.ok === false && rejected.lastAction.reason === 'wrong_phase',
    "estado rechazado (retire en 'season'): lastAction.ok === false sin lanzar");
  assert(JSON.stringify(rejected.career) === JSON.stringify(s.career), 'career intacta ante el rechazo');
  assert(JSON.stringify(s) === snapshot, 'estado original intacto ante el rechazo');

  // Sin NaN/Infinity en toda la cadena.
  assert(deepScan(s), 'sin NaN/Infinity en el flow state final');

  // Pureza: el player original queda intacto (lo que garantiza el clon del hook).
  assert(JSON.stringify(gonzi) === playerJson, 'player original de data.js sin mutar');
}

// ============================================================================
// Resumen
// ============================================================================
console.log(failures === 0
  ? '\n✅ smoke-use-career: TODO OK'
  : `\n❌ smoke-use-career: ${failures} fallo(s)`);
process.exitCode = failures === 0 ? 0 : 1;

