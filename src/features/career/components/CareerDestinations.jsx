// ============================================================================
// CAREER DESTINATIONS — selector de próximo destino (Modo Carrera)
// ============================================================================
// Presenta EN UNA SOLA VISTA todas las alternativas del checkpoint de decisión
// post-temporada, como miniaturas compactas clickeables:
//
//   [ ACTUAL ] [ OFERTA ] [ OFERTA ]    (33+: [ ACTUAL ] [ OFERTA ] [ RETIRARSE ])
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

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, ShieldCheck } from 'lucide-react';

import {
  DASH,
  clubVisual,
  divisionName,
  leagueName,
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
  selectedKey = null,
}) {
  const list = Array.isArray(offers) ? offers : [];
  const actions = Array.isArray(options) ? options : [];
  const canStay = actions.includes('stay');
  const canRetire = actions.includes('retire');
  // Las ofertas del estado se muestran siempre que existan (el mercado abierto
  // las generó): cada una es un destino aceptable vía la acción 'transfer'.
  // Siempre 3 opciones: con "Retirarse" disponible (33+) entran el club actual,
  // UNA oferta y el retiro; si es más joven, el club actual + 2 ofertas.
  const maxTiles = 3 - (canStay ? 1 : 0) - (canRetire ? 1 : 0);
  const offerTiles = list.slice(0, Math.max(0, maxTiles));
  const anyBusy = busy === true || (typeof busy === 'string' && busy.length > 0) || selectedKey !== null;
  // Opción ya elegida: queda resaltada y el resto apagado hasta el próximo checkpoint.
  const pick = (key) => (selectedKey === null ? '' : (selectedKey === key ? ' is-picked' : ' is-dimmed'));
  const busyFor = (action) => busy === action || busy === true;
  // Retirarse no tiene vuelta atrás: el primer toque lo arma y el segundo lo
  // confirma. Con el retiro obligatorio es la única opción y va directo.
  const [retireArmed, setRetireArmed] = useState(false);
  useEffect(() => {
    if (!retireArmed) return undefined;
    const timer = window.setTimeout(() => setRetireArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [retireArmed]);
  const handleRetire = () => {
    if (retirementDue || retireArmed) {
      setRetireArmed(false);
      onRetire();
      return;
    }
    setRetireArmed(true);
  };

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

        {offerTiles.map((offer, index) => {
          const target = clubVisual(offer && offer.club);
          return (
            <motion.button
              type="button"
              className={`career-dest${pick((offer && offer.id) || `destino-${index}`)}`}
              key={(offer && offer.id) || `destino-${index}`}
              onClick={() => onAccept(offer)}
              disabled={anyBusy}
              aria-label={`Aceptar la oferta de ${target.name}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min((index + 1) * 0.03, 0.09), ease: [0.23, 1, 0.32, 1] }}
            >
              <ClubBadge
                club={target}
                size="sm"
                style={{ '--club-primary': target.primary, '--club-secondary': target.secondary }}
              />
              {offer && offer.reason === 'event_transfer'
                ? <span className="career-dest-tag career-dest-tag--event">Te buscó</span>
                : <span className="career-dest-tag">Fichar por</span>}
              <span className="career-dest-club">{target.name}</span>
              <span className="career-dest-meta">{leagueName(offer && offer.club, offer && offer.division)}</span>
              {offer && offer.roleLabel ? <span className="career-dest-role">{offer.roleLabel}</span> : null}
            </motion.button>
          );
        })}

        {/* Quedarse es una opción más, con la misma tarjeta (como Copero). */}
        {canStay ? (
          <motion.button
            type="button"
            className={`career-dest${pick('stay')}`}
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
            <span className="career-dest-tag">Quedarse en</span>
            <span className="career-dest-club">{club.name}</span>
            <span className="career-dest-meta">{leagueName(career && career.club, clubDivision)}</span>
            {career && career.role ? <span className="career-dest-role">{roleLabel(career.role)}</span> : null}
          </motion.button>
        ) : null}
        {canRetire ? (
          <motion.button
            type="button"
            className={`career-dest career-dest--retire${retireArmed ? ' is-armed' : ''}${pick('retire')}`}
            onClick={handleRetire}
            onBlur={() => setRetireArmed(false)}
            disabled={anyBusy}
            aria-label={retireArmed ? 'Confirmar el retiro y cerrar la carrera' : 'Retirarse y cerrar la carrera'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: 0.06, ease: 'easeOut' }}
          >
            <span className="career-dest-icon" aria-hidden="true"><Flag size={18} /></span>
            <span className="career-dest-tag career-dest-tag--danger">Retirarse</span>
            <span className="career-dest-meta" aria-live="polite">
              {busyFor('retire') ? 'Cerrando…' : retireArmed ? 'Tocá de nuevo para colgar los botines' : 'Cierra la carrera'}
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
