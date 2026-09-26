// ============================================================================
// useVotes — junta las reglas con el almacenamiento y expone el roster dinámico
// ============================================================================
// `roster` y `alignmentRoster` traen el OVR ya recalculado con los votos de
// todos, así que Plantel y Alineación siempre muestran el número actual.
// Cuando se migre el storage a un backend, este hook es lo único que hay que
// tocar para empezar a refrescar desde el servidor.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { alignmentPlayers } from '../data.js';
import {
  aggregateBallots,
  castVote,
  clearBallot,
  dynamicAlignmentRoster,
  dynamicRoster,
  remaining as remainingOf,
  spent as spentOf,
} from './voteRules.js';
import { getVoterId, loadBallots, saveBallots, votersCount, castedVotes } from './voteStore.js';

export default function useVotes() {
  const [ballots, setBallots] = useState(loadBallots);
  const voterId = useMemo(getVoterId, []);

  // Cada cambio se guarda enseguida: si cerrás la app, el voto está.
  useEffect(() => { saveBallots(ballots); }, [ballots]);

  const myBallot = useMemo(
    () => ballots.find((row) => row.voterId === voterId)?.votes || {},
    [ballots, voterId],
  );

  const cast = useCallback((playerName, key, direction) => {
    setBallots((current) => {
      const mine = current.find((row) => row.voterId === voterId);
      const nextVotes = castVote(mine?.votes || {}, playerName, key, direction);
      // Misma referencia => la regla lo rechazó => no hay nada que guardar.
      if (nextVotes === (mine?.votes || {})) return current;
      return [...current.filter((row) => row.voterId !== voterId), { voterId, votes: nextVotes }];
    });
  }, [voterId]);

  // Los votos que ya aplicaste (informes de WhatsApp) + los de esta persona.
  const deltas = useMemo(() => {
    const local = aggregateBallots(ballots.map((row) => row.votes));
    const merged = {};
    for (const [name, votes] of Object.entries(castedVotes || {})) merged[name] = { ...votes };
    for (const [name, votes] of Object.entries(local)) {
      merged[name] = { ...(merged[name] || {}) };
      for (const [key, value] of Object.entries(votes)) {
        merged[name][key] = (merged[name][key] || 0) + value;
      }
    }
    return merged;
  }, [ballots]);
  const roster = useMemo(() => dynamicRoster(deltas), [deltas]);
  const alignmentRoster = useMemo(() => dynamicAlignmentRoster(deltas, alignmentPlayers), [deltas]);

  // Borrar todo lo que votó esta persona en este navegador, para empezar de
  // nuevo. No toca los votos compartidos que ya vienen aplicados.
  const resetMyBallot = useCallback(() => {
    setBallots((current) => clearBallot(current, voterId));
  }, [voterId]);

  return {
    deltas,
    roster,
    alignmentRoster,
    myBallot,
    cast,
    resetMyBallot,
    remaining: remainingOf(myBallot),
    spent: spentOf(myBallot),
    voters: votersCount(ballots),
  };
}