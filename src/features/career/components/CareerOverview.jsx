// ============================================================================
// CAREER OVERVIEW + SEASON STRIP (Modo Carrera, Paso 11A)
// ============================================================================
// Dos bloques de presentación:
//   - CareerSeasonStrip: números de la última temporada jugada + valor actual.
//   - CareerOverview:    estado de carrera, atributos, totales, trofeos y logros.
//
// Reglas: no se calcula nada de la carrera (todo viene del engine); los datos
// opcionales (attrs, trophies, achievements, seasonHistory) tienen fallback
// visual y nunca rompen el render.
// ============================================================================

import { Activity, Award, Calendar, Coins, Shield, Star, Target, Trophy, Zap } from 'lucide-react';

import {
  DASH,
  attrEntries,
  clubCountryLabel,
  divisionName,
  formatMoney,
  profileLabel,
  repStars,
  roleLabel,
  safeNumber,
  statText,
} from './careerFormat.js';

/** Última temporada archivada por el motor (o null si todavía no jugó). */
function lastSeasonOf(career) {
  const history = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  return history.length > 0 ? history[history.length - 1] : null;
}

function StripCell({ icon: Icon, label, value }) {
  return (
    <div className="career-strip-cell">
      <span className="career-strip-label"><Icon size={13} /> {label}</span>
      <strong className="career-strip-value">{value}</strong>
    </div>
  );
}

/** Números grandes de la última temporada jugada. */
export function CareerSeasonStrip({ career }) {
  const last = lastSeasonOf(career);
  const isGK = career && career.position === 'ARQ';

  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker">
          <Calendar size={14} />
          {last ? `Temporada ${statText(last.season)}` : 'Sin temporadas jugadas'}
        </span>
        <span className="career-section-note">
          {last ? `Con ${(last.club && last.club.name) || 'su club'}` : 'Avanzá una temporada para ver tus números'}
        </span>
      </div>
      <div className="career-strip">
        <StripCell icon={Activity} label="Partidos" value={last ? statText(last.pj) : DASH} />
        <StripCell icon={Target} label="Goles" value={last ? statText(last.gls) : DASH} />
        {isGK
          ? <StripCell icon={Shield} label="Vallas" value={last ? statText(last.cleanSheets) : DASH} />
          : <StripCell icon={Zap} label="Asistencias" value={last ? statText(last.ast) : DASH} />}
        <StripCell icon={Coins} label="Valor" value={formatMoney(career && career.marketValue)} />
      </div>
    </section>
  );
}

function Stat({ label, value, note, big }) {
  return (
    <div className="career-stat">
      <span className="career-stat-label">{label}</span>
      <span className={`career-stat-value${big ? ' career-stat-value--big' : ''}`}>{value}</span>
      {note ? <span className="career-stat-note">{note}</span> : null}
    </div>
  );
}

/** Estado de carrera, atributos, totales, trofeos y logros. */
export default function CareerOverview({ career }) {
  const club = (career && career.club) || null;
  const clubName = (club && club.name) || DASH;
  const attrs = attrEntries(career && career.attrs);
  const stats = (career && career.careerStats) || {};
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  const achievements = career && Array.isArray(career.achievements) ? career.achievements : [];
  const reputation = repStars(career && career.domesticRep);
  const profile = profileLabel(career && career.profile);
  const isGK = career && career.position === 'ARQ';

  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker"><Shield size={14} /> Estado de carrera</span>
        <h2 className="career-section-title">{clubName}</h2>
      </div>

      <div className="career-grid">
        <Stat label="Temporada" value={statText(career && career.season)} />
        <Stat label="Club" value={clubName} note={(club && club.barrio) || undefined} />
        <Stat label="División" value={divisionName(club && club.division)} />
        <Stat label="Edad" value={statText(career && career.age)} />
        <Stat label="OVR" value={statText(career && career.ovr)} big />
        <Stat label="Pico OVR" value={statText(career && career.overallPeak)} big />
        <Stat label="Valor de mercado" value={formatMoney(career && career.marketValue)} />
        <Stat label="Rol en el club" value={roleLabel(career && career.role)} />
      </div>

      <div className="career-tags" style={{ marginTop: '12px' }}>
        <span className="career-chip">{`Reputación ${'★'.repeat(reputation)}${'☆'.repeat(5 - reputation)}`}</span>
        {profile ? <span className="career-chip">{profile}</span> : null}
        {clubCountryLabel(club) ? <span className="career-chip">{clubCountryLabel(club)}</span> : null}
        {club && club.league ? <span className="career-chip">{club.league}</span> : null}
        {club && club.stadium ? <span className="career-chip">{club.stadium}</span> : null}
      </div>

      {attrs.length > 0 && (
        <>
          <h3 className="career-subtitle">Atributos</h3>
          <div className="career-attrs">
            {attrs.map((attr) => (
              <div key={attr.key}>
                <div className="career-attr-head">
                  <span>{attr.label}</span>
                  <b>{attr.display}</b>
                </div>
                <div className="career-attr-track">
                  <i className="career-attr-fill" style={{ width: `${attr.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="career-subtitle">Carrera acumulada</h3>
      <div className="career-tags">
        <span className="career-chip"><Activity size={13} /> {safeNumber(stats.pj)} PJ</span>
        <span className="career-chip"><Target size={13} /> {safeNumber(stats.gls)} goles</span>
        <span className="career-chip"><Zap size={13} /> {safeNumber(stats.ast)} asistencias</span>
        {isGK ? <span className="career-chip"><Shield size={13} /> {safeNumber(stats.cleanSheets)} vallas</span> : null}
        <span className="career-chip"><Trophy size={13} /> {trophies.length} títulos</span>
        <span className="career-chip">{safeNumber(career && career.injuries)} lesiones</span>
      </div>

      {trophies.length > 0 && (
        <>
          <h3 className="career-subtitle">Trofeos</h3>
          <div className="career-tags">
            {trophies.map((trophy, index) => (
              <span className="career-tag" key={`${(trophy && trophy.type) || 'titulo'}-${(trophy && trophy.season) || index}`}>
                <span aria-hidden="true">{(trophy && trophy.icon) || ''}</span>
                {(trophy && trophy.label) || 'Título'}
                <small>{`T${(trophy && trophy.season) || DASH}${trophy && trophy.clubName ? ` · ${trophy.clubName}` : ''}`}</small>
              </span>
            ))}
          </div>
        </>
      )}

      {achievements.length > 0 && (
        <>
          <h3 className="career-subtitle">Logros</h3>
          <div className="career-tags">
            {achievements.map((achievement, index) => (
              <span className="career-tag" key={`${(achievement && achievement.id) || 'logro'}-${index}`}>
                {achievement && achievement.id === 'leyenda' ? <Star size={14} /> : <Award size={14} />}
                {(achievement && achievement.label) || (typeof achievement === 'string' ? achievement : 'Logro')}
                {achievement && Number.isFinite(achievement.season) ? <small>{`T${achievement.season}`}</small> : null}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}