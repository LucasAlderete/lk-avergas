import { Medal } from 'lucide-react';

import { ovrJump, resultLine } from '../matches/matchStory.js';

function formatWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function TeamColumn({ label, tone, names }) {
  return (
    <div className={`history-team is-${tone}`}>
      <b>{label}</b>
      {names.length ? (
        <ul>
          {names.map((name) => <li key={name}>{name}</li>)}
        </ul>
      ) : (
        <p className="history-team-empty">Nadie</p>
      )}
    </div>
  );
}

function SwingList({ title, tone, rows }) {
  if (!rows?.length) return null;
  return (
    <div className={`history-swing is-${tone}`}>
      <b>{title}</b>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span>{row.name}</span>
            <em>{ovrJump(row)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MatchHistoryCard({ match }) {
  const blue = match.teams?.teamA || [];
  const red = match.teams?.teamB || [];
  const hasTeams = blue.length || red.length;
  return (
    <article className="history-card">
      <header className="history-card-head">
        <p className="history-card-when">{formatWhen(match.createdAt) || match.day}</p>
        <strong>{resultLine(match.result)}</strong>
        <small>Fútbol {match.mode}</small>
      </header>
      {hasTeams ? (
        <div className="history-card-teams">
          <TeamColumn label="Azul" tone="a" names={blue} />
          <TeamColumn label="Rojo" tone="b" names={red} />
        </div>
      ) : (
        <p className="history-team">
          <b>Jugaron</b>
          <span>{(match.players || []).join(', ') || '—'}</span>
        </p>
      )}
      <div className="history-card-swings">
        <SwingList title="Subieron" tone="up" rows={match.up} />
        <SwingList title="Bajaron" tone="down" rows={match.down} />
        {!match.up?.length && !match.down?.length ? (
          <p className="history-swing-empty">Nadie cambió de OVR en este partido.</p>
        ) : null}
      </div>
      <footer className="history-card-marks">
        <p className="history-mark is-mvp">
          <Medal size={14} aria-hidden="true" />
          MVP {(match.mvp || []).join(', ') || '—'}
        </p>
        <p className="history-mark is-worst">Peor {(match.worst || []).join(', ') || '—'}</p>
      </footer>
    </article>
  );
}
