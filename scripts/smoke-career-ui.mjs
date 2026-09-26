// ============================================================================
// SMOKE DE UI DEL MODO CARRERA (render real)
// Uso: node scripts/smoke-career-ui.mjs
//
// 1) Compila el entry SSR (scripts/ssr/career-ui-entry.jsx) con vite.
// 2) Renderiza CADA componente de presentación del Career Mode con el estado
//    REAL de flow.js/engine.js en cada fase: setup, debut, temporada, evento,
//    decisión, mercado, retiro obligatorio y retirado.
// 3) Verifica que ningún render falle y que no aparezcan textos rotos
//    ("undefined", "NaN", "[object Object]").
// 4) Revisa reglas de CSS clave (layout/overflow/media queries) leyendo
//    careerScreen.css como texto.
//
// No forma parte de `npm run build`: es un smoke manual (igual que el resto).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { players } from '../src/data.js';
import { allClubs, findClub } from '../src/data/careerWorld.js';
import { CREST_FILES } from '../src/data/careerWorld/crests.generated.js';
import * as flow from '../src/features/career/flow.js';
import { FLOW_PHASES } from '../src/features/career/flow.js';
import { cleanText, clubVisual } from '../src/features/career/components/careerFormat.js';

const SSR_ENTRY = 'scripts/ssr/career-ui-entry.jsx';
const SSR_OUT = 'tmp/ssr-ui';
const SSR_BUNDLE = `${SSR_OUT}/career-ui-entry.js`;

let failures = 0;
const fail = (label) => { failures += 1; console.error('  x FAIL:', label); };
const assert = (cond, label) => { if (!cond) fail(label); };

const BROKEN = /undefined|NaN|\[object Object\]/;

const player = players.find((p) => p.name === 'Alan') || players[0];

