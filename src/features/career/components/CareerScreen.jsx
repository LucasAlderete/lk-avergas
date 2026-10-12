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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';

import { players } from '../../../data';
import { useCareer } from '../useCareer';
import { FLOW_ACTIONS, FLOW_PHASES } from '../flow.js';
import CareerDestinations from './CareerDestinations';
import CareerEvent from './CareerEvent';
import CareerHeader from './CareerHeader';
import CareerPlayerCard from './CareerPlayerCard';
import CareerSetup from './CareerSetup';
import CareerShareCard from './CareerShareCard';
import CareerTimeline from './CareerTimeline';
import CareerTrophyShelf from './CareerTrophyShelf';
import useSeasonReveal from './useSeasonReveal';
import CareerTrophyToast from './CareerTrophyToast';
import YouthOffers from './YouthOffers';
import { DASH, cleanText, feedbackOf, phaseLabel, statText } from './careerFormat.js';
import './careerScreen.css';

// Toda la pantalla respeta "reducir movimiento": Motion deja solo los fundidos.
export default function CareerScreen(props) {
  return (
    <MotionConfig reducedMotion="user">
      <CareerScreenBody {...props} />
    </MotionConfig>
  );
}

function CareerScreenBody({ onBack, onNavigate }) {
  const careerHook = useCareer();
  const {
    state, phase, career, youthOffers, transferOffers, currentEvent,
    seasonReport, lastAction, stoppedReason, retirementDue,
    decisionOptions, isRetired, start, chooseYouthClubAndStart,
    chooseAction, reset, trophyToasts, clearTrophyToasts,
  } = careerHook;

  const [draftName, setDraftName] = useState(() => (players[0] ? players[0].name : ''));
  // Identidad elegida en el setup: null = posición sugerida por atributos.
  const [draftPosition, setDraftPosition] = useState(null);
  const [draftNationality, setDraftNationality] = useState('AR');
  const [draftNumber, setDraftNumber] = useState('10');
  const [difficulty, setDifficulty] = useState('normal');
  const [busyAction, setBusyAction] = useState(null);
  // Recibo post-decisión de evento (solo presentación): guarda la narración
  // completa de la opción elegida para mostrarla junto a las opciones del
  // checkpoint siguiente, cuando el motor ya cerró el evento (currentEvent
  // === null). Es INFORMACIÓN, no un paso de confirmación: no tiene botón y
  // se descarta recién cuando se toma una decisión (handleAction).
  const [eventReceipt, setEventReceipt] = useState(null);
  // Panel congelado (como Copero): al elegir, las opciones quedan a la vista
  // con la elegida resaltada mientras se simula, y recién se reemplazan cuando
  // aparecen las del checkpoint siguiente. En eventos además gira la ruleta
  // (`spin`) y la temporada espera a que frene.
  //   { view: props de PhaseBody, selectedKey, spin: { eventId, choiceId, careerBefore, tone, done } | null }
  const [frozen, setFrozen] = useState(null);
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
    // Semilla al azar por carrera: con una fija, todas las partidas del mismo
    // jugador salían iguales. La semilla igual queda guardada en la partida.
    const seed = Math.floor(Math.random() * 2 ** 31);
    marketRef.current = null; // carrera nueva: checkpoints nuevos
    setEventReceipt(null);
    setFrozen(null);
    const number = Math.round(Number(draftNumber));
    const options = { seed, difficulty, nationality: draftNationality };
    if (Number.isInteger(number) && number >= 1 && number <= 99) options.shirtNumber = number;
    if (draftPosition) options.position = draftPosition;
    start(draftPlayer, options);
    window.setTimeout(() => setBusyAction(null), 600);
  };
  const freezeView = (selectedKey, spin = null) => {
    setFrozen({
      view: { phase, career, state, options, youthOffers, transferOffers, currentEvent, seasonReport, retirementDue, stoppedReason, isRetired, lastAction },
      selectedKey,
      spin,
    });
  };
  const handleAction = (action, payload = null) => {
    // Cualquier acción distinta de la elección de evento invalida el recibo
    // post-decisión (solo presentación): evita mostrar narraciones viejas.
    if (action !== 'choose_event_choice') setEventReceipt(null);
    runAction(String(action), () => chooseAction(action, payload));
  };
  const handleYouth = (offer) => {
    if (busyAction) return;
    freezeView((offer && offer.id) || null);
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
    if (chosen && !busyAction) {
      freezeView(chosen.id, { eventId: event.id || null, choiceId: chosen.id, careerBefore: career, tone: null, done: false });
    }
    handleAction('choose_event_choice', choiceId);
  };
  // Destinos: se congela la miniatura elegida antes de resolver.
  const handleDestination = (action, payload = null) => {
    if (busyAction) return;
    const key = action === FLOW_ACTIONS.STAY ? 'stay'
      : action === FLOW_ACTIONS.RETIRE ? 'retire'
      : ((payload && payload.id) || null);
    freezeView(key);
    handleAction(action, payload);
  };
  const handleReset = () => { setEventReceipt(null); setFrozen(null); marketRef.current = null; reset(); };

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
  // Avance de temporadas de a una (como Copero): presentación sobre `career`.
  const spin = frozen && frozen.spin ? frozen.spin : null;
  const spinning = Boolean(spin && !spin.done);
  // Resultado real del evento (lo dejó el motor en lastDecision): la ruleta se
  // clava ahí. Mientras gira, la tabla sigue mostrando la carrera de antes.
  const lastDecision = career && career.lastDecision;
  const spinTone = spin && lastDecision && lastDecision.eventId === spin.eventId && lastDecision.choiceId === spin.choiceId
    && lastDecision.season === (spin.careerBefore && spin.careerBefore.season)
    ? (lastDecision.ovrDelta > 0 ? 'up' : lastDecision.ovrDelta < 0 ? 'down' : 'same')
    : null;
  const handleSpinDone = useCallback(() => {
    setFrozen((prev) => (prev && prev.spin ? { ...prev, spin: { ...prev.spin, done: true } } : prev));
  }, []);
  // Seguro: si el motor no dejó resultado (acción rechazada), no se traba.
  useEffect(() => {
    if (!spinning || spinTone) return undefined;
    const timer = window.setTimeout(handleSpinDone, 1500);
    return () => window.clearTimeout(timer);
  }, [spinning, spinTone, handleSpinDone]);
  const { revealing: revealingSeasons, skip: skipReveal, displayCareer } = useSeasonReveal(spinning ? spin.careerBefore : career);
  const revealing = revealingSeasons || spinning;

  // Títulos: el aviso sale cuando la reproducción LLEGA a la temporada en que
  // se ganó, no apenas el motor la simula. Se van marcando los ya mostrados y
  // la cola del hook se vacía recién cuando no queda ninguno pendiente.
  const trophyKey = (t) => `${t && t.season}-${t && t.type}-${t && t.label}`;
  const [shownTrophies, setShownTrophies] = useState(() => new Set());
  const visibleTrophies = (trophyToasts || []).filter((t) => (
    !shownTrophies.has(trophyKey(t))
    && (!revealing || !Number.isFinite(t && t.season) || t.season < displayCareer.season)
  ));
  // Callback estable: el overlay reinicia su temporizador si cambia onFinish,
  // y la pantalla se redibuja en cada temporada revelada.
  const visibleRef = useRef(visibleTrophies);
  visibleRef.current = visibleTrophies;
  const handleTrophiesShown = useCallback(() => {
    setShownTrophies((prev) => new Set([...prev, ...visibleRef.current.map(trophyKey)]));
  }, []);
  useEffect(() => {
    const queue = trophyToasts || [];
    if (revealing || queue.length === 0) return;
    if (queue.every((t) => shownTrophies.has(trophyKey(t)))) {
      clearTrophyToasts();
      setShownTrophies(new Set());
    }
  }, [revealing, trophyToasts, shownTrophies, clearTrophyToasts]);

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
    if (revealing) return;                            // todavía se están mostrando temporadas
    if (checkpointKey === null || marketRef.current === checkpointKey) return;
    marketRef.current = checkpointKey;
    chooseAction(FLOW_ACTIONS.TRANSFER);
  }, [phase, state, career, retirementDue, busyAction, revealing, checkpointKey, chooseAction]);

  // Se suelta el panel congelado cuando ya hay opciones nuevas para mostrar:
  // terminó la ruleta y la reproducción, no hay acción en curso y el mercado
  // (que se abre solo en 'decision') ya se pidió.
  const marketPending = phase === FLOW_PHASES.DECISION && !retirementDue && checkpointKey !== null && marketRef.current !== checkpointKey;
  useEffect(() => {
    if (!frozen || revealing || busyAction) return;
    if (phase === FLOW_PHASES.SEASON || marketPending) return;
    setFrozen(null);
  }, [frozen, revealing, busyAction, phase, marketPending]);

  // Mientras se reproduce el tramo las opciones desaparecen; se reserva su alto
  // para que la pantalla no salte (y la tabla no cambie de lugar) y al terminar
  // las opciones vuelvan al mismo sitio.
  const actionRef = useRef(null);
  const heldActionH = useRef(0);
  useLayoutEffect(() => {
    const el = actionRef.current;
    if (!el) return;
    if (revealing) {
      el.style.minHeight = heldActionH.current ? `${heldActionH.current}px` : '';
    } else {
      el.style.minHeight = '';
      heldActionH.current = el.offsetHeight;
    }
  });

  if (!state || !career) {
    return (
      <div className="career-screen" ref={topRef}>
        <div className="career-shell">
          <CareerHeader career={career} phase={phase} onBack={onBack} onNavigate={onNavigate} />
          <CareerSetup
            onBack={onBack} onStart={handleStart} stoppedReason={stoppedReason}
            draftName={draftName} onDraftName={setDraftName} difficulty={difficulty}
            onDifficulty={setDifficulty}
            position={draftPosition}
            onPosition={setDraftPosition}
            nationality={draftNationality}
            onNationality={setDraftNationality}
            shirtNumber={draftNumber}
            onShirtNumber={setDraftNumber}
            busy={busyAction === 'start'}
          />
        </div>
      </div>
    );
  }


  return (
    <div className="career-screen" ref={topRef}>
      <div className="career-shell career-shell--main">
        <CareerHeader career={displayCareer} phase={phase} onBack={onBack} onNavigate={onNavigate} />

        <div className="career-dashboard career-dashboard--single">
          <div className="career-primary">
            <div className="career-col career-col--history">
            <CareerPlayerCard career={displayCareer} isRetired={isRetired && !revealing} />
            {/* Pantalla única: en el celular la decisión va pegada a la carta y
                la trayectoria abajo (orden por CSS); en escritorio, al costado. */}
            <CareerTimeline career={displayCareer} phase={phase} />
            {revealingSeasons ? (
              <button type="button" className="career-skip" onClick={skipReveal}>
                Saltar al final del tramo
              </button>
            ) : null}
            <CareerTrophyShelf career={displayCareer} />
            </div>
            <div className="career-col career-col--action" ref={actionRef}>
            {/* Mientras se reproduce el tramo, la tabla es la protagonista: la
                decisión aparece recién al terminar (sin tarjeta intermedia). */}
            {frozen ? (
            <PhaseBody
              {...frozen.view}
              busyAction={null} feedback={null}
              eventReceipt={eventReceipt} showEventReceipt={false}
              selectedKey={frozen.selectedKey}
              spin={frozen.spin ? { choiceId: frozen.spin.choiceId, tone: spinTone, onDone: handleSpinDone } : null}
              onEventChoose={() => {}} onYouth={() => {}} onAction={() => {}} onReset={() => {}}
            />
            ) : revealing ? null : (
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
              onAction={handleDestination} onReset={handleReset}
            />
            )}
            </div>
          </div>
        </div>
        <CareerFooter isRetired={isRetired} onReset={handleReset} />
      </div>
      {/* Aviso temporal de títulos: overlay automático sobre el flujo actual;
          al desaparecer, el checkpoint de debajo queda tal cual. */}
      <CareerTrophyToast trophies={visibleTrophies} onFinish={handleTrophiesShown} />
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
// El relato que se muestra es el del resultado real (sube/baja/igual) que dejó
// el motor en lastDecision; si no coincide con el recibo, el texto de la opción.
function receiptDecision(receipt, career) {
  const last = career && career.lastDecision;
  return last && last.eventId === receipt.eventId && last.choiceId === receipt.choiceId ? last : null;
}

function receiptNarrative(receipt, career) {
  const last = receiptDecision(receipt, career);
  if (last && last.narrative) return cleanText(last.narrative);
  return receipt.choiceNarrative;
}

/** Lo que te dejó la decisión, en una línea: "+3 OVR · 2 fechas afuera". */
function receiptOutcome(receipt, career) {
  const last = receiptDecision(receipt, career);
  if (!last) return null;
  const parts = [];
  if (Number.isFinite(last.ovrDelta)) {
    parts.push(last.ovrDelta > 0 ? `+${last.ovrDelta} OVR` : last.ovrDelta < 0 ? `−${Math.abs(last.ovrDelta)} OVR` : 'OVR igual');
  }
  if (last.suspension > 0) parts.push(`${last.suspension} ${last.suspension === 1 ? 'temporada' : 'temporadas'} suspendido`);
  if (last.transfer && last.transfer.targetClub && last.transfer.targetClub.name) parts.push(`${last.transfer.targetClub.name} te espera en el mercado`);
  const tone = last.ovrDelta > 0 ? 'up' : last.ovrDelta < 0 ? 'down' : 'same';
  return parts.length > 0 ? { text: parts.join(' · '), tone } : null;
}

function EventChoiceResult({ choiceLabel, choiceNarrative, outcome }) {
  return (
    <motion.div
      className="career-choice-result"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {choiceLabel ? <p className="career-choice-result-label"><Check size={15} aria-hidden="true" /> {choiceLabel}</p> : null}
      {choiceNarrative ? <p className="career-choice-result-copy">{choiceNarrative}</p> : null}
      {outcome ? <p className={`career-choice-result-outcome is-${outcome.tone}`}>{outcome.text}</p> : null}
    </motion.div>
  );
}

function RetiredPanel({ career }) {
  const stats = (career && career.careerStats) || {};
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  const seasons = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  const stints = career && Array.isArray(career.clubHistory) ? career.clubHistory : [];
  // clubHistory ya incluye el club actual; una vuelta al mismo club no suma.
  const clubsCount = new Set(stints.map((stint) => {
    const club = stint && stint.club;
    return club ? (club.slug || club.key || club.name) : null;
  }).filter(Boolean)).size;

  // El título del panel ("Carrera terminada") y la carta del jugador ya dicen
  // quién y qué: acá va directo el resumen.
  return (
    <section className="career-section career-section--accent">
      <CareerShareCard career={career} />
      <div className="career-retired-grid">
        <div className="career-retired-cell"><span>Temporadas</span><b>{seasons.length}</b></div>
        <div className="career-retired-cell"><span>Clubes</span><b>{clubsCount || DASH}</b></div>
        <div className="career-retired-cell"><span>Goles</span><b>{Number.isFinite(stats.gls) ? stats.gls : DASH}</b></div>
        <div className="career-retired-cell"><span>Títulos</span><b>{trophies.length}</b></div>
      </div>
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
  selectedKey = null,
  spin = null,
}) {
  const isBusy = (key) => busyAction === key;
  let body = null;
  let panelTitle = phaseLabel(phase);
  let panelKind = 'action';
  // La izquierda no repite la temporada: el eco "Temporada simulada." solo
  // tiene sentido en la fase donde se ejecutó la simulación (SEASON).
  const hideSeasonEcho = phase !== FLOW_PHASES.SEASON;

  if (phase === FLOW_PHASES.DEBUT) {
    panelTitle = 'Elegí tu club';
    panelKind = 'offers';
    body = youthOffers.length > 0
      ? <YouthOffers offers={youthOffers} onChoose={onYouth} busy={isBusy('choose_youth_club')} bare selectedKey={selectedKey} />
      : (
        <p className="career-section-note">
          Ningún club te vino a buscar esta vez. Tocá «Volver a jugar» para intentarlo de nuevo.
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
    // Qué decido AHORA: solo el título del evento y su descripción (la
    // categoría interna del motor no se muestra).
    const event = currentEvent && currentEvent.event ? currentEvent.event : null;
    panelTitle = event ? cleanText(event.title) || 'Evento de carrera' : 'Evento de carrera';
    panelKind = 'event';
    body = (
      <CareerEvent currentEvent={currentEvent} onChoose={onEventChoose} busy={isBusy('choose_event_choice')} bare hideCategory spin={spin} />
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
            choiceNarrative={receiptNarrative(eventReceipt, career)}
            outcome={receiptOutcome(eventReceipt, career)}
          />
        ) : null}
        <CareerDestinations
          career={career} offers={transferOffers} options={options}
          retirementDue={retirementDue}
          onStay={() => onAction(FLOW_ACTIONS.STAY)}
          onAccept={(offer) => onAction(FLOW_ACTIONS.TRANSFER, offer)}
          onRetire={() => onAction(FLOW_ACTIONS.RETIRE)}
          busy={busyAction} bare selectedKey={selectedKey}
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
            choiceNarrative={receiptNarrative(eventReceipt, career)}
            outcome={receiptOutcome(eventReceipt, career)}
          />
        ) : null}
        <CareerDestinations
          career={career} offers={transferOffers} options={options}
          retirementDue={retirementDue}
          onStay={() => onAction(FLOW_ACTIONS.STAY)}
          onAccept={(offer) => onAction(FLOW_ACTIONS.TRANSFER, offer)}
          onRetire={() => onAction(FLOW_ACTIONS.RETIRE)}
          busy={busyAction} bare selectedKey={selectedKey}
        />
      </>
    );
  } else if (phase === FLOW_PHASES.RETIRED || isRetired) {
    panelTitle = 'Carrera terminada';
    panelKind = 'final';
    body = <RetiredPanel career={career} />;
  } else if (phase === FLOW_PHASES.STOPPED) {
    panelTitle = 'La carrera se trabó';
    panelKind = 'final';
    body = (
      <p className="career-section-note">
        {stoppedReason === 'invalid_player'
          ? 'No pudimos armar la carrera con este jugador. Tocá «Volver a jugar» y probá con otro.'
          : 'Algo se rompió en el camino. Tocá «Volver a jugar» para arrancar otra.'}
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
        {/* Sin etiquetas de tipo de panel ("ACCIÓN"/"DEBUT") ni categoría
            interna del evento ("Preparación"): solo título y descripción. */}
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
// Footer con el reinicio. Con la carrera en juego pide un segundo toque (se
// pierde todo); ya retirado va directo.
// ---------------------------------------------------------------------------

function CareerFooter({ isRetired, onReset }) {
  const [armed, setArmed] = useState(false);
  // Se desarma sola: en el celular el botón no siempre recibe foco (ni blur).
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const handleClick = () => {
    if (isRetired || armed) {
      setArmed(false);
      onReset();
      return;
    }
    setArmed(true);
  };
  return (
    <footer className="career-footer">
      <span aria-live="polite">
        {armed
          ? 'Se pierde esta carrera. Tocá de nuevo para empezar otra.'
          : isRetired
            ? 'Carrera cerrada. El resumen queda hasta que vuelvas a jugar.'
            : null}
      </span>
      <div className="career-footer-tools">
        <button
          type="button"
          className={`career-button career-button--ghost${armed ? ' is-armed' : ''}`}
          onClick={handleClick}
          onBlur={() => setArmed(false)}
        >
          <RotateCcw size={15} /> {armed ? 'Sí, empezar de nuevo' : 'Volver a jugar'}
        </button>
      </div>
    </footer>
  );
}
