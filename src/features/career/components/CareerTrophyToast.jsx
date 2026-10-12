// ============================================================================
// CAREER TROPHY TOAST — aviso temporal de título (overlay del Career Mode)
// ============================================================================
// Celebración breve cuando el engine registra un título (career.trophies):
//
// - aparece SOLO como capa visual sobre el estado actual: no agrega fases ni
//   estados al flow.js, no bloquea el checkpoint que queda debajo
//   (pointer-events: none) y no requiere ningún click;
// - como Copero: sin tarjeta, la copa aparece con un destello y se desvanece,
//   con el título y el club/temporada debajo;
// - cada aviso dura ~2.7s (2.4s visibles + animaciones) y desaparece solo;
// - los títulos de una misma temporada salen JUNTOS (doblete/triplete);
//   temporadas distintas se encadenan de a una;
// - al agotarse la cola llama onFinish (useCareer limpia la cola) y el Career
//   Mode continúa exactamente donde estaba.
//
// La cola ya viene detectada por useCareer (career.trophies −
// celebratedTrophyIds): acá NO se calcula ni se persiste nada.
// ============================================================================

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import TrophyArt from './TrophyArt.jsx';

/** Milisegundos visibles de cada título antes de animar la salida. */
const VISIBLE_MS = 2400;
/** Segundos de la animación de salida (y de la pausa entre títulos). */
const EXIT_S = 0.3;

/**
 * Overlay temporal de títulos. Sin botones y sin interacción: solo muestra,
 * encadena y avisa al terminar.
 *
 * @param {Array<object>} trophies cola de títulos a mostrar (una sola vez c/u)
 * @param {() => void} [onFinish] se invoca cuando la cola terminó de mostrarse
 */
/** Agrupa la cola por temporada: lo ganado en una misma temporada sale junto. */
function groupBySeason(list) {
  const groups = [];
  for (const trophy of list) {
    const last = groups[groups.length - 1];
    if (last && last[0].season === trophy.season) last.push(trophy);
    else groups.push([trophy]);
  }
  return groups;
}

export default function CareerTrophyToast({ trophies, onFinish }) {
  const list = Array.isArray(trophies) ? trophies.filter(Boolean) : [];
  const groups = groupBySeason(list);
  const [index, setIndex] = useState(0);
  const current = index < groups.length ? groups[index] : null;

  useEffect(() => {
    if (current) {
      // Un poco más de tiempo si hay varias copas para que se vean todas.
      const timer = window.setTimeout(() => setIndex((i) => i + 1), VISIBLE_MS + (current.length - 1) * 400);
      return () => window.clearTimeout(timer);
    }
    // Cola agotada: deja terminar la salida del último aviso y avisa al padre
    // (clearTrophyToasts es idempotente). Sin onFinish el índice ya quedó
    // fuera del rango, así que el overlay sigue oculto igual.
    if (groups.length > 0) {
      const timer = window.setTimeout(() => {
        if (typeof onFinish === 'function') onFinish();
      }, Math.round(EXIT_S * 1000) + 40);
      return () => window.clearTimeout(timer);
    }
    if (index !== 0) setIndex(0); // la cola se vació: re-listo para la próxima
    return undefined;
  }, [current, index, groups.length, onFinish]);

  if (!current) return null;

  const labels = current.map((t) => (t.label && String(t.label)) || 'Título');
  const clubs = [...new Set(current.map((t) => t.clubName).filter(Boolean).map(String))];
  const season = Number.isFinite(current[0].season) ? current[0].season : null;
  const meta = [clubs.join(' · '), season !== null ? `Temporada ${season}` : '']
    .filter(Boolean)
    .join(' · ');
  const ease = [0.23, 1, 0.32, 1];
  const kicker = current.length === 3 ? '¡Triplete!' : current.length === 2 ? '¡Doblete!' : null;

  // Como Copero: sin tarjeta. Fondo oscuro, las copas entran de a una con
  // rebote, un destello blanco-dorado estalla detrás y todo se desvanece.
  return (
    <div className="career-trophy-toast" role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${season}`}
          className="career-trophy-toast__stage"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: 'blur(4px)' }}
          transition={{ duration: EXIT_S, ease: 'easeIn' }}
        >
          <motion.span
            className="career-trophy-toast__flash"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 1, 0.35], scale: [0.2, 1.15, 1] }}
            transition={{ duration: 0.7, ease, times: [0, 0.35, 1] }}
          />
          <motion.span
            className="career-trophy-toast__rays"
            aria-hidden="true"
            initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 40, scale: 1 }}
            transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.5, ease }, rotate: { duration: VISIBLE_MS / 1000, ease: 'linear' } }}
          />
          <span className="career-trophy-toast__cups">
            {current.map((trophy, i) => (
              <motion.span
                key={`${trophy.trophyId || trophy.type}-${i}`}
                className={`career-trophy-toast__cup${current.length > 1 ? ' is-many' : ''}`}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.3, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14, mass: 0.8, delay: i * 0.18 }}
              >
                <TrophyArt trophy={trophy} />
              </motion.span>
            ))}
          </span>
          {kicker ? (
            <motion.p
              className="career-trophy-toast__kicker"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + current.length * 0.18, duration: 0.25, ease }}
            >
              {kicker}
            </motion.p>
          ) : null}
          <motion.p
            className="career-trophy-toast__label"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.25, ease }}
          >
            {labels.join(' · ')}
          </motion.p>
          {meta ? (
            <motion.p
              className="career-trophy-toast__meta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.25 }}
            >
              {meta}
            </motion.p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
