// ============================================================================
// CAREER SEASON REPORT — resumen deportivo de la temporada (Paso 11A)
// ============================================================================
// Muestra el `seasonReport` que publica el motor (simulateSeason / flow):
// temporada, club, partidos, goles, asistencias, evolución del OVR, lesiones y
// títulos. Sin cálculos propios: todo sale del reporte.
// ============================================================================

import { motion } from 'framer-motion';
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Shield, Target, Trophy, TrendingUp } from 'lucide-react';

import {
  divisionName,
  leagueName,
  reportClubVisual,
  roleLabel,
  safeNumber,
  signed,
  statText,
} from './careerFormat.js';
import { stageLabel } from '../nationalTeam.js';
import ClubBadge from './ClubBadge.jsx';
import CountryFlag from './CountryFlag.jsx';

export default function CareerSeasonReport({ report, retirementDue, compact = false }) {
  if (!report || typeof report !== 'object') return null;

  const club = reportClubVisual(report.club);
  const isGK = report.position === 'ARQ';
  const delta = safeNumber(report.ovrDelta, 0);
  const growth = safeNumber(report.growthDelta, 0);
  const injuryDelta = safeNumber(report.injuryDelta, 0);
  const trophies = Array.isArray(report.trophies) ? report.trophies : [];

  return (
    <motion.section
      className={`career-section${compact ? ' career-section--compact' : ' career-section--accent'}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="career-section-head">
        <span className="career-section-kicker"><Activity size={14} /> {compact ? `T${statText(report.season)} · qué pasó` : 'Resumen de temporada'}</span>
        {!compact && <h2 className="career-section-title">{`Temporada ${statText(report.season)}`}</h2>}
      </div>

      <div className="career-report-club">
        <ClubBadge
          club={club}
          size="sm"
          style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }}
        />
        <div>
          <strong>
            {club.name}
            {club.countryCode ? <>{' '}<CountryFlag code={club.countryCode} size={13} /></> : null}
          </strong>
          <span>{`${leagueName(club, club.division)} · ${roleLabel(report.role)}${Number.isFinite(report.age) ? ` · ${report.age} años` : ''}`}</span>
        </div>
      </div>

      <div className="career-report-grid">
        <div className="career-report-cell">
          <span className="career-report-label">Partidos</span>
          <strong className="career-report-value">{statText(report.pj)}</strong>
        </div>
        <div className="career-report-cell">
          <span className="career-report-label">{isGK ? 'Vallas' : 'Goles'}</span>
          <strong className="career-report-value">{statText(isGK ? report.cleanSheets : report.gls)}</strong>
        </div>
        <div className="career-report-cell">
          <span className="career-report-label">Asistencias</span>
          <strong className="career-report-value">{statText(report.ast)}</strong>
        </div>
        <div className="career-report-cell">
          <span className="career-report-label">OVR final</span>
          <strong className="career-report-value">{statText(report.ovrEnd)}</strong>
        </div>
      </div>

      <div className="career-report-flags">
        <span className={`career-delta${delta > 0 ? ' career-delta--up' : delta < 0 ? ' career-delta--down' : ''}`}>
          {delta > 0 ? <ArrowUp size={14} /> : delta < 0 ? <ArrowDown size={14} /> : <TrendingUp size={14} />}
          {`OVR ${statText(report.ovrStart)} → ${statText(report.ovrEnd)} (${signed(delta)})`}
        </span>

        {growth !== 0 ? (
          <span className="career-chip">{`Progreso ${signed(growth)}`}</span>
        ) : null}

        {report.injury ? (
          <span className="career-chip career-chip--warn">
            <AlertTriangle size={13} />
            {`${(report.injury && report.injury.label) || 'Lesión'}${injuryDelta !== 0 ? ` (${signed(injuryDelta)} OVR)` : ''}`}
          </span>
        ) : null}

        {trophies.map((trophy, index) => (
          <span className="career-chip career-chip--gold" key={`${(trophy && trophy.type) || 'titulo'}-${index}`}>
            <Trophy size={13} />
            {(trophy && trophy.label) || 'Título'}
          </span>
        ))}

        {report.nationalTeam ? (
          <span className="career-chip">
            <CountryFlag code={report.nationalTeam.team} size={13} />
            {`Selección: ${statText(report.nationalTeam.caps)} PJ · ${statText(report.nationalTeam.goals)} goles`}
          </span>
        ) : null}

        {report.nationalTeam && report.nationalTeam.firstCall ? (
          <span className="career-chip career-chip--gold">
            <Shield size={13} /> Primera convocatoria
          </span>
        ) : null}

        {report.nationalTeam && report.nationalTeam.qualifier ? (
          <span className={`career-chip${report.nationalTeam.qualifier.qualified ? '' : ' career-chip--warn'}`}>
            {`Eliminatorias: ${report.nationalTeam.qualifier.qualified ? 'clasificó' : 'no clasificó'} al Mundial ${report.nationalTeam.qualifier.season}`}
          </span>
        ) : null}

        {report.nationalTeam && report.nationalTeam.worldCup ? (
          <span className="career-chip career-chip--gold">
            <Trophy size={13} />
            {`Mundial ${report.nationalTeam.worldCup.season}: ${stageLabel(report.nationalTeam.worldCup.stage)}`}
          </span>
        ) : null}

        {report.lowRotationPenalty ? (
          <span className="career-chip career-chip--warn">
            <Shield size={13} /> Poca rotación acumulada
          </span>
        ) : null}

        {(report.mandatoryRetirement || retirementDue) ? (
          <span className="career-chip career-chip--warn">
            <Target size={13} /> {`Edad límite alcanzada${isGK ? ' para arqueros' : ''}: llega el retiro`}
          </span>
        ) : null}
      </div>
    </motion.section>
  );
}