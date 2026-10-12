// CAREER TIMELINE — trayectoria completa (estructura tipo Copero)
// SOLO presentación: filas desde career.seasonHistory + fila actual + futuro.
// - Una fila por tramo de decisión (2 en 2 en ritmo Normal), como Copero;
//   el OVR de la fila es el del COMIENZO del tramo.
// - Todas las edades hasta el retiro ya dibujadas (se llena como un álbum).
// - Cada fila se tiñe con el color del club y la edad lleva ese color de fondo.
// - OVR en un círculo, un solo valor (el del final del tramo), coloreado por
//   nivel: alto / medio / bajo.
// - La tabla scrollea sola (alto máximo) para que la decisión quede a la vista,
//   y se acomoda en la última fila jugada.
// NO inventa stats futuras: las filas futuras van apagadas y sin números.

import { useEffect, useRef } from 'react';
import { ArrowDown, HeartPulse } from 'lucide-react';

import { ovrTier, reportClubVisual, safeNumber, statText } from './careerFormat.js';
import { AGE } from '../config.js';
import { NATIONAL_TEAMS, readNationalTeam, stageLabel } from '../nationalTeam.js';
import CountryFlag from './CountryFlag.jsx';
import TrophyArt from './TrophyArt.jsx';
import { CalendarSheet, FootballBoot, Jersey, SoccerBall } from './statIcons.jsx';


const sum = (list, key) => list.reduce((acc, row) => acc + (Number.isFinite(row && row[key]) ? row[key] : 0), 0);

/** Agrupa las temporadas jugadas en tramos de `size` (una fila por tramo). */
function groupSeasons(seasons, size) {
  const sorted = [...seasons].sort((a, b) => safeNumber(a.season, 0) - safeNumber(b.season, 0));
  const groups = [];
  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    const last = chunk[chunk.length - 1];
    groups.push({
      key: `${chunk[0].season}-${i}`,
      age: chunk[0].age,
      club: last.club,
      ovr: chunk[0].ovrStart,
      pj: sum(chunk, 'pj'),
      gls: sum(chunk, 'gls'),
      ast: sum(chunk, 'ast'),
      cleanSheets: sum(chunk, 'cleanSheets'),
      trophies: chunk.flatMap((row) => (Array.isArray(row.trophies) ? row.trophies : [])),
      injury: chunk.some((row) => row.injury),
      relegated: chunk.some((row) => row.relegated),
      suspended: chunk.some((row) => row.suspended),
      national: chunk.map((row) => row.nationalTeam).find((nt) => nt && nt.called) || null,
      worldCup: chunk.map((row) => row.nationalTeam && row.nationalTeam.worldCup).find(Boolean) || null,
    });
  }
  return groups;
}

/** Número con su ícono chico a la izquierda (PJ / GLS / AST). */
function StatCell({ icon: Icon, value }) {
  return (
    <span className="career-table-num career-table-stat" aria-hidden="true">
      <Icon size={14} aria-hidden="true" />
      {statText(value)}
    </span>
  );
}

/** Total de carrera: ícono + número (la etiqueta queda en el title). */
function TotalCell({ icon: Icon, value, label }) {
  return (
    <span className="career-table-num career-total-cell" aria-hidden="true" title={`${safeNumber(value)} ${label}`}>
      <span className="career-total-value"><Icon size={14} aria-hidden="true" />{safeNumber(value)}</span>
    </span>
  );
}

function OvrDot({ value }) {
  return (
    <span className={`career-ovr-dot is-${ovrTier(value)}`}>{Number.isFinite(value) ? value : '–'}</span>
  );
}

function ClubCell({ club, children }) {
  return (
    <span className="career-table-club" title={club.name} aria-hidden="true">
      {club.crestSrc
        ? <img className="career-table-crest" src={club.crestSrc} alt="" loading="lazy" />
        : <i className="career-table-crest is-empty" aria-hidden="true" />}
      <span className="career-table-club-name">{club.name}</span>
      {children}
    </span>
  );
}

