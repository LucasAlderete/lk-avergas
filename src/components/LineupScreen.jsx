// ============================================================================
// ALINEACIÓN — la cancha con los jugadores y el drag and drop.
// Se separó de Plantel para que el roster (nombre, puntaje, frase) y la
// formación sean dos destinos distintos del menú.
// ============================================================================
import { useState } from 'react';

import { alignmentPlayers } from '../data.js';
import useVotes from '../voting/useVotes.js';
import LineupEditor from './LineupEditor.jsx';
import PlayerStatsSheet from './PlayerStatsSheet.jsx';
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
  const [, selectPlayer] = useSelectedPlayer();
  const [openName, setOpenName] = useState(null);
  const { alignmentRoster } = useVotes();
  const openPlayer = alignmentRoster.find((item) => item.name === openName)
    || alignmentPlayers.find((item) => item.name === openName)
    || null;

  return (
    <main className="page lineup-page">
      <LineupHeader onBack={onBack} onNavigate={onNavigate} />

      <LineupEditor
        onPlayerSelect={(name) => {
          selectPlayer(name);
          setOpenName(name);
        }}
      />
      <PlayerStatsSheet player={openPlayer} onClose={() => setOpenName(null)} />
    </main>
  );
}
