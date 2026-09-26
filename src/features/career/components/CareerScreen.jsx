// ============================================================================
// CAREER SCREEN — pantalla del Modo Carrera (Paso 12: UX estilo deportivo)
// ============================================================================
// Layout "deportivo moderno" con componentes propios:
//
//   DESKTOP: [player-card + decisión/evento/mercado] | [timeline]
//   MOBILE:  player-card → decisión/evento/mercado → timeline
//
// SOLO presentación y orquestación: estado/acciones vienen de useCareer
// (flow.js → engine.js/events.js). Sin reglas, sin temporadas inventadas.
// CareerSeasonReport es feedback compacto, nunca pantalla separada.
// TEMPORADA AUTOMÁTICA: la simulación la dispara el hook solo (useCareer
// encadena flow.advanceSeason); esta pantalla NO expone ningún botón de
// avance manual — solo opciones de club y de decisión.
// Scroll: al cambiar de fase relevante se vuelve al inicio (efecto aislado).
// TÍTULOS: CareerTrophyToast es un overlay temporal automático (sin click y
// sin fase nueva) alimentado por useCareer desde career.trophies; al terminar,
// el checkpoint que quedó debajo sigue exactamente igual.
//
// MERCADO DIRECTO (solo UI): al llegar al checkpoint de decisión post-temporada
// esta pantalla abre el mercado sola (acción 'transfer' sin payload de flow.js)
// y el panel muestra el selector de destino con TODAS las alternativas juntas
// (club actual + ofertas + retirarse). No existe paso intermedio "Ver ofertas".
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, RotateCcw, Trophy } from 'lucide-react';

import { players } from '../../../data';
import { useCareer } from '../useCareer';
import { FLOW_ACTIONS, FLOW_PHASES } from '../flow.js';
import CareerDestinations from './CareerDestinations';
import CareerEvent from './CareerEvent';
import CareerHeader from './CareerHeader';
import CareerPlayerCard from './CareerPlayerCard';
import CareerSetup from './CareerSetup';
import CareerTimeline from './CareerTimeline';
import CareerTrophyToast from './CareerTrophyToast';
import YouthOffers from './YouthOffers';
import { EVENT_CATEGORIES } from '../events.js';
import { DASH, cleanText, feedbackOf, phaseLabel, statText } from './careerFormat.js';
import './careerScreen.css';

