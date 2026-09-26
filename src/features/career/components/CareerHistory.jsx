// ============================================================================
// CAREER HISTORY — trayectoria profesional (Modo Carrera, Paso 11A)
// ============================================================================
// Dos vistas de la misma carrera, ambas ya calculadas por el engine:
//   - Temporadas: cada entrada de career.seasonHistory (año, club, OVR, stats,
//     lesión, título).
//   - Clubes: cada etapa de career.clubHistory (el rango de edades se deriva
//     del fromAge de la etapa siguiente, exactamente como el motor lo diseñó).
// El colapso es solo visual y no toca datos.
// ============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ChevronDown, ChevronUp, Clock } from 'lucide-react';

import {
  DASH,
  careerStartAge,
  clubVisual,
  divisionName,
  reportClubVisual,
  roleLabel,
  safeNumber,
  statText,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';

export default function CareerHistory({ career, forceOpen = false, defaultOpen = false }) {
  // null = comportamiento automático (abierto si la carrera es corta o si la
  // pantalla lo fuerza); true/false = elección explícita del usuario.
  const [open, setOpen] = useState(null);

  const seasons = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  const stints = career && Array.isArray(career.clubHistory) ? career.clubHistory : [];
  const isGK = career && career.position === 'ARQ';
  const expanded = open === null ? (forceOpen || defaultOpen || seasons.length <= 3) : open;

  if (seasons.length === 0 && stints.length === 0) return null;

  const currentAge = safeNumber(career && career.age, careerStartAge());
  const currentVisual = clubVisual((career && career.club) || null);

  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker"><Clock size={14} /> Trayectoria</span>
        <button
          type="button"
          className="career-toggle"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
        >
          {`${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'}`}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!expanded && (
        <p className="career-section-note">
          Trayectoria resumida. Abrila para ver cada temporada, club, OVR y título.
        </p>
      )}

      {expanded && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
          {seasons.length > 0 && (
            <>
              <h3 className="career-subtitle">Temporada por temporada</h3>
              <ul className="career-timeline">
                {seasons.map((season, index) => {
                  const club = reportClubVisual(season.club);
                  const trophies = Array.isArray(season.trophies) ? season.trophies : [];
                  return (
                    <li className="career-timeline-item" key={`${season.season}-${index}`}>
                      <span className="career-timeline-season">{statText(season.season)}</span>
                      <div className="career-timeline-body">
                        <strong>{club.name}</strong>
                        <span>
                          {`${divisionName(club.division)} · ${roleLabel(season.role)} · OVR ${statText(season.ovrStart)} → ${statText(season.ovrEnd)}`}
                        </span>
                        <div className="career-timeline-tags">
                          <i>{`${statText(season.pj)} PJ`}</i>
                          <i>{isGK ? `${statText(season.cleanSheets)} vallas` : `${statText(season.gls)} goles`}</i>
                          <i>{`${statText(season.ast)} asist.`}</i>
                          {season.injury ? <i>{`Lesión: ${(season.injury && season.injury.label) || DASH}`}</i> : null}
                          {trophies.map((trophy, trophyIndex) => (
                            <i key={`${(trophy && trophy.type) || 'titulo'}-${trophyIndex}`}>
                              {`${(trophy && trophy.icon) || ''} ${(trophy && trophy.label) || 'Título'}`}
                            </i>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <h3 className="career-subtitle">Clubes</h3>
          {stints.length === 0 ? (
            <div className="career-stint">
              <ClubBadge
                club={currentVisual}
                size="sm"
                style={{
                  '--club-primary': currentVisual.primary,
                  '--club-secondary': currentVisual.secondary,
                }}
              />
              <div className="career-stint-body">
                <strong>{(career && career.club && career.club.name) || DASH}</strong>
                <span>{`Desde los ${careerStartAge()} años · sigue en el club`}</span>
              </div>
            </div>
          ) : (
            <div className="career-stints">
              {stints.map((stint, index) => {
                const next = stints[index + 1];
                const toAge = next && Number.isFinite(next.fromAge) ? next.fromAge : currentAge;
                const club = (stint && stint.club) || null;
                const visual = clubVisual(club);
                return (
                  <div className="career-stint" key={`${(club && club.key) || 'etapa'}-${index}`}>
                    <ClubBadge
                      club={visual}
                      size="sm"
                      style={{
                        '--club-primary': visual.primary,
                        '--club-secondary': visual.secondary,
                      }}
                    />
                    <div className="career-stint-body">
                      <strong>
                        {(club && club.name) || DASH}
                        {visual.countryFlag ? <span aria-hidden="true">{` ${visual.countryFlag}`}</span> : null}
                      </strong>
                      <span>
                        {`${divisionName((club && club.division) || stint.division)} · ${statText(stint.fromAge)}–${statText(toAge)} años${index === stints.length - 1 ? ' · actual' : ''}`}
                      </span>
                    </div>
                    <span className="career-chip" style={{ marginLeft: 'auto' }}>
                      <Activity size={12} /> {stint.via === 'youth' ? 'Cantera' : 'Traspaso'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
}