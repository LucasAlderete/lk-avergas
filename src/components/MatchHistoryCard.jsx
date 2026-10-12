import { useId, useState } from 'react';
import { Medal } from 'lucide-react';

import { ovrJump, resultLine } from '../matches/matchStory.js';
import { photoOf } from '../playerPhotos.js';

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

// El salto de OVR se lee como +2 / -1 grande; el "85 → 87" queda de detalle.
const deltaOf = (row) => {
  const delta = Number(row.to) - Number(row.from);
  if (!Number.isFinite(delta) || delta === 0) return '';
  return delta > 0 ? `+${delta}` : `${delta}`;
};

function SwingList({ title, tone, rows }) {
  if (!rows?.length) return null;
  return (
    <div className={`history-swing is-${tone}`}>
      <b>{title}</b>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span>{row.name}</span>
            <small>{ovrJump(row)}</small>
            <em>{deltaOf(row)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

// El MVP es el pico del partido: va arriba, con foto, como una carta.
function MvpHero({ names }) {
  if (!names.length) return null;
  const photos = names.map((name) => ({ name, photo: photoOf(name) }));
  return (
    <div className={`history-mvp${names.length > 1 ? ' is-shared' : ''}`}>
      <div className="history-mvp-photos" aria-hidden="true">
        {photos.map(({ name, photo }) => (
          <span key={name} className="history-mvp-photo">
            {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : name.slice(0, 2).toUpperCase()}
          </span>
        ))}
      </div>
      <div className="history-mvp-copy">
        <small><Medal size={14} aria-hidden="true" /> MVP</small>
        <strong>{names.join(' y ')}</strong>
      </div>
    </div>
  );
}

export default function MatchHistoryCard({ match }) {
  const [open, setOpen] = useState(false);
  const teamsId = useId();
  const blue = match.teams?.teamA || [];
  const red = match.teams?.teamB || [];
  const hasTeams = blue.length || red.length;
  const fallback = (match.players || []).join(', ');
  const canShowTeams = hasTeams || Boolean(fallback);
  const when = formatWhen(match.createdAt) || match.day;
  const mvp = match.mvp || [];
  const worst = match.worst || [];
  return (
    <article className="history-card">
      <header className="history-card-head">
        <p className="history-card-when">
          {when ? <span>{when}</span> : null}
          <span>Fútbol {match.mode}</span>
        </p>
        <strong>{resultLine(match.result)}</strong>
      </header>
      <MvpHero names={mvp} />
      {match.up?.length || match.down?.length ? (
        <div className="history-card-swings">
          <SwingList title="Subieron" tone="up" rows={match.up} />
          <SwingList title="Bajaron" tone="down" rows={match.down} />
        </div>
      ) : null}
      {worst.length ? <p className="history-worst">Peor: <b>{worst.join(', ')}</b></p> : null}
      {canShowTeams ? (
        <div className="history-card-roster">
          <button
            type="button"
            className="history-teams-toggle"
            aria-expanded={open}
            aria-controls={open ? teamsId : undefined}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Ocultar equipos' : 'Ver equipos'}
          </button>
          {/* Se monta recién al tocar (las formaciones no se ven hasta pedirlas)
              y se despliega con @starting-style en CSS. */}
          {open ? (
            <div className="history-teams-collapse">
              {hasTeams ? (
                <div id={teamsId} className="history-card-teams">
                  <TeamColumn label="Azul" tone="a" names={blue} />
                  <TeamColumn label="Rojo" tone="b" names={red} />
                </div>
              ) : (
                <p id={teamsId} className="history-team">
                  <b>Jugaron</b>
                  <span>{fallback || 'Sin datos'}</span>
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
