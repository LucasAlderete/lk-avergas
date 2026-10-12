// ============================================================================
// YOUTH OFFERS — ofertas de debut (Modo Carrera, Paso 11A)
// ============================================================================
// Cada oferta de cantera (generateYouthOffers del engine) se muestra como una
// propuesta compacta de club: escudo, nombre, país y división. El OVR del club
// NO se muestra (el único OVR visible es el del jugador). El botón dispara la
// elección que la pantalla resuelve mediante el hook; este componente nunca
// decide reglas de carrera.
// ============================================================================

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

import {
  clubCountryLabel,
  clubVisual,
  divisionName,
  leagueName,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';
import CountryFlag from './CountryFlag.jsx';

export default function YouthOffers({ offers, onChoose, busy, bare = false, selectedKey = null }) {
  const list = Array.isArray(offers) ? offers : [];
  if (list.length === 0) return null;
  const inner = (
    <>

      <div className="career-offers career-offers--youth">
        {list.map((offer, index) => {
          const club = clubVisual(offer && offer.club);
          const country = clubCountryLabel(offer && offer.club);
          return (
            // La tarjeta entera es el botón (como Copero): sin botón "Elegir".
            <motion.button
              type="button"
              className={`career-offer career-offer--youth${selectedKey === null ? '' : (selectedKey === ((offer && offer.id) || `oferta-${index}`) ? ' is-picked' : ' is-dimmed')}`}
              key={(offer && offer.id) || `oferta-${index}`}
              onClick={() => onChoose(offer)}
              disabled={Boolean(busy) || selectedKey !== null}
              aria-label={`Fichar por ${club.name}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.12), ease: 'easeOut' }}
            >
              <span className="career-dest-tag">Fichar por</span>
              <ClubBadge
                club={club}
                size="sm"
                style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
              />
              <strong className="career-offer-youth-club">{club.name}</strong>
              <span className="career-offer-youth-meta">
                {country ? <><CountryFlag code={club.countryCode} size={12} /> {country} · </> : null}{leagueName(offer && offer.club, offer && offer.division)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </>
  );
  if (bare) return inner;
  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker"><Shield size={14} /> Ofertas de debut</span>
        <h2 className="career-section-title">Elegí tu primer club</h2>
      </div>
      {inner}
    </section>
  );
}
