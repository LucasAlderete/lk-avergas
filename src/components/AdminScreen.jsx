import { useEffect, useMemo, useState } from 'react';

import AccountBar from '../auth/AccountBar.jsx';
import { readJSON, useAuth } from '../auth/AuthContext.jsx';
import { resultLine } from '../matches/matchStory.js';
import MatchResultFields, { resultPayload } from './MatchResultFields.jsx';
import SectionHeader from './SectionHeader.jsx';
import { ballotSummary, spent } from '../voting/voteRules.js';

function formatWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function matchLabel(match) {
  if (!match) return '';
  const when = formatWhen(match.createdAt);
  const state = match.status === 'open' ? 'abierto' : 'cerrado';
  const votes = `${match.voters || 0} ${match.voters === 1 ? 'voto' : 'votos'}`;
  return `${when} · Fútbol ${match.mode} · ${state} · ${votes}`;
}

function VoterCard({ ballot }) {
  const rows = ballotSummary(ballot.votes);
  return (
    <article className="admin-voter">
      <header className="admin-voter-head">
        <strong>{ballot.name}</strong>
        {ballot.email ? <small>{ballot.email}</small> : null}
        <b>{spent(ballot.votes)} pts</b>
      </header>
      <ul className="admin-voter-list">
        {rows.map((row) => (
          <li key={row.player}>
            <span>le dio a <b>{row.player}</b></span>
            <span className="admin-voter-parts">
              {row.parts.map((part) => (
                <em key={part.key} className={part.delta > 0 ? 'is-up' : 'is-down'}>
                  {part.delta > 0 ? '+' : ''}{part.delta} {part.label}
                </em>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function AdminScreen({ onBack, onNavigate }) {
  const { user, ready } = useAuth();
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ winner: '', margin: 1 });
  const [saving, setSaving] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canSee = Boolean(user?.isAdmin);

  useEffect(() => {
    if (!ready || !canSee) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError('');
    readJSON('/api/admin/matches')
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data.matches) ? data.matches : [];
        setMatches(list);
        setSelectedId((current) => current || list[0]?.id || '');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'No se pudieron cargar los partidos');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ready, canSee]);

  useEffect(() => {
    if (!canSee || !selectedId) {
      setDetail(null);
      return undefined;
    }
    let alive = true;
    readJSON(`/api/admin/matches/${selectedId}`)
      .then((data) => { if (alive) setDetail(data); })
      .catch((err) => {
        if (!alive) return;
        setDetail(null);
        setError(err.message || 'No se pudo abrir el partido');
      });
    return () => { alive = false; };
  }, [canSee, selectedId]);

  useEffect(() => {
    const current = matches.find((row) => row.id === selectedId);
    if (current?.result) setDraft(current.result);
    else setDraft({ winner: '', margin: 1 });
    setAskingDelete(false);
  }, [selectedId, matches]);

  const selected = useMemo(
    () => matches.find((row) => row.id === selectedId) || detail?.match || null,
    [matches, selectedId, detail],
  );
  const ballots = detail?.ballots || [];

  const saveResult = async () => {
    const result = resultPayload(draft);
    if (!selectedId || !result) {
      setError('Decí quién ganó y por cuántos goles de diferencia');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = await readJSON(`/api/matches/${selectedId}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      setMatches((current) => current.map((row) => (
        row.id === selectedId ? { ...row, result: data.match?.result || result } : row
      )));
    } catch (err) {
      setError(err.message || 'No se pudo guardar el resultado');
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async () => {
    if (!selectedId) return;
    setDeleting(true);
    setError('');
    try {
      await readJSON(`/api/matches/${selectedId}`, { method: 'DELETE' });
      const leftover = matches.filter((row) => row.id !== selectedId);
      setMatches(leftover);
      setSelectedId(leftover[0]?.id || '');
      setDetail(null);
      setAskingDelete(false);
    } catch (err) {
      setError(err.message || 'No se pudo borrar el partido');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="page admin-page">
      <SectionHeader
        title="Votos"
        subtitle="Elegí un partido y mirá quién le dio puntos a quién."
        current="admin"
        onHome={onBack}
        onNavigate={onNavigate}
      />

      {!canSee ? (
        <div className="login-gate">
          <p>Sólo el admin puede ver esto.</p>
          <AccountBar compact />
        </div>
      ) : (
        <section className="admin-panel" aria-labelledby="admin-match-title">
          <div className="section-heading">
            <div><h2 id="admin-match-title">Partidos</h2></div>
          </div>

          {loading ? <p className="admin-empty">Cargando partidos…</p> : null}
          {error ? <p className="match-bar-error">{error}</p> : null}

          {!loading && !matches.length ? (
            <p className="admin-empty">Todavía no hay partidos. Abrí uno desde Alineación.</p>
          ) : null}

          {matches.length ? (
            <label className="admin-select">
              Partido
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>{matchLabel({ ...match })}</option>
                ))}
              </select>
            </label>
          ) : null}

          {selected ? (
            <p className="admin-match-meta">
              {selected.status === 'open' ? 'Abierto' : 'Cerrado'}
              {' · '}{resultLine(selected.result)}
              {' · '}jugaron {selected.players.join(', ') || 'nadie'}
            </p>
          ) : null}

          {selected ? (
            <div className="admin-result">
              <MatchResultFields value={draft} onChange={setDraft} disabled={saving || deleting} />
              <div className="admin-result-actions">
                <button type="button" className="match-bar-btn" disabled={saving || deleting} onClick={saveResult}>
                  {saving ? 'Guardando…' : 'Guardar resultado'}
                </button>
                {askingDelete ? (
                  <span className="vote-reset-confirm" role="alert">
                    <b>¿Borrar este partido y sus votos?</b>
                    <button type="button" className="is-yes" disabled={deleting} onClick={deleteMatch}>
                      {deleting ? 'Borrando…' : 'Sí'}
                    </button>
                    <button type="button" disabled={deleting} onClick={() => setAskingDelete(false)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="admin-delete-btn" disabled={saving || deleting} onClick={() => setAskingDelete(true)}>
                    Borrar partido
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {selected && !ballots.length ? (
            <p className="admin-empty">Nadie cargó puntos en este partido.</p>
          ) : null}

          <div className="admin-voters">
            {ballots.map((ballot) => (
              <VoterCard key={`${ballot.email}|${ballot.name}|${ballot.updatedAt || ''}`} ballot={ballot} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