export default function CareerScreen({ onBack, onNavigate }) {
  const careerHook = useCareer();
  const {
    state, phase, career, youthOffers, transferOffers, currentEvent,
    seasonReport, lastAction, stoppedReason, retirementDue,
    decisionOptions, isRetired, start, chooseYouthClubAndStart,
    chooseAction, reset, trophyToasts, clearTrophyToasts,
  } = careerHook;

  const [draftName, setDraftName] = useState(() => (players[0] ? players[0].name : ''));
  const [difficulty, setDifficulty] = useState('normal');
  const [seedInput, setSeedInput] = useState('2026');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  // Recibo post-decisión de evento (solo presentación): guarda la narración
  // completa de la opción elegida para mostrarla junto a las opciones del
  // checkpoint siguiente, cuando el motor ya cerró el evento (currentEvent
  // === null). Es INFORMACIÓN, no un paso de confirmación: no tiene botón y
  // se descarta recién cuando se toma una decisión (handleAction).
  const [eventReceipt, setEventReceipt] = useState(null);
  const topRef = useRef(null);
  const firstRenderRef = useRef(true);
  // Checkpoint de decisión cuyo mercado ya se intentó abrir (ver efecto de abajo).
  const marketRef = useRef(null);

  const draftPlayer = players.find((item) => item.name === draftName) || players[0] || null;
  const feedback = feedbackOf(lastAction);
  const options = Array.isArray(decisionOptions) ? decisionOptions : [];

  // Recibo post-decisión de evento pendiente de mostrar (narración de la
  // opción elegida). Se muestra COMO INFORMACIÓN junto al selector de
  // destinos (mercado y recibo conviven): ningún botón de confirmación.
  const showEventReceipt = Boolean(eventReceipt);

  const runAction = (key, fn) => {
    if (busyAction) return;
    setBusyAction(key);
    try { fn(); } finally { window.setTimeout(() => setBusyAction(null), 650); }
  };
  const handleStart = () => {
    if (!draftPlayer || busyAction) return;
    setBusyAction('start');
    const raw = String(seedInput || '').trim();
    const seed = raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
    marketRef.current = null; // carrera nueva: checkpoints nuevos
    setEventReceipt(null);
    start(draftPlayer, { seed, difficulty });
    window.setTimeout(() => setBusyAction(null), 600);
  };
  const handleAction = (action, payload = null) => {
    // Cualquier acción distinta de la elección de evento invalida el recibo
    // post-decisión (solo presentación): evita mostrar narraciones viejas.
    if (action !== 'choose_event_choice') setEventReceipt(null);
    runAction(String(action), () => chooseAction(action, payload));
  };
  const handleYouth = (offer) => {
    runAction('choose_youth_club', () => chooseYouthClubAndStart(offer));
  };
  // Elección de evento: se "fotografía" la opción (label + description del
  // motor, sin modificar textos) ANTES de resolverla, para mostrar la
  // narración completa como recibo post-decisión.
  const handleEventChoose = (choiceId) => {
    const event = currentEvent && currentEvent.event ? currentEvent.event : null;
    const choices = event && Array.isArray(event.choices) ? event.choices : [];
    const key = choiceId && typeof choiceId === 'object' ? (choiceId.choiceId || choiceId.id || choiceId.choice) : choiceId;
    const chosen = choices.find((choice) => choice && choice.id === key) || null;
    setEventReceipt(chosen ? {
      eventId: event.id || null,
      choiceId: chosen.id || null,
      choiceLabel: cleanText(chosen.label),
      choiceNarrative: cleanText(chosen.description),
    } : null);
    handleAction('choose_event_choice', choiceId);
  };
  const handleReset = () => { setConfirmReset(false); setEventReceipt(null); marketRef.current = null; reset(); };

  const focusKey = useMemo(() => {
    if (!career) return 'setup';
    const reportTag = seasonReport && Number.isFinite(seasonReport.season) ? `-t${seasonReport.season}` : '';
    const eventTag = phase === FLOW_PHASES.EVENT && currentEvent && currentEvent.event ? `-${currentEvent.event.id || 'ev'}` : '';
    // Decisión y mercado abierto son la MISMA vista ("elegí tu destino"): el
    // auto-open del mercado no vuelve a disparar el scroll.
    const phaseTag = (phase === FLOW_PHASES.DECISION || phase === FLOW_PHASES.TRANSFER) ? 'destinos' : phase;
    return `${phaseTag}${reportTag}${eventTag}`;
  }, [career, phase, seasonReport, currentEvent]);

  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    const node = topRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    let smooth = true;
    try { smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { smooth = true; }
    try { node.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }); }
    catch { node.scrollIntoView(); }
  }, [focusKey]);
  // ---------------------------------------------------------------------------
  // MERCADO DIRECTO (solo UI) — elimina el paso intermedio "Ver ofertas".
  // ---------------------------------------------------------------------------
  // Al llegar al checkpoint de decisión post-temporada el mercado se abre SOLO,
  // así el selector de destinos muestra de una vez TODAS las alternativas
  // (club actual + ofertas + retirarse) y la carrera se siente directa.
  //
  // No cambia NADA del motor/flow/persistencia/reglas: se dispara exactamente
  // la MISMA acción 'transfer' sin payload que antes disparaba el botón
  // eliminado (flow.js → generateTransferOffers, con el mismo RNG por defecto),
  // y el estado resultante (phase 'transfer' + transferOffers) es un estado ya
  // soportado por el flow y la persistencia.
  //
  // Guard por checkpoint: si el mercado no devuelve ofertas, la fase queda en
  // 'decision' y la UI muestra club actual + retirarse sin reintentar en loop.
  // ---------------------------------------------------------------------------
  const checkpointKey = useMemo(() => {
    if (!career || !state) return null;
    const careerTag = (career.snapshot && career.snapshot.createdAt) || career.playerId || 'career';
    const since = Number.isFinite(state.seasonsSinceDecision) ? state.seasonsSinceDecision : 0;
    return `${careerTag}-${career.season}-${since}`;
  }, [career, state]);

  useEffect(() => {
    if (phase !== FLOW_PHASES.DECISION) return;
    if (!state || !career || retirementDue) return;   // retiro obligatorio: única opción
    if (busyAction) return;                           // hay una acción en curso
    if (checkpointKey === null || marketRef.current === checkpointKey) return;
    marketRef.current = checkpointKey;
    chooseAction(FLOW_ACTIONS.TRANSFER);
  }, [phase, state, career, retirementDue, busyAction, checkpointKey, chooseAction]);

  if (!state || !career) {
    return (
      <div className="career-screen" ref={topRef}>
        <div className="career-shell">
          <CareerHeader career={career} phase={phase} onBack={onBack} onNavigate={onNavigate} />
          <CareerSetup
            onBack={onBack} onStart={handleStart} stoppedReason={stoppedReason}
            draftName={draftName} onDraftName={setDraftName} difficulty={difficulty}
            onDifficulty={setDifficulty} seedInput={seedInput} onSeedInput={setSeedInput}
            busy={busyAction === 'start'}
          />
        </div>
      </div>
    );
  }


  return (
    <div className="career-screen" ref={topRef}>
      <div className="career-shell career-shell--main">
        <CareerHeader career={career} phase={phase} onBack={onBack} onNavigate={onNavigate} />

        <div className="career-dashboard">
          <div className="career-primary">
            <CareerPlayerCard career={career} isRetired={isRetired} />
            <PhaseBody
              phase={phase} career={career} state={state} options={options}
              youthOffers={youthOffers} transferOffers={transferOffers}
              currentEvent={currentEvent} seasonReport={seasonReport}
              retirementDue={retirementDue} stoppedReason={stoppedReason}
              isRetired={isRetired} busyAction={busyAction} feedback={feedback}
              lastAction={lastAction}
              eventReceipt={eventReceipt} showEventReceipt={showEventReceipt}
              onEventChoose={handleEventChoose}
              onYouth={handleYouth}
              onAction={handleAction} onReset={handleReset}
            />
          </div>
          <aside className="career-secondary" aria-label="Trayectoria">
            <CareerTimeline career={career} phase={phase} />
          </aside>
        </div>
        <CareerFooter isRetired={isRetired} confirmReset={confirmReset} onAskReset={() => setConfirmReset(true)} onCancelReset={() => setConfirmReset(false)} onConfirmReset={handleReset} />
      </div>
      {/* Aviso temporal de títulos: overlay automático sobre el flujo actual;
          al desaparecer, el checkpoint de debajo queda tal cual. */}
      <CareerTrophyToast trophies={trophyToasts} onFinish={clearTrophyToasts} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zona dinámica: UN único panel de acción ("qué tengo que decidir AHORA").
// ---------------------------------------------------------------------------
// La columna izquierda NUNCA repite el resultado de temporada: ese historial
// vive en la TRAYECTORIA de la derecha (CareerTimeline ← seasonHistory).
// Por eso ya no se usa SeasonResultInline acá: la info sigue existiendo en
// el motor (seasonReport/seasonHistory), solo cambia dónde se presenta.
//
// El feedback "Temporada simulada." (advance_season) tampoco se muestra en
// checkpoints de evento/decisión/mercado: sería repetir la temporada recién
// jugada. En la fase SEASON (transitoria: la simula el hook sola) solo queda
// el aviso automático, sin ningún botón de avance manual.

function SeasonFeedback({ busy, feedback, lastAction, hideSeasonEcho = false }) {
  if (busy === 'advance_season') {
    return (
      <div className="career-flash career-flash--busy" role="status" aria-live="polite">
        <span className="career-flash-spinner" aria-hidden="true" />
        Simulando temporada…
      </div>
    );
  }
  if (!feedback) return null;
  // La izquierda no repite la temporada recién jugada: en checkpoints
  // posteriores a la simulación el eco "Temporada simulada." se oculta.
  // Los errores (tone warn) siempre se muestran.
  if (hideSeasonEcho && lastAction && lastAction.action === 'advance_season' && feedback.tone !== 'warn') return null;
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`${lastAction.action}-${lastAction.ok}-${lastAction.reason || ''}`}
        className={`career-flash${feedback.tone === 'warn' ? ' career-flash--warn' : ''}`}
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
      >
        {feedback.tone === 'warn' ? <AlertTriangle size={15} /> : <Check size={15} />}
        {feedback.text}
      </motion.p>
    </AnimatePresence>
  );
}

