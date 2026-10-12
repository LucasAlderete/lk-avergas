// ============================================================================
// CAREER EVENT — evento interactivo del checkpoint
// ============================================================================
// Muestra el evento que rodó events.js (`currentEvent.event`, ya interpolado).
//
// Presentación (izquierda = "qué decido AHORA"):
// - La categoría NO se duplica acá cuando el panel ya la muestra como kicker
//   (`hideCategory`): solo se conserva el rival como contexto.
// - La intro se recorta por CSS a ~3 líneas (no se tocan los textos del motor).
// - Cada opción es compacta ANTES de elegir: nombre + una fila por resultado
//   posible (verde/gris/rojo, qué pasa y su %). La narración larga
//   (`choice.description`) NO se muestra acá: aparece DESPUÉS de elegir, en
//   la caja de resultado que monta la pantalla.
// Cada opción dispara `chooseAction('choose_event_choice', choice.id)`:
// el efecto real lo aplica events.js/engine.js, nunca este componente.
//
// Cada opción muestra sus probabilidades de OVR (choiceOdds), como Copero:
// el jugador apuesta sabiendo el riesgo. Con `spin` la opción elegida gira la
// ruleta sobre sus resultados y las demás quedan apagadas.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { EVENT_CATEGORIES, choiceOdds } from '../events.js';
import { cleanText } from './careerFormat.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/** "+1 a +2 OVR", "-1 OVR" o "Sin cambios" para una fila de choiceOdds. */
function oddsLabel(row) {
  if (row.tone === 'same') return 'Sin cambios';
  const [a, b] = row.tone === 'up' ? [row.from, row.to] : [row.to, row.from];
  return a === b ? `${signed(a)} OVR` : `${signed(a)} a ${signed(b)} OVR`;
}

// Texto corto de qué pasa en cada resultado (estilo Copero). El evento puede
// traerlo en `choice.outcomes = { up, same, down }`; si no, va uno genérico.
const DEFAULT_OUTCOMES = { up: 'Te sale bien', same: 'No pasa nada', down: 'Te sale mal' };
const ODD_ICONS = { up: '↗', same: '→', down: '↘' };

function outcomeText(choice, row) {
  // Traspaso: no mueve el OVR, la fila dice a dónde te vas ("Traspaso a X").
  const pill = choice && choice.isTransfer && Array.isArray(choice.pills) && choice.pills[0];
  if (pill && row.tone === 'same') return cleanText(pill.label);
  const custom = choice && choice.outcomes && cleanText(choice.outcomes[row.tone]);
  const reason = custom || DEFAULT_OUTCOMES[row.tone];
  return row.tone === 'same' ? reason : `${oddsLabel(row)} · ${reason}`;
}

// Ruleta (como Copero): al elegir, el resaltado recorre los resultados de la
// opción, frena de a poco y se clava en el que de verdad salió (`tone`, que
// llega del motor). Al terminar avisa con onDone para que arranque la temporada.
function useRoulette(rows, spin) {
  const [lit, setLit] = useState(null);
  const [won, setWon] = useState(false);
  const doneRef = useRef(spin && spin.onDone);
  doneRef.current = spin && spin.onDone;
  const tone = spin ? spin.tone : null;
  const active = Boolean(spin);
  useEffect(() => {
    if (!active || !tone) return undefined;
    const tones = rows.map((r) => r.tone);
    const target = Math.max(0, tones.indexOf(tone));
    const steps = tones.length > 1 ? tones.length * 3 + target : 0;
    let i = 0;
    let timer = 0;
    const finish = () => {
      setLit(tones[target]);
      setWon(true);
      timer = window.setTimeout(() => doneRef.current && doneRef.current(), 900);
    };
    const step = () => {
      if (i >= steps) { finish(); return; }
      setLit(tones[i % tones.length]);
      i += 1;
      timer = window.setTimeout(step, 70 + (i / Math.max(1, steps)) ** 2 * 260);
    };
    setWon(false);
    step();
    return () => window.clearTimeout(timer);
    // rows es estable mientras dura el giro (evento congelado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tone]);
  return { lit, won };
}

function ChoiceOdds({ choice, spin }) {
  const rows = choiceOdds(choice);
  const { lit, won } = useRoulette(rows, spin);
  return (
    <span className="career-choice-odds">
      {rows.map((row) => {
        const state = lit === row.tone ? (won ? ' is-win' : ' is-lit') : (won ? ' is-lose' : '');
        return (
          <span key={row.tone} className={`career-odd is-${row.tone}${state}`}>
            <span className="career-odd-icon" aria-hidden="true">{ODD_ICONS[row.tone]}</span>
            <span className="career-odd-text">{outcomeText(choice, row)}</span>
            <span className="career-odd-pct">{row.pct}%</span>
          </span>
        );
      })}
    </span>
  );
}

export default function CareerEvent({ currentEvent, onChoose, busy, bare = false, hideCategory = false, spin = null }) {
  const event = currentEvent && currentEvent.event;
  if (!event) return null;

  const choices = Array.isArray(event.choices) ? event.choices : [];
  const category = EVENT_CATEGORIES[event.category] || 'Evento de carrera';
  const rival = currentEvent.context && currentEvent.context.rival;
  const inner = (
    <>
      {hideCategory ? (
        rival && rival.name ? <p className="career-event-kicker"><span className="career-event-rival">{cleanText(rival.name)}</span></p> : null
      ) : (
        <p className="career-event-kicker">
          <span className="career-event-pill">{cleanText(category)}</span>
          {rival && rival.name ? <span className="career-event-rival">{cleanText(rival.name)}</span> : null}
        </p>
      )}
      {!hideCategory ? <h3 className="career-event-title">{cleanText(event.title)}</h3> : null}

      <p className="career-event-copy">{cleanText(event.intro)}</p>

      <div className="career-choices career-choices--grid">
        {choices.map((choice, index) => {
          const picked = spin && spin.choiceId === choice.id;
          const pickClass = spin ? (picked ? ' is-picked' : ' is-dimmed') : '';
          return (
            <motion.button
              type="button"
              className={`career-choice career-choice--compact${pickClass}`}
              key={choice.id || `opcion-${index}`}
              onClick={() => onChoose(choice.id)}
              disabled={Boolean(busy) || Boolean(spin)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.09) }}
            >
              <span className="career-choice-label">{cleanText(choice.label)}</span>
              <ChoiceOdds choice={choice} spin={picked ? spin : null} />
            </motion.button>
          );
        })}
      </div>
    </>
  );
  if (bare) return inner;
  return (
    <motion.section
      className="career-section career-section--accent career-section--compact"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="career-section-head career-section-head--tight">
        <span className="career-section-kicker">Evento · {cleanText(category)}</span>
      </div>
      {inner}
    </motion.section>
  );
}