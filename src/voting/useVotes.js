// ============================================================================
// useVotes — junta las reglas con Mongo (vía API) y expone el roster dinámico
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth, readJSON } from '../auth/AuthContext.jsx';
import { alignmentPlayers } from '../data.js';
import {
  aggregateBallots,
  castVote,
  dynamicAlignmentRoster,
  dynamicRoster,
  remaining as remainingOf,
  spent as spentOf,
} from './voteRules.js';
import { castedVotes, castedVoters } from './voteStore.js';

export default function useVotes() {
  const { user } = useAuth();
  const [remoteBallots, setRemoteBallots] = useState([]);
  const [myBallot, setMyBallot] = useState({});
  const [remoteVoters, setRemoteVoters] = useState(0);
  const [matchVoters, setMatchVoters] = useState(0);
  const [match, setMatch] = useState(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchError, setMatchError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await readJSON('/api/votes');
      setRemoteBallots(Array.isArray(data.ballots) ? data.ballots : []);
      setMyBallot(data.myVotes && typeof data.myVotes === 'object' ? data.myVotes : {});
      setRemoteVoters(Number(data.voters) || 0);
      setMatchVoters(Number(data.matchVoters) || 0);
      setMatch(data.match || null);
    } catch {
      setRemoteBallots([]);
      setMyBallot({});
      setMatch(null);
    }
  }, []);

  useEffect(() => { load(); }, [load, user?.id]);

  const persist = useCallback(async (votes) => {
    const data = await readJSON('/api/votes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votes }),
    });
    setMyBallot(data.votes || votes);
    await load();
  }, [load]);

  const eligible = useMemo(() => match?.players || [], [match]);
  const matchOpen = match?.status === 'open';
  const canVote = Boolean(user) && matchOpen;

  const cast = useCallback((playerName, key, direction) => {
    if (!user || !matchOpen) return;
    if (!eligible.includes(playerName)) return;
    setMyBallot((current) => {
      const nextVotes = castVote(current, playerName, key, direction);
      if (nextVotes === current) return current;
      persist(nextVotes).catch((err) => {
        window.alert(err.message || 'No se pudo guardar el voto');
        load();
      });
      return nextVotes;
    });
  }, [user, matchOpen, eligible, persist, load]);

  const resetMyBallot = useCallback(async () => {
    if (!user || !matchOpen) return;
    try {
      await readJSON('/api/votes', { method: 'DELETE' });
      setMyBallot({});
      await load();
    } catch (err) {
      window.alert(err.message || 'No se pudo borrar el voto');
    }
  }, [user, matchOpen, load]);

  const openMatch = useCallback(async ({ players, mode }) => {
    setMatchBusy(true);
    setMatchError('');
    try {
      const data = await readJSON('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, mode }),
      });
      setMatch(data.match || null);
      await load();
    } catch (err) {
      setMatchError(err.message || 'No se pudo abrir el partido');
    } finally {
      setMatchBusy(false);
    }
  }, [load]);

  const closeMatch = useCallback(async (result) => {
    setMatchBusy(true);
    setMatchError('');
    try {
      await readJSON('/api/matches/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result ? { result } : {}),
      });
      setMatch(null);
      setMyBallot({});
      await load();
    } catch (err) {
      setMatchError(err.message || 'No se pudo cerrar el partido');
    } finally {
      setMatchBusy(false);
    }
  }, [load]);

  const deltas = useMemo(() => {
    const fromMongo = aggregateBallots(remoteBallots);
    const merged = {};
    for (const [name, votes] of Object.entries(castedVotes || {})) merged[name] = { ...votes };
    for (const [name, votes] of Object.entries(fromMongo)) {
      merged[name] = { ...(merged[name] || {}) };
      for (const [key, value] of Object.entries(votes)) {
        merged[name][key] = (merged[name][key] || 0) + value;
      }
    }
    return merged;
  }, [remoteBallots]);

  const roster = useMemo(() => dynamicRoster(deltas), [deltas]);
  const alignmentRoster = useMemo(() => dynamicAlignmentRoster(deltas, alignmentPlayers), [deltas]);

  return {
    deltas,
    roster,
    alignmentRoster,
    myBallot,
    cast,
    resetMyBallot,
    remaining: remainingOf(myBallot),
    spent: spentOf(myBallot),
    voters: Math.max(remoteVoters, 0) + castedVoters,
    matchVoters,
    match,
    matchBusy,
    matchError,
    openMatch,
    closeMatch,
    eligible,
    canVote,
  };
}
