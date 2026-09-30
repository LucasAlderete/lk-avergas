import { useId } from 'react';

import { parseResult } from '../matches/matchStory.js';

export default function MatchResultFields({ value, onChange, disabled = false }) {
  const formId = useId();
  const winner = value?.winner || '';
  const margin = value?.margin ?? 1;
  const group = `match-winner-${formId}`;

  const setWinner = (next) => {
    if (next === 'draw') onChange({ winner: 'draw', margin: 0 });
    else onChange({ winner: next, margin: Math.max(1, Number(margin) || 1) });
  };

  return (
    <fieldset className="match-result-fields" disabled={disabled}>
      <legend>Resultado</legend>
      <p className="match-result-hint">Por diferencia, no el 5-2. Si ganó el rojo 6-2, es rojo por 4.</p>
      <div className="match-result-sides">
        <label>
          <input type="radio" name={group} checked={winner === 'teamA'} onChange={() => setWinner('teamA')} />
          Ganó azul
        </label>
        <label>
          <input type="radio" name={group} checked={winner === 'teamB'} onChange={() => setWinner('teamB')} />
          Ganó rojo
        </label>
        <label>
          <input type="radio" name={group} checked={winner === 'draw'} onChange={() => setWinner('draw')} />
          Empate
        </label>
      </div>
      {winner && winner !== 'draw' ? (
        <label className="match-result-margin">
          Goles de diferencia
          <input
            type="number"
            min="1"
            max="20"
            value={margin}
            onChange={(event) => onChange({ winner, margin: Number(event.target.value) })}
          />
        </label>
      ) : null}
    </fieldset>
  );
}

export function resultPayload(value) {
  return parseResult(value);
}
