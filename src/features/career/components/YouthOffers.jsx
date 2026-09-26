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
import { ArrowRight, Shield } from 'lucide-react';

import {
  clubCountryLabel,
  clubVisual,
  divisionName,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';

export default function YouthOffers({ offers, onChoose, busy, bare = false }) {
  const list = Array.isArray(offers) ? offers : [];
  if (list.length === 0) return null;
  const inner = (
    <>

      <div className="career-offers career-offers--youth">
        {list.map((offer, index) => {
          const club = clubVisual(offer && offer.club);
          const country = clubCountryLabel(offer && offer.club);
          return (
            <motion.article
              className="career-offer career-offer--youth"
              key={(offer && offer.id) || `oferta-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.12), ease: 'easeOut' }}
            >
              <ClubBadge
                club={club}
                size="sm"
                style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
              />
              <strong className="career-offer-youth-club">{club.name}</strong>
              <span className="career-offer-youth-meta">
                {country ? `${country.replace(/^[^\p{L}\p{N}\s]+/u, '')} · ` : ''}{divisionName(offer && offer.division)}
              </span>

              <button
                type="button"
                className="career-button career-button--primary career-button--block career-button--compact"
                onClick={() => onChoose(offer)}
                disabled={Boolean(busy)}
              >
                {busy ? 'Eligiendo…' : 'ELEGIR'} <ArrowRight size={14} />
              </button>
            </motion.article>
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
