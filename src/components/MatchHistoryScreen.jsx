import MatchHistoryCard from './MatchHistoryCard.jsx';
import SectionHeader from './SectionHeader.jsx';
import useMatchHistory from '../matches/useMatchHistory.js';

export default function MatchHistoryScreen({ onBack, onNavigate }) {
  const { matches, loading, error } = useMatchHistory();

  return (
    <main className="page history-page">
      <SectionHeader
        title="Historial"
        subtitle="Resultados por diferencia, MVP y el peor de cada partido."
        current="history"
        onHome={onBack}
        onNavigate={onNavigate}
      />

      {loading ? <p className="admin-empty">Cargando partidos…</p> : null}
      {error ? <p className="match-bar-error">{error}</p> : null}
      {!loading && !matches.length ? (
        <p className="admin-empty">Todavía no hay partidos cerrados. Cuando el admin cierre uno, aparece acá.</p>
      ) : null}

      <section className="history-list" aria-label="Partidos jugados">
        {matches.map((match) => (
          <MatchHistoryCard key={match.id} match={match} />
        ))}
      </section>
    </main>
  );
}
