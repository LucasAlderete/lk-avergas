// ============================================================================
// HOJA DE VOTACIÓN — bottom sheet (mobile first), reutiliza el patrón de la
// ficha de stats. Al tocar un jugador en modo "Votar" se abre acá.
// Muestra el OVR dinámico (ya con los votos de todos) y deja sumar o restar
// punto por atributo, con los límites: 5 puntos por persona, 2 por jugador.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

import { RATING_STATS } from '../data.js';
import { photoOf } from '../playerPhotos.js';
import PlayerBanner from '../components/PlayerBanner.jsx';
import ResetVoteButton from './ResetVoteButton.jsx';
import { buildReport } from './voteReport.js';
import { POINTS_PER_PLAYER, TOTAL_POINTS, canCast, costOfPlayer } from './voteRules.js';

const toneOf = (value) => (value >= 80 ? 'high' : value >= 65 ? 'mid' : value >= 50 ? 'low' : 'bad');

// Copia al portapapeles con un plan B para navegadores viejos / http.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* seguimos con el plan B */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function VoteRow({ stat, value, myDelta, onCast, playerName, myBallot, disabled }) {
  const vote = (direction) => onCast(playerName, stat.key, direction);
  const block = (direction) => (disabled ? 'Ya no te quedan puntos' : canCast(myBallot, playerName, stat.key, direction).reason);

  return (
    <li className="stat-row">
      <span className="stat-label">{stat.label}</span>
      <span className="stat-bar">
        <span className={`stat-fill tone-${toneOf(value)}`} style={{ width: `${value}%` }} />
      </span>
      <b className="stat-value">
        {value}
        {myDelta ? <em className={myDelta > 0 ? 'is-up' : 'is-down'}>{myDelta > 0 ? `+${myDelta}` : myDelta}</em> : null}
      </b>
      <span className="vote-buttons">
        <button
          type="button"
          className="vote-btn"
          onClick={() => vote(-1)}
          disabled={!canCast(myBallot, playerName, stat.key, -1).ok}
          title={block(-1)}
          aria-label={`Restar un punto de ${stat.label} a ${playerName}`}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="vote-btn"
          onClick={() => vote(1)}
          disabled={!canCast(myBallot, playerName, stat.key, 1).ok}
          title={block(1)}
          aria-label={`Sumar un punto de ${stat.label} a ${playerName}`}
        >
          <Plus size={16} />
        </button>
      </span>
    </li>
  );
}

export default function VoteSheet({ player, deltas, myBallot, onCast, remaining, onClose, voterLabel, onLabelChange, onReset }) {
  const closeRef = useRef(null);
  const [copied, setCopied] = useState('');
  // `onClose` llega como arrow inline desde Plantel: cambia de identidad en cada
  // render. Si fuera dependencia del efecto, escribir una letra en el input lo
  // volvería a disparar, y el focus() de la X haría scroll hacia arriba. Va en
  // un ref y el efecto depende sólo de qué jugador está abierto.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const playerName = player?.name;

  useEffect(() => {
    if (!playerName) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [playerName]);

  if (!player) return null;
  const used = costOfPlayer(myBallot?.[player.name]);
  const all = deltas?.[player.name] || {};
  const mine = myBallot?.[player.name] || {};
  const noPoints = remaining <= 0;

  const report = buildReport(myBallot, voterLabel);
  const state = copied === 'ok' ? 'ok' : copied === 'fail' ? 'fail' : '';

  const copy = async () => setCopied(await copyText(report) ? 'ok' : 'fail');

  // Abre WhatsApp con el informe ya escrito. No hace falta número: wa.me abre
  // el selector de contactos y vos elegís a quién mandárselo (el grupo, por
  // ejemplo). En el celu abre la app; en la compu, WhatsApp Web.
  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="stats-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className={`stats-sheet${photoOf(player.name) ? ' is-banner' : ''}`} role="dialog" aria-modal="true" aria-label={`Votar a ${player.name}`}>
        <button ref={closeRef} type="button" className="stats-sheet-close" onClick={onClose} aria-label="Cerrar votación">
          <X size={18} />
        </button>

        <PlayerBanner player={player} />
        <header className={`stats-sheet-head${photoOf(player.name) ? ' is-over' : ''}`}>
          <span className="stats-ovr" aria-label={`OVR ${player.rating}`}>{player.rating}</span>
          <div>
            <h3>{player.name}</h3>
            <p className="vote-budget">
              Te quedan <b>{remaining}</b> de {TOTAL_POINTS} · a este jugador {used}/{POINTS_PER_PLAYER}
            </p>
          </div>
        </header>

        {noPoints && <p className="vote-warning">No te quedan puntos. Podés ver los votos de todos igual.</p>}

        <ul className="stat-list">
          {RATING_STATS.map((stat) => (
            <VoteRow
              key={stat.key}
              stat={stat}
              playerName={player.name}
              value={player.attributes[stat.key]}
              myDelta={mine[stat.key] || 0}
              myBallot={myBallot}
              deltas={all}
              onCast={onCast}
              disabled={noPoints}
            />
          ))}
        </ul>

        <div className="vote-report">
          <label className="vote-report-label" htmlFor="voter-label">Tu nombre (para el informe)</label>
          <input
            id="voter-label"
            className="vote-report-input"
            value={voterLabel}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="Ej: Lucas"
            maxLength={24}
          />
          <div className="vote-report-actions">
            <button type="button" className="vote-report-send" onClick={share}>
              Mandar por WhatsApp
            </button>
            <button type="button" className="vote-report-copy" onClick={copy}>
              {state === 'ok' ? '¡Copiado!' : state === 'fail' ? 'No se pudo copiar' : 'Copiar código'}
            </button>
          </div>
          <code className="vote-report-code">{report}</code>
          <p className="vote-report-hint">
            Mandalo por WhatsApp al grupo. Quien junta los informes corre el script y el OVR queda
            igual para todos.
          </p>
          {onReset && <ResetVoteButton myBallot={myBallot} onReset={onReset} />}
        </div>

        <p className="stats-sheet-foot">Máximo {POINTS_PER_PLAYER} puntos por jugador y {TOTAL_POINTS} en total. El OVR se recalcula con los votos de todos.</p>
      </section>
    </>
  );
}