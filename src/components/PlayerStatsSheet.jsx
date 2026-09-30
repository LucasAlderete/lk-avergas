// ============================================================================
// FICHA DE STATS — hoja modal desde abajo (mobile first)
// ============================================================================
// Por qué modal y no tooltip: en el celu no existe el hover, así que un tooltip
// no se puede abrir. Al tocar un jugador del Plantel sube esta hoja, que se
// opera con el pulgar y muestra los 6 atributos de FIFA + el OVR.
// El OVR es el promedio de esos 6 atributos YA con los votos (el mismo número
// que se ve en Plantel y Alineación). Ver displayRatingOf en voteRules.js.
import { useEffect, useRef } from 'react';
import { Medal, X } from 'lucide-react';

import { RATING_STATS } from '../data.js';
import { medalsOf } from '../matches/matchStory.js';
import useMatchHistory from '../matches/useMatchHistory.js';
import { photoOf } from '../playerPhotos.js';
import { displayRatingOf, displayStatOf } from '../voting/voteRules.js';
import PlayerAudioButton from './PlayerAudioButton.jsx';
import PlayerBanner from './PlayerBanner.jsx';

// Color por rango, como los medidores de FIFA.
const toneOf = (value) => (value >= 80 ? 'high' : value >= 65 ? 'mid' : value >= 50 ? 'low' : 'bad');

function StatRow({ stat, player }) {
  const value = displayStatOf(player, stat.key);
  return (
    <li className="stat-row">
      <span className="stat-label">{stat.label}</span>
      <span className="stat-bar">
        <span className={`stat-fill tone-${toneOf(value)}`} style={{ width: `${value}%` }} />
      </span>
      <b className="stat-value">{value}</b>
    </li>
  );
}

function PlayerMedals({ name }) {
  const { matches } = useMatchHistory({ eager: false });
  const medals = medalsOf(name, matches);
  return (
    <section className="player-medals" aria-label={`Medallas de ${name}`}>
      <h4>Medallero</h4>
      <ul>
        {medals.map((medal) => (
          <li key={medal.id} className={medal.earned ? 'is-earned' : 'is-locked'}>
            <Medal size={16} aria-hidden="true" />
            <span>{medal.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PlayerStatsSheet({ player, onClose }) {
  const closeRef = useRef(null);
  // Mismo cuidado que en VoteSheet: `onClose` es un arrow inline y cambia de
  // identidad en cada render. En un ref, para no re-disparar el efecto (y con
  // él el focus de la X, que hace saltar el scroll) al escribir en un input.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const playerName = player?.name;

  useEffect(() => {
    if (!playerName) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKeyDown);
    // Evita que la página de atrás siga scrolleando con la hoja abierta.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [playerName]);

  if (!player) return null;
  const overall = displayRatingOf(player);

  return (
    <>
      <div className="stats-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className={`stats-sheet${photoOf(player.name) ? ' is-banner' : ''}`} role="dialog" aria-modal="true" aria-label={`Cualidades de ${player.name}`}>
        <button ref={closeRef} type="button" className="stats-sheet-close" onClick={onClose} aria-label="Cerrar stats">
          <X size={18} />
        </button>

        <PlayerBanner player={player} />
        <header className={`stats-sheet-head${photoOf(player.name) ? ' is-over' : ''}`}>
          <span className="stats-ovr" aria-label={`OVR ${overall}`}>{overall}</span>
          <div>
            <h3>
              {player.name}
              {!photoOf(player.name) && <PlayerAudioButton name={player.name} />}
            </h3>
            <p>{player.lore?.perfil || player.phrase}</p>
          </div>
        </header>

        <ul className="stat-list">
          {RATING_STATS.map((stat) => <StatRow key={stat.key} stat={stat} player={player} />)}
        </ul>

        <PlayerMedals name={player.name} />

        <p className="stats-sheet-foot">El OVR es el promedio de los seis atributos.</p>
      </section>
    </>
  );
}