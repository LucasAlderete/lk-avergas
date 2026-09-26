// ============================================================================
// CAREER PLAYER CARD — ancla permanente de la carrera (Paso 12)
// ============================================================================
// Player-card persistente de la columna izquierda (estilo "Copero moderno").
// SOLO presentación: muestra datos que YA calculó el engine (ovr, valor,
// rol, careerStats, trofeos). No calcula reglas ni toca el flow.
// Funciona sin club (debut), con club, durante la carrera y retirado.
// ============================================================================

import { Trophy } from 'lucide-react';

import {
  DASH,
  clubVisual,
  formatMoney,
  positionLabel,
  safeNumber,
  statText,
} from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';

export default function CareerPlayerCard({ career, isRetired = false }) {
  const club = clubVisual(career && career.club);
  const hasClub = Boolean(career && career.club && career.club.name);
  const stats = (career && career.careerStats) || {};
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  const isGK = career && career.position === 'ARQ';

  return (
    <section className="career-pcard career-pcard--compact" aria-label="Ficha del jugador">
      <div className="career-pcard-head">
        <ClubBadge
          club={club}
          size="xs"
          style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
        />
        <div className="career-pcard-id">
          <h2 className="career-pcard-name">{(career && career.name) || 'Jugador sin datos'}</h2>
          <p className="career-pcard-meta">
            <span className="career-pcard-pos">
              {career && career.position ? positionLabel(career.position) : DASH}
            </span>
            <span aria-hidden="true"> · </span>
            <span>{hasClub ? `${club.name}${club.countryFlag ? ` ${club.countryFlag}` : ''}` : 'Sin club'}</span>
            {isRetired ? <span className="career-pcard-retired"> · Retirado</span> : null}
          </p>
        </div>
        <div className="career-pcard-ovr">
          <span className="career-ovr-label">OVR</span>
          <strong className="career-ovr-value career-ovr-value--sm">{statText(career && career.ovr)}</strong>
        </div>
      </div>

      <dl className="career-pcard-line">
        <div><dt>Edad</dt><dd>{statText(career && career.age)}</dd></div>
        <div><dt>Valor</dt><dd>{formatMoney(career && career.marketValue)}</dd></div>
        <div><dt>Títulos</dt><dd>{trophies.length}</dd></div>
        <div><dt>PJ</dt><dd>{safeNumber(stats.pj)}</dd></div>
        <div><dt>{isGK ? 'Vallas' : 'Goles'}</dt><dd>{isGK ? safeNumber(stats.cleanSheets) : safeNumber(stats.gls)}</dd></div>
        <div><dt>Asist.</dt><dd>{safeNumber(stats.ast)}</dd></div>
        <div><dt>Lesiones</dt><dd>{safeNumber(career && career.injuries)}</dd></div>
      </dl>

      {trophies.length > 0 && (
        <p className="career-pcard-titles" aria-label="Trofeos">
          <Trophy size={13} aria-hidden="true" />
          <span>{trophies.slice(0, 3).map((trophy) => (trophy && trophy.label) || 'Título').join(' · ')}</span>
          {trophies.length > 3 && <span>+{trophies.length - 3} más</span>}
        </p>
      )}
    </section>
  );
}