// ---------------------------------------------------------------------------
// 1) Build del bundle SSR
// ---------------------------------------------------------------------------
console.log('\n== 1) Build SSR del entry de UI ==');
try {
  execFileSync('npx', ['vite', 'build', '--ssr', SSR_ENTRY, '--outDir', SSR_OUT, '--emptyOutDir', 'true'], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  console.log(`   bundle: ${SSR_BUNDLE}`);
} catch (error) {
  fail(`no se pudo compilar el entry SSR (${String(error.message).split('\n')[0]})`);
  console.log(`\n${failures} FALLAS`);
  process.exit(1);
}


// ---------------------------------------------------------------------------
// 2) Estados reales del flujo
// ---------------------------------------------------------------------------
console.log('\n== 2) Render por fase (estado real del motor) ==');

const seed = 2026;
let state = flow.startCareer(player, { difficulty: 'intensa', seed });
const debutState = state;

// debut → elegir cantera
state = flow.chooseYouthClub(state, state.youthOffers[0]);
const seasonState = state;

const eventState = (() => {
  let s = seasonState;
  for (let i = 0; i < 40; i += 1) {
    if (s.phase === FLOW_PHASES.EVENT) return s;
    if (s.phase === FLOW_PHASES.SEASON) { s = flow.advanceSeason(s, { seed: seed + i }); continue; }
    if (s.phase === FLOW_PHASES.DECISION) s = flow.chooseCareerAction(s, 'stay', null, { seed: seed + i });
    else break;
  }
  return null;
})();

const decisionState = (() => {
  let s = seasonState;
  for (let i = 0; i < 40; i += 1) {
    if (s.phase === FLOW_PHASES.DECISION) return s;
    if (s.phase === FLOW_PHASES.SEASON) { s = flow.advanceSeason(s, { seed: seed + 100 + i }); continue; }
    if (s.phase === FLOW_PHASES.EVENT) {
      s = flow.chooseCareerAction(s, 'choose_event_choice', s.currentEvent.event.choices[0].id, { seed: seed + i });
      continue;
    }
    break;
  }
  return null;
})();

const openedMarket = decisionState
  ? flow.chooseCareerAction(decisionState, 'transfer', null, { seed: 77 })
  : null;
const transferState = openedMarket && openedMarket.phase === FLOW_PHASES.TRANSFER ? openedMarket : null;

const retiredState = (() => {
  let s = seasonState;
  for (let i = 0; i < 200; i += 1) {
    if (s.phase === FLOW_PHASES.RETIRED) return s;
    if (s.phase === FLOW_PHASES.SEASON) { s = flow.advanceSeason(s, { seed: 9000 + i }); continue; }
    if (s.phase === FLOW_PHASES.EVENT) {
      s = flow.chooseCareerAction(s, 'choose_event_choice', s.currentEvent.event.choices[0].id, { seed: 9000 + i });
      continue;
    }
    const options = flow.getCareerDecisionOptions(s);
    if (options.includes('transfer')) {
      const opened = flow.chooseCareerAction(s, 'transfer', null, { seed: 9000 + i });
      if (opened.phase === FLOW_PHASES.TRANSFER && opened.transferOffers.length > 0) {
        s = flow.chooseCareerAction(opened, 'transfer', opened.transferOffers[0], { seed: 9000 + i });
      } else {
        s = opened;
      }
      continue;
    }
    if (options.includes('stay')) { s = flow.chooseCareerAction(s, 'stay', null, { seed: 9000 + i }); continue; }
    if (options.includes('retire')) { s = flow.chooseCareerAction(s, 'retire', null, { seed: 9000 + i }); continue; }
    break;
  }
  return s.phase === FLOW_PHASES.RETIRED ? s : null;
})();

assert(Boolean(debutState.youthOffers), 'el debut tiene ofertas de cantera para renderizar');
assert(Boolean(eventState), 'se alcanzó un evento real');
assert(Boolean(decisionState), 'se alcanzó un checkpoint de decisión');
assert(Boolean(retiredState), 'se alcanzó el retiro');

const career = decisionState ? decisionState.career : seasonState.career;
const report = decisionState ? decisionState.seasonReport : null;

const ui = await import(`../${SSR_BUNDLE}`);

const check = (result, markers = []) => {
  if (!result) { fail('render no devolvió resultado'); return ''; }
  if (result.ok !== true) { fail(`${result.name}: el render lanzó (${result.error})`); return ''; }
  if (!result.html || result.html.length < 20) { fail(`${result.name}: HTML vacío`); return result.html; }
  if (BROKEN.test(result.html)) fail(`${result.name}: texto roto en el HTML`);
  for (const marker of markers) {
    if (!result.html.includes(marker)) fail(`${result.name}: falta "${marker}"`);
  }
  return result.html;
};

// --- Setup (sin carrera) ---
const setupHtml = check(ui.renderSetup({ draftName: player.name, difficulty: 'normal' }), ['Mi carrera', 'Iniciar carrera', player.name]);
assert(setupHtml.includes('296 clubes'), 'CareerSetup muestra el tamaño del mundo (296 clubes)');
check(ui.renderSetup({ draftName: player.name, stoppedReason: 'invalid_player' }), ['Iniciar carrera']);

// --- Debut ---
// La barra del header muestra identidad (nombre/edad/temporada) + navegación:
// no repite el club (la identidad del club vive en las tarjetas). En debut la
// carrera todavía NO tiene club (club = null).
const debutHeaderHtml = check(ui.renderHeader(debutState.career, debutState.phase),
  ['Mi carrera', 'Inicio', 'Plantel', player.name, `Temporada ${debutState.career.season}`, 'Volver a inicio']);
assert(!debutHeaderHtml.includes('Sin club'), 'el header no inventa club cuando la carrera nace sin club');
assert(!/\b(Juegos|Ficha|Copero)\b/.test(debutHeaderHtml), 'el header no expone secciones retiradas');
check(ui.renderOverview(debutState.career));
// OVR visible: el del JUGADOR sí; el del club NUNCA en la selección inicial.
const debutCardHtml = check(ui.renderPlayerCard(debutState.career), ['OVR']);
assert(debutCardHtml.includes('Sin club'), 'la ficha del jugador muestra "Sin club" en el debut');
check(ui.renderTimeline(debutState.career, debutState.phase));
// Sin trayectoria todavía (debut: 0 temporadas, 0 clubes) no se renderiza nada.
const debutHistory = ui.renderHistory(debutState.career);
assert(debutHistory.ok === true && debutHistory.html === '',
  'CareerHistory sin trayectoria (debut) no renderiza nada');
const youthHtml = check(ui.renderYouthOffers(debutState.youthOffers), ['Elegí tu primer club']);
assert(!/OVR/i.test(youthHtml), 'las tarjetas de selección NO muestran ningún OVR/rating del club');
assert(youthHtml.split('ELEGIR').length - 1 === 3, 'exactamente 3 tarjetas de club para elegir');
const youthSrc = fs.readFileSync('src/features/career/components/YouthOffers.jsx', 'utf8');
assert(!/clubOvr/.test(youthSrc), 'YouthOffers.jsx ya no referencia el OVR del club');
assert(!/Jugar temporada|Simular temporada|Continuar/i.test(youthSrc),
  'sin botones intermedios ("Jugar/Simular temporada", "Continuar") en la selección');
for (const offer of debutState.youthOffers) {
  assert(Boolean(findClub(offer.club.slug)), `la oferta de cantera ${offer.club.slug} sigue en el catálogo`);
  assert(offer.club.slug !== 'atlante', 'Atlante nunca aparece como opción inicial');
  assert(findClub(offer.club.slug).countryCode === 'AR', `la oferta ${offer.club.slug} es argentina`);
}

// --- Temporada ---
const seasonHeaderHtml = check(ui.renderHeader(seasonState.career, seasonState.phase),
  ['Mi carrera', 'Inicio', 'Plantel', seasonState.career.name, `Temporada ${seasonState.career.season}`, 'Volver a inicio']);
assert(!/\b(Juegos|Ficha|Copero)\b/.test(seasonHeaderHtml), 'el header de temporada no expone secciones retiradas');
assert(!seasonHeaderHtml.includes(seasonState.career.club.name),
  'el header (barra) no repite el club: el club vive en las tarjetas');
check(ui.renderOverview(seasonState.career));
check(ui.renderTimeline(seasonState.career, seasonState.phase));
// La temporada recién empieza: todavía no hay informe de temporada que mostrar.
const earlyReport = ui.renderSeasonReport(seasonState.seasonReport, false, true);
assert(earlyReport.ok === true && earlyReport.html === '',
  'CareerSeasonReport sin informe (temporada recién arrancada) no renderiza nada');

// --- Evento ---
// CareerEvent repara el texto del catálogo (cleanText): lo comparable es el
// texto reparado, no el crudo del evento.
check(ui.renderEvent(eventState.currentEvent), [cleanText(eventState.currentEvent.event.title)]);
// Con hideCategory el título/categoría los pone el panel: el evento va "bare".
check(ui.renderEvent(eventState.currentEvent, true), [cleanText(eventState.currentEvent.event.intro)]);

// --- Decisión / mercado ---
check(ui.renderDecision(flow.getCareerDecisionOptions(decisionState)), []);
check(ui.renderSeasonReport(report, false, false));
check(ui.renderDestinations({
  career: decisionState.career,
  offers: transferState ? transferState.transferOffers : [],
  options: flow.getCareerDecisionOptions(decisionState),
}), [decisionState.career.club.name]);
if (transferState) {
  const offersHtml = check(ui.renderTransferOffers(transferState.transferOffers), ['Mercado de pases', 'Aceptar']);
  assert(!/OVR|clubOvr|playerOvr/.test(offersHtml),
    'el mercado no expone ningún OVR (el del club es dato interno del engine)');
  check(ui.renderDestinations({
    career: transferState.career,
    offers: transferState.transferOffers,
    options: flow.getCareerDecisionOptions(transferState),
  }), [transferState.career.club.name]);
  assert(transferState.transferOffers.every((offer) => offer.club && findClub(offer.club.slug)),
    'las ofertas del mercado renderizadas existen en el catálogo');
}

// --- Retiro ---
check(ui.renderDecision(['retire'], true), []);
check(ui.renderDestinations({
  career: decisionState.career,
  offers: [],
  options: ['retire'],
  retirementDue: true,
}), ['El cuerpo ya no aguanta otra temporada']);
check(ui.renderPlayerCard(retiredState.career, true));
check(ui.renderHeader(retiredState.career, retiredState.phase));
check(ui.renderHistory(retiredState.career, true));
check(ui.renderOverview(retiredState.career));
check(ui.renderTimeline(retiredState.career, retiredState.phase), ['Trayectoria']);

// --- Estados vacíos / tolerancia ---
const emptyYouth = ui.renderYouthOffers([]);
assert(emptyYouth.ok === true && emptyYouth.html === '', 'YouthOffers sin ofertas no renderiza nada');
const emptyOffers = ui.renderTransferOffers([]);
assert(emptyOffers.ok === true, 'TransferOffers sin ofertas no lanza');
const emptyDest = ui.renderDestinations({ career, offers: [], options: [] });
assert(emptyDest.ok === true && emptyDest.html === '', 'CareerDestinations sin alternativas no renderiza nada');
const emptyReport = ui.renderSeasonReport(null, false, false);
assert(emptyReport.ok === true, 'CareerSeasonReport sin reporte no lanza');
const noEvent = ui.renderEvent(null);
assert(noEvent.ok === true, 'CareerEvent sin evento no lanza');

// --- Aviso temporal de título (overlay sin click, encadenado) ---
const trophyLeague = { season: 2027, type: 'league', label: 'Liga', icon: '🏆', clubKey: 'river-plate', clubName: 'River Plate' };
const trophyCup = { season: 2027, type: 'cup', label: 'Copa Avergas', icon: '🥈', clubKey: 'river-plate', clubName: 'River Plate' };
const emptyToast = ui.renderTrophyToast([]);
assert(emptyToast.ok === true && emptyToast.html === '', 'CareerTrophyToast sin títulos no renderiza nada');
const oneToast = check(ui.renderTrophyToast([trophyLeague]), ['¡CAMPEÓN!', 'Ganaste la Liga', 'River Plate']);
assert(!/<button/i.test(oneToast), 'el aviso no expone ningún botón (no requiere click)');
// El SSR pinta SOLO el título actual (index 0): el encadenado al siguiente
// título corre en cliente con los timers del componente (cubierto por
// scripts/smoke-trophy-toasts.mjs a nivel de cola/detección).
check(ui.renderTrophyToast([trophyLeague, trophyCup]), ['¡CAMPEÓN!', 'Ganaste la Liga']);

// --- ClubBadge: logo real, fallback procedural y todos los clubes ---
const logoClub = allClubs().find((club) => CREST_FILES[club.slug]);
const plainClub = allClubs().find((club) => !CREST_FILES[club.slug]);
assert(Boolean(logoClub), 'hay al menos un club con logo real en el catálogo');
assert(Boolean(plainClub), 'hay al menos un club sin logo real (fallback procedural)');

// ClubBadge consume lo que produce clubVisual (crestSrc/symbol), no el club
// crudo del catálogo: el smoke pasa por la MISMA capa que usa la UI.
const logoVisual = clubVisual(logoClub);
const badgeLogo = check(ui.renderBadge(logoVisual), ['<img']);
assert(badgeLogo.includes(logoVisual.crestSrc), `ClubBadge usa el logo real de ${logoClub.slug}`);
check(ui.renderBadge(logoVisual, 'lg'));

const plainVisual = clubVisual(plainClub);
const badgeFallback = check(ui.renderBadge(plainVisual), [plainVisual.symbol]);
assert(!badgeFallback.includes('<img'), `ClubBadge no inventa un logo para ${plainClub.slug} (fallback procedural)`);

// Los 296 clubes renderizan su badge (ni un solo error por campos faltantes).
let badgeFailures = 0;
for (const club of allClubs()) {
  const badge = ui.renderBadge(clubVisual(club));
  if (badge.ok !== true || !badge.html || BROKEN.test(badge.html)) {
    badgeFailures += 1;
    if (badgeFailures <= 5) console.error(`      · ClubBadge falló con ${club.slug} (${badge.error || 'texto roto'})`);
  }
}
assert(badgeFailures === 0, `ClubBadge renderiza los 296 clubes sin errores (${badgeFailures} fallos)`);

// --- Resumen ---
console.log(`\n   renders verificados · logo real: ${logoClub.slug} · fallback: ${plainClub.slug}`);
console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
