// ============================================================================
// TRANSFER OFFERS — mercado de pases (Modo Carrera, Paso 11A)
// ============================================================================
// Cada oferta (generateTransferOffers del engine) se presenta como propuesta
// de un club. El botón ACEPTAR dispara `chooseAction('transfer', offer)`:
// la transferencia real la aplica el engine vía flow.js. Quedarse o retirarse
// se renderizan aparte (CareerDecision), porque los ofrece el propio flow.
// ============================================================================

import { motion } from 'framer-motion';
import { ArrowRight, Plane } from 'lucide-react';

import {
  DASH,
  clubCountryLabel,
  clubVisual,
  divisionName,
  offerReasonLabel,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';

export default function TransferOffers({ offers, onAccept, busy, bare = false }) {
  const list = Array.isArray(offers) ? offers : [];
  if (list.length === 0) return null;
  const inner = (
    <>
      <p className="career-decision-lead career-decision-lead--tight">
        Elegí club. Quedarse o moverse cambia rol y valor.
      </p>

      <div className="career-offers career-offers--rows career-offers--tight">
        {list.map((offer, index) => {
          const club = clubVisual(offer && offer.club);
          const country = clubCountryLabel(offer && offer.club);
          const reason = offerReasonLabel(offer && offer.reason);
          return (
            <motion.article
              className="career-offer career-offer--row"
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
              <div className="career-offer-row-main">
                <strong className="career-offer-row-club">{club.name}</strong>
                <span className="career-offer-row-meta">
                  {divisionName(offer && offer.division)}
                  {country ? <span>{` · ${country}`}</span> : null}
                  <span aria-hidden="true"> · </span>
                  {(offer && offer.roleLabel) || DASH}
                  {reason ? <span className="career-offer-reason"> · {reason}</span> : null}
                </span>
              </div>

              <button
                type="button"
                className="career-button career-button--primary"
                onClick={() => onAccept(offer)}
                disabled={Boolean(busy)}
              >
                {busy ? 'Aceptando…' : 'Aceptar'} <ArrowRight size={15} />
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
        <span className="career-section-kicker"><Plane size={14} /> Mercado de pases</span>
        <h2 className="career-section-title">Propuestas sobre la mesa</h2>
      </div>
      {inner}
    </section>
  );
}