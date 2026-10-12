// ============================================================================
// useSeasonReveal — reproduce el avance de temporadas como un contador
// ============================================================================
// El motor simula el tramo entero de golpe. Esto es SOLO presentación: cuando
// `seasonHistory` crece, anima una posición continua desde las temporadas que
// ya se veían hasta el total, en 2-3 segundos (más largo cuanto más
// temporadas). En cada cuadro arma una carrera "visible":
//   - temporadas completas hasta la parte entera de la posición;
//   - la temporada en curso, PARCIAL: partidos/goles/asistencias y OVR
//     crecen con la fracción, así la fila se va llenando y los totales suben.
// Edad, temporada y títulos solo cambian al COMPLETARSE cada temporada (el
// aviso de campeón espera a esa temporada). Mientras corre, `revealing` es
// true y la pantalla frena las decisiones. Con reducir movimiento: todo de una.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

// Ritmo de la reproducción: ~1,1 s por temporada (mín. 1,8 s, máx. 3,2 s).
const MS_PER_SEASON = 1100;
const MIN_MS = 1800;
const MAX_MS = 3200;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// Arranque y frenada suaves (como un contador que despega y se asienta).
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

const num = (v) => (Number.isFinite(v) ? v : 0);
const sumSeasons = (seasons, key) => seasons.reduce((acc, row) => acc + num(row && row[key]), 0);
const trophyCount = (seasons) =>
  seasons.reduce((acc, row) => acc + (Array.isArray(row && row.trophies) ? row.trophies.length : 0), 0);

/** Temporada a medio jugar: números proporcionales a la fracción. */
function partialSeason(row, frac) {
  const scale = (v) => Math.round(num(v) * frac);
  return {
    ...row,
    pj: scale(row.pj),
    gls: scale(row.gls),
    ast: scale(row.ast),
    cleanSheets: scale(row.cleanSheets),
    ovrEnd: Math.round(num(row.ovrStart) + (num(row.ovrEnd) - num(row.ovrStart)) * frac),
    trophies: [],
    injury: null,
    partial: true,
  };
}

/** Carrera "visible" en la posición `pos` (temporadas, con decimales). */
function careerAt(career, pos) {
  const history = career.seasonHistory;
  const full = Math.floor(pos);
  const frac = pos - full;
  const complete = history.slice(0, full);
  const seasons = frac > 0 && history[full] ? [...complete, partialSeason(history[full], frac)] : complete;
  const lastComplete = complete[complete.length - 1];
  const live = seasons[seasons.length - 1];
  const hiddenTrophies = trophyCount(history.slice(full));
  const trophies = Array.isArray(career.trophies)
    ? career.trophies.slice(0, Math.max(0, career.trophies.length - hiddenTrophies))
    : career.trophies;
  return {
    ...career,
    seasonHistory: seasons,
    ovr: live ? live.ovrEnd : (history[0] ? history[0].ovrStart : career.ovr),
    age: lastComplete ? lastComplete.age + 1 : career.age - history.length,
    season: lastComplete ? lastComplete.season + 1 : career.season - history.length,
    trophies,
    careerStats: {
      ...(career.careerStats || {}),
      pj: sumSeasons(seasons, 'pj'),
      gls: sumSeasons(seasons, 'gls'),
      ast: sumSeasons(seasons, 'ast'),
      cleanSheets: sumSeasons(seasons, 'cleanSheets'),
    },
  };
}

export default function useSeasonReveal(career) {
  const total = career && Array.isArray(career.seasonHistory) ? career.seasonHistory.length : 0;
  const prevTotal = useRef(null);
  const prevId = useRef(null);
  // Identidad de la carrera: si cambia (partida cargada, carrera nueva) no se anima.
  const careerId = career ? ((career.snapshot && career.snapshot.createdAt) || career.playerId || 'career') : null;
  const [pos, setPos] = useState(total);
  // "Saltar": corta la reproducción y muestra el tramo entero de una.
  const skippedRef = useRef(false);
  const totalRef = useRef(total);
  totalRef.current = total;
  const skip = useCallback(() => {
    skippedRef.current = true;
    setPos(totalRef.current);
  }, []);

  useEffect(() => {
    const before = prevTotal.current;
    const sameCareer = prevId.current !== null && prevId.current === careerId;
    prevTotal.current = total;
    prevId.current = careerId;
    // Partida cargada, carrera nueva o reinicio: sin animación.
    if (!sameCareer || before === null || total <= before || prefersReducedMotion()) {
      setPos(total);
      return undefined;
    }
    let frame = 0;
    skippedRef.current = false;
    const startedAt = performance.now();
    const duration = Math.max(MIN_MS, Math.min(MAX_MS, (total - before) * MS_PER_SEASON));
    const tick = (now) => {
      if (skippedRef.current) return;
      const t = Math.min(1, (now - startedAt) / duration);
      setPos(before + (total - before) * easeInOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setPos(before);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, careerId]);

  const revealing = Boolean(career) && pos < total;
  return {
    revealing,
    skip,
    displayCareer: revealing ? careerAt(career, pos) : career,
  };
}
