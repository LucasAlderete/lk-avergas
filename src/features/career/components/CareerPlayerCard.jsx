// ============================================================================
// CAREER PLAYER CARD — ancla permanente de la carrera (Paso 12)
// ============================================================================
// Player-card persistente de la columna izquierda (estilo "Copero moderno").
// SOLO presentación: muestra datos que YA calculó el engine (ovr, valor,
// rol, careerStats, trofeos). No calcula reglas ni toca el flow.
// Funciona sin club (debut), con club, durante la carrera y retirado.
// ============================================================================


import { useEffect, useRef, useState } from 'react';
import {
  DASH,
  clubVisual,
  formatMoney,
  OVR_TIERS,
  ovrTier,
  statText,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';
import CountryFlag from './CountryFlag.jsx';
import { photoOf } from '../../../playerPhotos.js';
import { COUNTRIES } from '../../../data/careerWorld/countries.js';
import { positionById } from '../config.js';

export default function CareerPlayerCard({ career, isRetired = false }) {
  const club = clubVisual(career && career.club);
  const hasClub = Boolean(career && career.club && career.club.name);
  const photo = career && career.name ? photoOf(career.name) : null;

  const country = COUNTRIES[(career && career.nationality) || 'AR'] || COUNTRIES.AR;
  const ovr = career && career.ovr;
  const tone = ovrTier(ovr);
  // Destello breve cuando el OVR pasa a un nivel mejor (pocas veces por carrera).
  const prevTone = useRef(tone);
  const [levelUp, setLevelUp] = useState(false);
  useEffect(() => {
    const went = OVR_TIERS.indexOf(tone) > OVR_TIERS.indexOf(prevTone.current);
    prevTone.current = tone;
    if (!went) return undefined;
    setLevelUp(true);
    const timer = window.setTimeout(() => setLevelUp(false), 700);
    return () => window.clearTimeout(timer);
  }, [tone]);

  return (
    // Barra superior (distribución tipo Copero): OVR grande a la izquierda;
    // país + número/posición, y debajo escudo + club; edad y valor a la
    // derecha. La foto del amigo queda de fondo, suave, como identidad.
    <section className="career-pcard career-topbar" aria-label="Ficha del jugador">
      {photo ? <img className="career-topbar-bg" src={photo} alt="" aria-hidden="true" /> : null}
      <div className={`career-topbar-ovr is-${tone}${levelUp ? ' is-levelup' : ''}`} aria-label={`OVR ${statText(ovr)}`}>
        <span>OVR</span>
        <strong>{statText(ovr)}</strong>
      </div>
      <div className="career-topbar-id">
        <p className="career-topbar-pills">
          <span className="career-topbar-pill"><CountryFlag code={(career && career.nationality) || 'AR'} size={13} /> {country.code3}</span>
          <span className="career-topbar-pill is-number">
            #{(career && career.shirtNumber) || 10} {career && career.position ? positionById(career.position)?.short || career.position : DASH}
          </span>
          {isRetired ? <span className="career-topbar-pill">Retirado</span> : null}
        </p>
        <p className="career-topbar-club">
          {hasClub ? (
            <ClubBadge
              club={club}
              size="xs"
              style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
            />
          ) : null}
          <span>{hasClub ? club.name : 'Libre'}</span>
        </p>
      </div>
      <dl className="career-topbar-side">
        <div><dt>Edad</dt><dd>{statText(career && career.age)}</dd></div>
        <div><dt>Valor</dt><dd>{formatMoney(career && career.marketValue)}</dd></div>
      </dl>
    </section>
  );
}
