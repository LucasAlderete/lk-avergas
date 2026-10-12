// ============================================================================
// CAREER TROPHY SHELF — vitrina de títulos de la carrera
// ============================================================================
// SOLO presentación: agrupa career.trophies por tipo (Liga, Copa, Continental,
// Copa del Mundo...) y los deja a la vista debajo de la trayectoria. Recibe la
// carrera "visible" (displayCareer), así que los títulos aparecen a medida que
// avanza la reproducción de las temporadas.
// ============================================================================

import { AnimatePresence, motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

import TrophyArt from './TrophyArt.jsx';

const ORDER = ['worldcup', 'continental', 'league', 'cup'];
const typeOf = (key) => (key === 'worldcup' || key === 'ucl' || key === 'libertadores' || key === 'concacaf' ? (key === 'worldcup' ? 'worldcup' : 'continental') : key.split('_')[0]);

function groupTrophies(trophies) {
  const map = new Map();
  for (const trophy of trophies) {
    if (!trophy || typeof trophy !== 'object') continue;
    // Cada copa real por separado (LaLiga y Premier no se mezclan).
    const key = trophy.trophyId || trophy.type || trophy.label || 'titulo';
    const entry = map.get(key) || { key, trophy, label: trophy.label || 'Título', seasons: [] };
    if (Number.isFinite(trophy.season)) entry.seasons.push(trophy.season);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => {
    const ia = ORDER.indexOf(typeOf(a.key));
    const ib = ORDER.indexOf(typeOf(b.key));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export default function CareerTrophyShelf({ career }) {
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  if (trophies.length === 0) return null;
  const groups = groupTrophies(trophies);

  return (
    <section className="career-shelf" aria-label="Títulos ganados">
      <h2 className="career-shelf-head">
        <Trophy size={14} aria-hidden="true" />
        {`Títulos · ${trophies.length}`}
      </h2>
      <ul className="career-shelf-list">
        <AnimatePresence initial={false}>
          {groups.map((group) => (
            <motion.li
              className="career-shelf-item"
              key={group.key}
              title={group.seasons.length ? `${group.label}: ${group.seasons.join(' · ')}` : group.label}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* Hasta 3 títulos: una copita por cada uno. Más de 3: una sola
                  copa con el contador, así la vitrina no se desborda. */}
              <span className="career-shelf-cups" aria-hidden="true">
                {Array.from({ length: group.seasons.length > 3 ? 1 : Math.max(1, group.seasons.length) }, (_, i) => (
                  <TrophyArt key={i} trophy={group.trophy} className="career-shelf-cup" />
                ))}
                {group.seasons.length > 3 ? <b className="career-cup-count">{`×${group.seasons.length}`}</b> : null}
              </span>
              <span className="career-shelf-copy">
                <strong>{group.label}</strong>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
