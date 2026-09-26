// ============================================================================
// CAREER DESTINATIONS — selector de próximo destino (Modo Carrera)
// ============================================================================
// Presenta EN UNA SOLA VISTA todas las alternativas del checkpoint de decisión
// post-temporada, como miniaturas compactas clickeables:
//
//   [ ACTUAL ] [ OFERTA ] [ OFERTA ] [ RETIRARSE ]
//
// Reemplaza el paso intermedio "Ver ofertas" + la lista vertical de acciones:
// el mercado lo abre CareerScreen (acción 'transfer' sin payload, la misma que
// disparaba el botón eliminado) y acá se dibujan directamente las ofertas que
// el motor ya generó (state.transferOffers).
//
// SOLO presentación:
//   - No decide qué es válido: recibe `options` (flow.getCareerDecisionOptions)
//     y dibuja una miniatura por cada alternativa realmente disponible.
//   - No recalcula nada: usa datos que el engine ya calculó (career, career.club,
//     offers con division/roleLabel). El OVR del club es dato INTERNO del engine
//     y NUNCA se muestra (el único OVR visible es el del jugador).
//   - No toca flow/engine/persistence: cada miniatura dispara una acción que ya
//     existe (stay · transfer con la oferta elegida · retire).
// ============================================================================

import { motion } from 'framer-motion';
import { Flag, ShieldCheck } from 'lucide-react';

import {
  DASH,
  clubVisual,
  divisionName,
  roleLabel,
  statText,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';

export default function CareerDestinations({
  career,
  offers,
  options,
  retirementDue,
  onStay,
  onAccept,
  onRetire,
  busy,
  bare = false,
}) {
  const list = Array.isArray(offers) ? offers : [];
  const actions = Array.isArray(options) ? options : [];
  const canStay = actions.includes('stay');
  const canRetire = actions.includes('retire');
  // Las ofertas del estado se muestran siempre que existan (el mercado abierto
  // las generó): cada una es un destino aceptable vía la acción 'transfer'.
  const offerTiles = list;
  const anyBusy = busy === true || (typeof busy === 'string' && busy.length > 0);
  const busyFor = (action) => busy === action || busy === true;

  // Fase sin alternativas de destino (retiro ya resuelto, estados finales...).
  if (!canStay && !canRetire && offerTiles.length === 0) return null;

  const club = clubVisual(career && career.club);
  const clubDivision = career && career.club ? career.club.division : null;

  const inner = (
    <div className="career-dest-wrap">
      {retirementDue ? (
        <p className="career-alert career-alert--danger career-alert--tight">
          El cuerpo ya no aguanta otra temporada: la única decisión posible es el retiro.
        </p>
      ) : null}

      <div className="career-dest-grid">
        {canStay ? (
          <motion.button
            type="button"
            className="career-dest career-dest--current"
            onClick={() => onStay()}
            disabled={anyBusy}
            aria-label={`Continuar en ${club.name}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ClubBadge
              club={club}
              size="sm"
              style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
            />
            <span className="career-dest-tag">Actual</span>
            <span className="career-dest-club">{club.name}</span>
            <span className="career-dest-meta">{divisionName(clubDivision)}</span>
          </motion.button>
        ) : null}

        {offerTiles.map((offer, index) => {
          const target = clubVisual(offer && offer.club);
          return (
            <motion.button
              type="button"
              className="career-dest"
              key={(offer && offer.id) || `destino-${index}`}
              onClick={() => onAccept(offer)}
              disabled={anyBusy}
              aria-label={`Aceptar la oferta de ${target.name}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min((index + 1) * 0.03, 0.09), ease: 'easeOut' }}
            >
              <ClubBadge
                club={target}
                size="sm"
                style={{ '--club-primary': target.primary, '--club-secondary': target.secondary }}
              />
              <span className="career-dest-tag">Oferta</span>
              <span className="career-dest-club">{target.name}</span>
              <span className="career-dest-meta">{divisionName(offer && offer.division)}</span>
            </motion.button>
          );
        })}

        {canRetire ? (
          <motion.button
            type="button"
            className="career-dest career-dest--retire"
            onClick={() => onRetire()}
            disabled={anyBusy}
            aria-label="Retirarse y cerrar la carrera"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: 0.06, ease: 'easeOut' }}
          >
            <span className="career-dest-icon" aria-hidden="true"><Flag size={18} /></span>
            <span className="career-dest-tag career-dest-tag--danger">Retirarse</span>
            <span className="career-dest-meta">
              {busyFor('retire') ? 'Cerrando…' : 'Cierra la carrera'}
            </span>
          </motion.button>
        ) : null}
      </div>
    </div>
  );

  if (bare) return inner;
  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker"><ShieldCheck size={14} /> Próximo destino</span>
        <h2 className="career-section-title">Elegí tu próximo destino</h2>
      </div>
      {inner}
    </section>
  );
}