// Caja de resultado post-decisión de evento: compacta, con la narración
// completa (`choice.description`) que ANTES de elegir no se muestra.
// Solo presentación: los textos vienen del motor, sin modificarlos.
//
//   ✓ DECISIÓN TOMADA
//   Visualizar
//   Tres semanas de respiración y planchas...
//   (sin botón: convive con las opciones del checkpoint)
function EventChoiceResult({ choiceLabel, choiceNarrative }) {
  return (
    <motion.div
      className="career-choice-result"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <p className="career-choice-result-kicker"><Check size={14} /> Decisión tomada</p>
      {choiceLabel ? <p className="career-choice-result-label">{choiceLabel}</p> : null}
      {choiceNarrative ? <p className="career-choice-result-copy">{choiceNarrative}</p> : null}
    </motion.div>
  );
}

function RetiredPanel({ career, onReset, busy }) {
  const stats = (career && career.careerStats) || {};
  const achievements = career && Array.isArray(career.achievements) ? career.achievements : [];
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  const seasons = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  const stints = career && Array.isArray(career.clubHistory) ? career.clubHistory : [];
  const clubsCount = stints.length + (career && career.club ? 1 : 0);

  return (
    <section className="career-section career-section--accent">
      <div className="career-section-head">
        <span className="career-section-kicker"><Trophy size={14} /> Carrera terminada</span>
        <h2 className="career-section-title">{(career && career.name) || 'Jugador'}</h2>
      </div>
      <p className="career-phase-copy">
        Resumen completo: números, clubes, títulos y logros.
      </p>
      <div className="career-retired-grid">
        <div className="career-retired-cell"><span>Temporadas</span><b>{seasons.length}</b></div>
        <div className="career-retired-cell"><span>Clubes</span><b>{clubsCount || DASH}</b></div>
        <div className="career-retired-cell"><span>Goles</span><b>{Number.isFinite(stats.gls) ? stats.gls : DASH}</b></div>
        <div className="career-retired-cell"><span>Títulos</span><b>{trophies.length}</b></div>
      </div>
      {achievements.length > 0 ? (
        <ul className="career-retired-achievements">
          {achievements.map((achievement, index) => (
            <li key={`${(achievement && achievement.id) || 'logro'}-${index}`}>
              <Check size={14} />
              {(achievement && achievement.label) || (typeof achievement === 'string' ? achievement : 'Logro')}
            </li>
          ))}
        </ul>
      ) : (
        <p className="career-section-note">Sin logros registrados en esta carrera.</p>
      )}
      <button
        type="button"
        className="career-button career-button--primary career-button--block career-button--big"
        onClick={onReset}
        disabled={busy}
      >
        <RotateCcw size={16} /> Nueva carrera
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fases: qué se muestra en cada momento (nunca todo junto)
// ---------------------------------------------------------------------------

function PhaseBody({
  phase,
  career,
  state,
  options,
  youthOffers,
  transferOffers,
  currentEvent,
  seasonReport,
  retirementDue,
  stoppedReason,
  isRetired,
  busyAction,
  feedback,
  lastAction,
  eventReceipt,
  showEventReceipt,
  onEventChoose,
  onYouth,
  onAction,
  onReset,
}) {
  const isBusy = (key) => busyAction === key;
  let body = null;
  let panelTitle = phaseLabel(phase);
  let panelKind = 'action';
  let panelKicker = null;
  // La izquierda no repite la temporada: el eco "Temporada simulada." solo
  // tiene sentido en la fase donde se ejecutó la simulación (SEASON).
  const hideSeasonEcho = phase !== FLOW_PHASES.SEASON;

  if (phase === FLOW_PHASES.DEBUT) {
    panelTitle = 'Elegí tu club';
    panelKind = 'offers';
    body = youthOffers.length > 0
      ? <YouthOffers offers={youthOffers} onChoose={onYouth} busy={isBusy('choose_youth_club')} bare />
      : (
        <p className="career-section-note">
          El motor no generó ofertas para este jugador. Reiniciá la carrera para intentarlo otra vez.
        </p>
      );
  } else if (phase === FLOW_PHASES.SEASON) {
    panelTitle = `Temporada ${statText(career && career.season)}`;
    panelKind = 'action';
    // Transitoria: la temporada la simula el hook solo (sin botón de avance).
    body = (
      <div className="career-decision-body career-decision-body--tight">
        <div className="career-flash career-flash--busy" role="status" aria-live="polite">
          <span className="career-flash-spinner" aria-hidden="true" />
          Simulando temporada…
        </div>
      </div>
    );
  } else if (phase === FLOW_PHASES.EVENT) {
    // IZQUIERDA = qué decido AHORA. Sin bloque de temporada (vive en la
    // trayectoria) y sin título redundante "Evento de carrera": la categoría
    // del motor funciona como kicker y el título del evento es lo principal.
    const event = currentEvent && currentEvent.event ? currentEvent.event : null;
    const category = event ? (EVENT_CATEGORIES[event.category] || 'Evento de carrera') : null;
    panelTitle = event ? cleanText(event.title) || 'Evento de carrera' : 'Evento de carrera';
    panelKind = 'event';
    panelKicker = category ? cleanText(category) : null;
    body = (
      <CareerEvent currentEvent={currentEvent} onChoose={onEventChoose} busy={isBusy('choose_event_choice')} bare hideCategory />
    );
  } else if (phase === FLOW_PHASES.DECISION) {
    // Selector de destino: TODAS las alternativas a la vista (club actual +
    // ofertas del mercado + retiro). El mercado lo abre solo el efecto de la
    // pantalla, así que acá no hay paso intermedio "Ver ofertas".
    panelTitle = retirementDue ? 'Hora del retiro' : 'Elegí tu próximo destino';
    panelKind = 'decision';
    // Estado post-decisión: la narración completa de la opción elegida es
    // INFORMACIÓN que convive con el selector (sin "Continuar" de por medio).
    body = (
      <>
        {showEventReceipt ? (
          <EventChoiceResult
            choiceLabel={eventReceipt.choiceLabel}
            choiceNarrative={eventReceipt.choiceNarrative}
          />
        ) : null}
        <CareerDestinations
          career={career} offers={transferOffers} options={options}
          retirementDue={retirementDue}
          onStay={() => onAction(FLOW_ACTIONS.STAY)}
          onAccept={(offer) => onAction(FLOW_ACTIONS.TRANSFER, offer)}
          onRetire={() => onAction(FLOW_ACTIONS.RETIRE)}
          busy={busyAction} bare
        />
      </>
    );
  } else if (phase === FLOW_PHASES.TRANSFER) {
    // Mercado abierto (lo abre el efecto de la pantalla): el selector muestra el
    // club actual, TODAS las ofertas del estado y el retiro de una sola vez.
    // El recibo del evento (si lo hay) sigue visible arriba: es información.
    panelTitle = 'Elegí tu próximo destino';
    panelKind = 'decision';
    body = (
      <>
        {showEventReceipt ? (
          <EventChoiceResult
            choiceLabel={eventReceipt.choiceLabel}
            choiceNarrative={eventReceipt.choiceNarrative}
          />
        ) : null}
        <CareerDestinations
          career={career} offers={transferOffers} options={options}
          retirementDue={retirementDue}
          onStay={() => onAction(FLOW_ACTIONS.STAY)}
          onAccept={(offer) => onAction(FLOW_ACTIONS.TRANSFER, offer)}
          onRetire={() => onAction(FLOW_ACTIONS.RETIRE)}
          busy={busyAction} bare
        />
      </>
    );
  } else if (phase === FLOW_PHASES.RETIRED || isRetired) {
    panelTitle = 'Carrera terminada';
    panelKind = 'final';
    body = <RetiredPanel career={career} onReset={onReset} busy={isBusy('reset')} />;
  } else if (phase === FLOW_PHASES.STOPPED) {
    panelTitle = 'Estado detenido';
    panelKind = 'final';
    body = (
      <p className="career-section-note">
        {`Motivo: ${stoppedReason || 'desconocido'}. Reiniciá la carrera para volver a jugar.`}
      </p>
    );
  }

  // Clave de animación: "decisión" y "mercado abierto" son la MISMA vista (el
  // selector de destino), así abrir el mercado no vuelve a animar el panel: solo
  // entran las miniaturas de las ofertas y el recibo del evento (si existe),
  // que aparece como información junto a los destinos.
  const bodyKey = phase === FLOW_PHASES.DECISION || phase === FLOW_PHASES.TRANSFER
    ? 'destinos'
    : `${phase}-${currentEvent ? 'evento' : 'base'}`;

  return (
    <section className="career-decision-panel" aria-label={`Acción actual: ${panelTitle}`}>
      <div className="career-decision-head">
        <span className="career-decision-tag">
          {panelKind === 'final' ? 'RESUMEN' : panelKind === 'offers' ? 'DEBUT' : 'ACCIÓN'}
        </span>
        {panelKicker ? <span className="career-decision-kicker">{panelKicker}</span> : null}
        <h2 className="career-decision-title career-decision-title--clamp">{panelTitle}</h2>
      </div>
      <SeasonFeedback busy={busyAction} feedback={feedback} lastAction={lastAction} hideSeasonEcho={hideSeasonEcho} />
      <AnimatePresence mode="wait">
        <motion.div
          className="career-phase"
          key={bodyKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer con el reinicio en dos pasos
// ---------------------------------------------------------------------------

function CareerFooter({ isRetired, confirmReset, onAskReset, onCancelReset, onConfirmReset }) {
  return (
    <footer className="career-footer">
      <span>
        {isRetired
          ? 'Carrera cerrada. El resumen queda guardado hasta que reinicies.'
          : 'Tu carrera se guarda automáticamente en este dispositivo.'}
      </span>
      <div className="career-footer-tools">
        {confirmReset ? (
          <div className="career-reset-confirm">
            <span>¿Borrar la carrera guardada?</span>
            <button type="button" className="career-button career-button--danger" onClick={onConfirmReset}>
              Sí, borrar
            </button>
            <button type="button" className="career-button career-button--ghost" onClick={onCancelReset}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="career-button career-button--ghost" onClick={onAskReset}>
            <RotateCcw size={15} /> Reiniciar carrera
          </button>
        )}
      </div>
    </footer>
  );
}
