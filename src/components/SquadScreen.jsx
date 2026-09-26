// ============================================================================
// PLANTEL — el roster: nombre, OVR (dinámico, con los votos) y frase. Al tocar
// un jugador se abre su ficha de stats, o la hoja de votación en modo "Votar".
// La cancha con el drag and drop vive en la pantalla Alineación.
// ============================================================================
import { useState } from 'react';
import { Vote } from 'lucide-react';

import AccountBar from '../auth/AccountBar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import PlayerStatsSheet from './PlayerStatsSheet.jsx';
import SectionHeader from './SectionHeader.jsx';
import { useSelectedPlayer } from './playerSelection.js';
import ResetVoteButton from '../voting/ResetVoteButton.jsx';
import VoteSheet from '../voting/VoteSheet.jsx';
import useVotes from '../voting/useVotes.js';

export function SquadHeader({ onBack, onNavigate }) {
  return (
    <SectionHeader
      title="Plantel"
      subtitle="Tocá un jugador para ver sus stats."
      current="squad"
      onHome={onBack}
      onNavigate={onNavigate}
    />
  );
}

function PlayerCard({ player, active, onClick }) {
  return (
    <button
      type="button"
      className={`player-card${active ? ' is-active' : ''}`}
      data-player={player.name}
      onClick={onClick}
    >
      <span className="player-card-avatar" aria-hidden="true">{player.name.slice(0, 2).toUpperCase()}</span>
      <span className="player-card-copy">
        <strong>{player.name}</strong>
        <small>{player.phrase}</small>
      </span>
      <b>{player.rating}</b>
    </button>
  );
}

export default function SquadScreen({ onBack, onNavigate }) {
  const [selected, selectPlayer] = useSelectedPlayer();
  // El roster trae el OVR ya recalculado con los votos de todos.
  const { user } = useAuth();
  const { roster, deltas, myBallot, cast, remaining, resetMyBallot, voters, canVote } = useVotes();
  // La hoja se abre con un toque explícito: `selected` viene guardado del
  // storage, así que siguiéramos su valor se abriría sola al entrar.
  const [openName, setOpenName] = useState(null);
  const [voting, setVoting] = useState(false);
  const [voterLabel, setVoterLabel] = useState('');
  const openPlayer = roster.find((item) => item.name === openName) || null;

  const openStats = (name) => {
    selectPlayer(name);
    setOpenName(name);
  };

  return (
    <main className="page squad-page">
      <SquadHeader onBack={onBack} onNavigate={onNavigate} />

      <section className="squad-roster" aria-labelledby="squad-roster-title">
        <div className="section-heading">
          <div><h2 id="squad-roster-title">Jugadores</h2></div>
          <button
            type="button"
            className={`vote-toggle${voting ? ' is-active' : ''}`}
            onClick={() => {
              if (!canVote) {
                setVoting(false);
                document.getElementById('squad-login-gate')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
              }
              setVoting((current) => !current);
            }}
            aria-pressed={voting}
          >
            <Vote size={16} aria-hidden="true" />
            {voting ? 'Saliendo de votar' : 'Votar'}
            <b className="vote-toggle-left">{canVote ? remaining : '!'}</b>
          </button>
        </div>
        <div className="squad-vote-bar">
          <p className="squad-vote-hint">
            {!canVote
              ? 'Para puntuar tenés que entrar con Google.'
              : voting
                ? 'Tocá un jugador y repartí tus puntos. El OVR se recalcula con los votos de todos.'
                : `OVR según los votos de ${voters} ${voters === 1 ? 'persona' : 'personas'}.`}
          </p>
          {canVote ? <ResetVoteButton myBallot={myBallot} onReset={resetMyBallot} /> : null}
        </div>
        {!user && (
          <div className="login-gate" id="squad-login-gate">
            <p>Entrá con Google y recién ahí podés sumar o restar puntos.</p>
            <AccountBar />
          </div>
        )}

        <div className="squad-grid">
          {roster.map((player) => (
            <PlayerCard
              key={player.name}
              player={player}
              active={selected === player.name}
              onClick={() => openStats(player.name)}
            />
          ))}
        </div>
      </section>

      {voting && canVote
        ? (
          <VoteSheet
            player={openPlayer}
            deltas={deltas}
            myBallot={myBallot}
            onCast={cast}
            remaining={remaining}
            onClose={() => setOpenName(null)}
            voterLabel={voterLabel}
            onLabelChange={setVoterLabel}
            onReset={resetMyBallot}
          />
        )
        : <PlayerStatsSheet player={openPlayer} onClose={() => setOpenName(null)} />}
    </main>
  );
}