export default function CareerTimeline({ career, phase }) {
  const scrollRef = useRef(null);
  const seasons = career && Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
  const isGK = career && career.position === 'ARQ';
  const step = Math.max(1, (career && career.difficultyInfo && career.difficultyInfo.seasonsPerDecision) || 1);
  const currentAge = Number.isFinite(career && career.age) ? career.age : null;
  const needsDecisionRow = phase === 'decision' || phase === 'transfer' || phase === 'event';
  // Una fila por tramo de decisión (2 en 2 en ritmo Normal), jugadas y
  // futuras, igual que Copero.
  const groups = groupSeasons(seasons, step);

  // Acompaña la reproducción: cada vez que entra una temporada (o llega la
  // decisión) baja solo hasta la última fila jugada, así no hay que scrollear
  // para seguir lo que pasa.
  const lastSeasonPartial = seasons.length > 0 && Boolean(seasons[seasons.length - 1].partial);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const rows = box.querySelectorAll(
      '.career-table-row--played, .career-table-row--current, .career-table-row--decision',
    );
    const row = rows[rows.length - 1];
    if (!row) return;
    // La fila queda a ~75% de la altura visible (con pocas filas no se mueve).
    const bottom = row.offsetTop + row.offsetHeight;
    const top = Math.max(0, bottom - box.clientHeight * 0.75);
    let smooth = true;
    try { smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { smooth = true; }
    if (typeof box.scrollTo === 'function') box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    else box.scrollTop = top;
  }, [seasons.length, lastSeasonPartial, needsDecisionRow]);

  if (seasons.length === 0 && currentAge === null) return null;

  const retired = Boolean(career && career.retired);
  // Futuro: las próximas dos filas del álbum y el resto en una sola línea, así
  // en el celular la decisión no queda debajo de diez filas vacías.
  const futureAges = [];
  if (currentAge !== null && !retired) {
    for (let age = currentAge + step; age < AGE.RETIRE; age += step) futureAges.push(age);
  }
  const shownFuture = futureAges.slice(0, 2);
  const pjLabel = isGK ? 'vallas invictas' : 'goles';
  const currentClub = reportClubVisual(career && career.club);
  const stats = (career && career.careerStats) || {};

  return (
    <section className="career-table-card" aria-label="Trayectoria de la carrera">
      {/* Lista para lectores de pantalla: cada fila se anuncia completa con su
          aria-label; las celdas visuales quedan ocultas para no leerse sueltas. */}
      <div className="career-table career-table--scroll" role="list" aria-label="Temporadas jugadas" ref={scrollRef}>
        <div className="career-table-row career-table-row--head" aria-hidden="true">
          <span>EDAD</span><span>CLUB</span><span>OVR</span>
          <span>PJ</span><span>{isGK ? 'VI' : 'GLS'}</span><span>AST</span>
        </div>
        {groups.map((group) => {
          const club = reportClubVisual(group.club);
          const flags = (group.injury || group.trophies.length > 0 || group.national || group.relegated || group.suspended) ? (
            <i className="career-table-flags">
              {group.relegated ? <span className="career-flag-down" title="Descendió"><ArrowDown size={10} strokeWidth={3} aria-label="Descenso" /></span> : null}
              {group.suspended ? <span className="career-flag-susp" title="Suspendido">SUSP</span> : null}
              {group.national ? (
                <span title={group.worldCup ? `Mundial ${group.worldCup.season}: ${stageLabel(group.worldCup.stage)}` : 'Convocado a la Selección'}>
                  <CountryFlag code={group.national.team} size={11} />
                </span>
              ) : null}
              {group.injury ? <HeartPulse size={11} aria-label="Lesión" /> : null}
              {/* Las copas ganadas en el tramo, en miniatura y en la misma línea. */}
              {group.trophies.map((trophy, i) => (
                <span key={`${trophy.trophyId || trophy.type}-${i}`} className="career-table-cup" title={`${trophy.label} ${trophy.season || ''}`.trim()}>
                  <TrophyArt trophy={trophy} />
                </span>
              ))}
            </i>
          ) : null;
          return (
            <div
              className="career-table-row career-table-row--played"
              role="listitem"
              aria-label={[
                `${statText(group.age)} años, ${club.name}`,
                `OVR ${statText(group.ovr)}`,
                `${safeNumber(group.pj)} partidos, ${safeNumber(isGK ? group.cleanSheets : group.gls)} ${pjLabel}, ${safeNumber(group.ast)} asistencias`,
                group.trophies.length > 0 ? `${group.trophies.length} ${group.trophies.length === 1 ? 'título' : 'títulos'}` : null,
                group.injury ? 'lesión' : null,
                group.relegated ? 'descenso' : null,
                group.suspended ? 'suspendido' : null,
                group.national ? 'convocado a la Selección' : null,
              ].filter(Boolean).join('. ')}
              key={group.key}
              style={{ '--club': club.primary }}
            >
              <span className="career-table-age" aria-hidden="true">{statText(group.age)}</span>
              <ClubCell club={club}>{flags}</ClubCell>
              <span className="career-table-num" aria-hidden="true"><OvrDot value={group.ovr} /></span>
              <StatCell icon={Jersey} value={group.pj} />
              <StatCell icon={SoccerBall} value={isGK ? group.cleanSheets : group.gls} />
              <StatCell icon={FootballBoot} value={group.ast} />
            </div>
          );
        })}

        {/* Si la última temporada se está llenando (animación), ella ES la
            fila actual: no se duplica la edad. */}
        {currentAge !== null && !retired && !(seasons.length > 0 && seasons[seasons.length - 1].partial) ? (
          <div
            className={`career-table-row ${needsDecisionRow ? 'career-table-row--decision' : 'career-table-row--current'}`}
            role="listitem"
            aria-label={`${statText(currentAge)} años, ${needsDecisionRow || !(career && career.club) ? 'decidiendo' : `ahora en ${currentClub.name}`}. OVR ${statText(career && career.ovr)}`}
            style={career && career.club ? { '--club': currentClub.primary } : undefined}
          >
            <span className="career-table-age" aria-hidden="true">{statText(currentAge)}</span>
            {needsDecisionRow || !(career && career.club) ? (
              <span className="career-table-club" aria-hidden="true">{career && career.club ? 'Decidiendo…' : 'Eligiendo club…'}</span>
            ) : (
              <ClubCell club={currentClub}><i className="career-table-now">AHORA</i></ClubCell>
            )}
            <span className="career-table-num" aria-hidden="true"><OvrDot value={career && career.ovr} /></span>
            <span className="career-table-num" />
            <span className="career-table-num" />
            <span className="career-table-num" />
          </div>
        ) : null}

        {shownFuture.map((age) => (
          <div className="career-table-row career-table-row--future" key={`futura-${age}`} aria-hidden="true">
            <span className="career-table-age">{age}</span>
            <span className="career-table-club" />
            <span className="career-table-num" />
            <span className="career-table-num" />
            <span className="career-table-num" />
            <span className="career-table-num" />
          </div>
        ))}
        <NationalRow career={career} />
      </div>

      {/* Totales de la carrera, siempre visibles debajo de la tabla. */}
      <div
        className="career-table-row career-table-row--total"
        role="group"
        aria-label={`Total: ${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'}, ${safeNumber(stats.pj)} partidos, ${safeNumber(isGK ? stats.cleanSheets : stats.gls)} ${pjLabel}, ${safeNumber(stats.ast)} asistencias`}
      >
        <span className="career-table-age" />
        <span className="career-table-club career-total-label">
          <CalendarSheet size={16} aria-hidden="true" />
          {`${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'}`}
        </span>
        <span className="career-table-num" />
        <TotalCell icon={Jersey} value={stats.pj} label="partidos" />
        <TotalCell icon={SoccerBall} value={isGK ? stats.cleanSheets : stats.gls} label={isGK ? 'vallas' : 'goles'} />
        <TotalCell icon={FootballBoot} value={stats.ast} label="asist." />
      </div>
    </section>
  );
}

