// CAREER TIMELINE — tabla compacta de trayectoria (refactor UX estilo deportivo)
// SOLO presentación: filas desde career.seasonHistory + fila actual.
// NO inventa stats futuras: placeholders apagados (edad) sin PJ/G/AST.
// Fila "Decisión de carrera..." cuando phase exige decidir (la decisión real
// se toma en el panel izquierdo).

import { reportClubVisual, safeNumber, statText } from './careerFormat.js';
import { AGE } from '../config.js';

const FUTURE_PLACEHOLDERS = 2;

export default function CareerTimeline({ career, phase }) {
  const seasons = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  const isGK = career && career.position === 'ARQ';
  const currentAge = Number.isFinite(career && career.age) ? career.age : null;
  const currentSeason = Number.isFinite(career && career.season) ? career.season : null;
  const clubName = (career && career.club && career.club.name) || 'Sin club';
  const needsDecisionRow = phase === 'decision' || phase === 'transfer' || phase === 'event';
  if (seasons.length === 0 && currentAge === null) return null;
  const rows = [...seasons].sort((a, b) => safeNumber(a.season, 0) - safeNumber(b.season, 0));
  const played = new Set(rows.map((s) => safeNumber(s.season, null)).filter((v) => v !== null));
  const futureAges = [];
  if (currentAge !== null) {
    for (let i = 1; i <= FUTURE_PLACEHOLDERS; i += 1) {
      const age = currentAge + i;
      if (age >= AGE.RETIRE) break;
      const season = currentSeason !== null ? currentSeason + i : null;
      if (season !== null && played.has(season)) continue;
      futureAges.push({ age });
    }
  }
  const statHead = isGK ? 'VALLAS' : 'GLS';

  return (
    <section className="career-table-card" aria-label="Trayectoria de la carrera">
      <div className="career-table-head">
        <span className="career-section-kicker">Trayectoria</span>
        <span className="career-section-note">
          {seasons.length === 0
            ? 'Todavía sin temporadas jugadas'
            : `${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'}`}
        </span>
      </div>
      <div className="career-table" role="table" aria-label="Temporadas jugadas">
        <div className="career-table-row career-table-row--head" role="row" aria-hidden="true">
          <span>EDAD</span><span>CLUB</span><span>OVR</span><span>PJ</span><span>{statHead}</span><span>AST</span>
        </div>
        {rows.length === 0 ? (
          <p className="career-section-note career-table-empty">
            Avanzá tu primera temporada para empezar a llenar la trayectoria.
          </p>
        ) : (
          rows.map((season, index) => {
            const club = reportClubVisual(season.club);
            const trophies = Array.isArray(season.trophies) ? season.trophies : [];
            const flags = `${season.injury ? ' ⚕' : ''}${trophies.length > 0 ? ' 🏆' : ''}`;
            const sameOvr = season.ovrStart === season.ovrEnd;
            const ovrCell = Number.isFinite(season.ovrStart) && Number.isFinite(season.ovrEnd) && !sameOvr
              ? `${season.ovrStart}→${season.ovrEnd}`
              : statText(season.ovrEnd ?? season.ovrStart);
            return (
              <div className="career-table-row" role="row" key={`${season.season}-${index}`}>
                <span className="career-table-age">{statText(season.age)}</span>
                <span className="career-table-club" title={club.name}>
                  {club.name}{flags ? <i className="career-table-flags">{flags}</i> : null}
                </span>
                <span className="career-table-num">{ovrCell}</span>
                <span className="career-table-num">{statText(season.pj)}</span>
                <span className="career-table-num">{statText(isGK ? season.cleanSheets : season.gls)}</span>
                <span className="career-table-num">{statText(season.ast)}</span>
              </div>
            );
          })
        )}

        {needsDecisionRow ? (
          <div className="career-table-row career-table-row--decision" role="row">
            <span className="career-table-age">{currentAge !== null ? statText(currentAge) : '?'}</span>
            <span className="career-table-club">? Decisión de carrera…</span>
            <span className="career-table-num">{statText(career && career.ovr)}</span>
            <span className="career-table-num">–</span>
            <span className="career-table-num">–</span>
            <span className="career-table-num">–</span>
          </div>
        ) : (
          currentAge !== null && (
            <div className="career-table-row career-table-row--current" role="row">
              <span className="career-table-age">{statText(currentAge)}</span>
              <span className="career-table-club" title={clubName}>
                {clubName} <i className="career-table-now">AHORA</i>
              </span>
              <span className="career-table-num">{statText(career && career.ovr)}</span>
              <span className="career-table-num">–</span>
              <span className="career-table-num">–</span>
              <span className="career-table-num">–</span>
            </div>
          )
        )}
        {futureAges.map(({ age }) => (
          <div className="career-table-row career-table-row--future" role="row" key={`futura-${age}`} aria-hidden="true">
            <span className="career-table-age">{age}</span>
            <span className="career-table-club">· · ·</span>
            <span className="career-table-num">–</span>
            <span className="career-table-num">–</span>
            <span className="career-table-num">–</span>
            <span className="career-table-num">–</span>
          </div>
        ))}
      </div>
      {seasons.length === 0 ? null : (
        <p className="career-tline-foot">
          {`${safeNumber(career && career.careerStats && career.careerStats.pj)} PJ acumulados en tu carrera`}
        </p>
      )}
    </section>
  );
}
