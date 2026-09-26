// ============================================================================
// CAREER TROPHY TOAST — aviso temporal de título (overlay del Career Mode)
// ============================================================================
// Celebración breve cuando el engine registra un título (career.trophies):
//
// - aparece SOLO como capa visual sobre el estado actual: no agrega fases ni
//   estados al flow.js, no bloquea el checkpoint que queda debajo
//   (pointer-events: none) y no requiere ningún click;
// - muestra un trofeo grande, el título ganado y el club/temporada;
// - cada aviso dura ~2.7s (2.4s visibles + animaciones) y desaparece solo;
// - con varios títulos los encadena UNO por vez, en el orden de la cola;
// - al agotarse la cola llama onFinish (useCareer limpia la cola) y el Career
//   Mode continúa exactamente donde estaba.
//
// La cola ya viene detectada por useCareer (career.trophies −
// celebratedTrophyIds): acá NO se calcula ni se persiste nada.
// ============================================================================

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

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
export default function CareerTrophyToast({ trophies, onFinish }) {
  const list = Array.isArray(trophies) ? trophies.filter(Boolean) : [];
  const [index, setIndex] = useState(0);
  const current = index < list.length ? list[index] : null;

  useEffect(() => {
    if (current) {
      const timer = window.setTimeout(() => setIndex((i) => i + 1), VISIBLE_MS);
      return () => window.clearTimeout(timer);
    }
    // Cola agotada: deja terminar la salida del último aviso y avisa al padre
    // (clearTrophyToasts es idempotente). Sin onFinish el índice ya quedó
    // fuera del rango, así que el overlay sigue oculto igual.
    if (list.length > 0) {
      const timer = window.setTimeout(() => {
        if (typeof onFinish === 'function') onFinish();
      }, Math.round(EXIT_S * 1000) + 40);
      return () => window.clearTimeout(timer);
    }
    if (index !== 0) setIndex(0); // la cola se vació: re-listo para la próxima
    return undefined;
  }, [current, index, list.length, onFinish]);

  if (!current) return null;

  const label = (current.label && String(current.label)) || 'Título';
  const clubName = current.clubName ? String(current.clubName) : '';
  const season = Number.isFinite(current.season) ? current.season : null;
  const meta = [clubName, season !== null ? `Temporada ${season}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="career-trophy-toast" role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${current.type || 'title'}`}
          className="career-trophy-toast__panel"
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          <span className="career-trophy-toast__icon-wrap">
            <Trophy size={62} strokeWidth={1.6} className="career-trophy-toast__icon" aria-hidden="true" />
          </span>
          <p className="career-trophy-toast__kicker">¡CAMPEÓN!</p>
          <p className="career-trophy-toast__label">{`Ganaste la ${label}`}</p>
          {meta ? <p className="career-trophy-toast__meta">{meta}</p> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