/** Fila de la Selección al pie de la tabla (como Copero): apagada hasta la
 *  primera convocatoria; después suma partidos y goles, con los Mundiales. */
function NationalRow({ career }) {
  const nt = readNationalTeam(career);
  const name = (NATIONAL_TEAMS[nt.team] || {}).name || nt.team;
  const called = nt.caps > 0;
  const best = [...nt.worldCups].sort((a, b) => b.season - a.season);
  const title = best.length > 0
    ? best.map((c) => `Mundial ${c.season}: ${stageLabel(c.stage)}`).join(' · ')
    : (called ? 'Convocado a la Selección' : 'Todavía sin convocatoria');
  return (
    <div
      className={`career-table-row career-table-row--national${called ? '' : ' is-off'}`}
      role="listitem"
      aria-label={called ? `${name}: ${nt.caps} partidos, ${nt.goals} goles. ${title}` : `${name}: ${title}`}
      title={title}
    >
      <span className="career-table-age career-table-age--flag"><CountryFlag code={nt.team} size={18} /></span>
      <span className="career-table-club">
        <span className="career-table-club-name">{name}</span>
        {/* Solo los Mundiales ganados, como copitas (el resto queda en el title). */}
        {nt.worldCups.some((c) => c.champion) ? (
          <i className="career-table-flags">
            {nt.worldCups.filter((c) => c.champion).map((c) => (
              <span key={c.season} className="career-table-cup" title={`Campeón del Mundo ${c.season}`}>
                <TrophyArt trophy={{ trophyId: 'worldcup', icon: '🌎' }} />
              </span>
            ))}
          </i>
        ) : null}
      </span>
      <span className="career-table-num" />
      <StatCell icon={Jersey} value={nt.caps} />
      <StatCell icon={SoccerBall} value={nt.goals} />
      <span className="career-table-num">–</span>
    </div>
  );
}
