// ============================================================================
// CAREER EVENT — evento interactivo del checkpoint
// ============================================================================
// Muestra el evento que rodó events.js (`currentEvent.event`, ya interpolado).
//
// Presentación (izquierda = "qué decido AHORA"):
// - La categoría NO se duplica acá cuando el panel ya la muestra como kicker
//   (`hideCategory`): solo se conserva el rival como contexto.
// - La intro se recorta por CSS a ~3 líneas (no se tocan los textos del motor).
// - Cada opción es compacta ANTES de elegir: nombre + línea meta con los
//   labels de sus pills ("Enfoque · +0 a +2 OVR"). La narración larga
//   (`choice.description`) NO se muestra acá: aparece DESPUÉS de elegir, en
//   la caja de resultado que monta la pantalla.
// Cada opción dispara `chooseAction('choose_event_choice', choice.id)`:
// el efecto real lo aplica events.js/engine.js, nunca este componente.
//
// Los textos del catálogo de eventos llegan con mojibake desde events.js (bytes
// UTF-8 leídos como Windows-1252): se reparan con cleanText SOLO para mostrar.
// ============================================================================

import { motion } from 'framer-motion';

import { EVENT_CATEGORIES } from '../events.js';
import { cleanText } from './careerFormat.js';

/** Línea meta compacta pre-elección: "Enfoque · +0 a +2 OVR" (o null). */
function choiceMeta(choice) {
  const pills = Array.isArray(choice && choice.pills) ? choice.pills : [];
  const labels = pills
    .map((pill) => cleanText(pill && pill.label))
    .filter((label) => typeof label === 'string' && label.trim() !== '');
  return labels.length > 0 ? labels.join(' · ') : null;
}

export default function CareerEvent({ currentEvent, onChoose, busy, bare = false, hideCategory = false }) {
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
          const meta = choiceMeta(choice);
          return (
            <motion.button
              type="button"
              className="career-choice career-choice--compact"
              key={choice.id || `opcion-${index}`}
              onClick={() => onChoose(choice.id)}
              disabled={Boolean(busy)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.09) }}
            >
              <span className="career-choice-label">{cleanText(choice.label)}</span>
              {meta ? <span className="career-choice-hint">{meta}</span> : null}
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