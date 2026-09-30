import { Medal } from 'lucide-react';

import { resultLine } from '../matches/matchStory.js';

function formatWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function names(list) {
  if (!list?.length) return '—';
  return list.join(', ');
}

export default function MatchHistoryCard({ match }) {
  const blue = match.teams?.teamA || [];
  const red = match.teams?.teamB || [];
  return (
    <article className="history-card">
      <header className="history-card-head">
        <p className="history-card-when">{formatWhen(match.createdAt) || match.day}</p>
        <strong>{resultLine(match.result)}</strong>
        <small>Fútbol {match.mode}</small>
      </header>
      <div className="history-card-teams">
        {blue.length || red.length ? (
          <>
            <p className="history-team is-a">
              <b>Azul</b>
              <span>{names(blue)}</span>
            </p>
            <p className="history-team is-b">
              <b>Rojo</b>
              <span>{names(red)}</span>
            </p>
          </>
        ) : (
          <p className="history-team">
            <b>Jugaron</b>
            <span>{names(match.players)}</span>
          </p>
        )}
      </div>
      <footer className="history-card-marks">
        <p className="history-mark is-mvp">
          <Medal size={14} aria-hidden="true" />
          MVP {names(match.mvp)}
        </p>
        <p className="history-mark is-worst">Peor {names(match.worst)}</p>
      </footer>
    </article>
  );
}
