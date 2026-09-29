// ============================================================================
// ALINEACIÓN — la cancha con los jugadores y el drag and drop.
// Se separó de Plantel para que el roster (nombre, puntaje, frase) y la
// formación sean dos destinos distintos del menú.
// ============================================================================
import LineupEditor from './LineupEditor.jsx';
import SectionHeader from './SectionHeader.jsx';
import { useSelectedPlayer } from './playerSelection.js';

export function LineupHeader({ onBack, onNavigate }) {
  return (
    <SectionHeader
      title="Alineación"
      subtitle="Armá los equipos: arrastrá, dos toques o mantené en el nombre."
      current="lineup"
      onHome={onBack}
      onNavigate={onNavigate}
    />
  );
}

export default function LineupScreen({ onBack, onNavigate }) {
  // Tocar un jugador en la cancha lo deja resaltado en el roster de Plantel.
  const [, selectPlayer] = useSelectedPlayer();

  return (
    <main className="page lineup-page">
      <LineupHeader onBack={onBack} onNavigate={onNavigate} />

      <LineupEditor onPlayerSelect={selectPlayer} />
    </main>
  );
}