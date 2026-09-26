import { playedFromLineup } from './lineupRules.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function MatchBar({ lineup, match, openMatch, closeMatch, matchBusy, matchError }) {
  const { user } = useAuth();
  const played = playedFromLineup(lineup);
  const canOpen = played.length >= 2 && !matchBusy;

  if (user?.isAdmin) {
    return (
      <div className="match-bar">
        {match ? (
          <>
            <p>
              Partido abierto · se vota en Plantel a {match.players.join(', ')}.
            </p>
            <button type="button" className="match-bar-btn is-close" disabled={matchBusy} onClick={() => closeMatch()}>
              {matchBusy ? 'Cerrando…' : 'Cerrar partido'}
            </button>
          </>
        ) : (
          <>
            <p>
              {played.length < 2
                ? 'Poné al menos 2 del plantel en la cancha para abrir el partido.'
                : `Listos ${played.length} del plantel. Al abrir, cada uno tiene 5 puntos nuevos.`}
            </p>
            <button type="button" className="match-bar-btn" disabled={!canOpen} onClick={() => openMatch({ players: played, mode: lineup.mode })}>
              {matchBusy ? 'Abriendo…' : 'Abrir partido'}
            </button>
          </>
        )}
        {matchError ? <p className="match-bar-error">{matchError}</p> : null}
      </div>
    );
  }

  if (match) {
    return (
      <div className="match-bar">
        <p>Hay partido abierto. Entrá a Plantel y votá a los que jugaron.</p>
      </div>
    );
  }

  return (
    <div className="match-bar is-idle">
      <p>No hay partido abierto. Cuando el admin lo abra, se puede puntuar.</p>
    </div>
  );
}
