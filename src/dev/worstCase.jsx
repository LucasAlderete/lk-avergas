// ============================================================================
// DATOS DE PEOR CASO (solo desarrollo) — /break-ui
// ============================================================================
// Con `?data=worst|empty|one` en la URL, Plantel e Historial usan estos datos
// en vez de los reales, para ver qué se rompe con datos extremos pero creíbles.
// Nunca se activa en producción: todo pasa por `import.meta.env.DEV`.
// ============================================================================

export const DATA_MODES = ['demo', 'worst', 'empty', 'one'];

export function devDataMode() {
  if (!import.meta.env.DEV) return 'demo';
  try {
    const mode = new URLSearchParams(window.location.search).get('data');
    return DATA_MODES.includes(mode) ? mode : 'demo';
  } catch {
    return 'demo';
  }
}

// Reusa jugadores reales (con sus stats) y cambia solo lo que se renderiza en
// la fila, repartiendo un caso distinto en cada una de las primeras filas.
export function worstRoster(roster) {
  if (!roster.length) return roster;
  const pick = (i) => roster[i % roster.length];
  return [
    { ...pick(0), name: 'Juan Martín Fernández Etcheverry', phrase: 'Invitado de Gonzi, vino una sola vez y ya pide la 10' },
    { ...pick(1), phrase: 'Dice que jugó en las inferiores de un club de primera, que lo vio un ojeador europeo y que si no fuera por la rodilla estaría en Europa, pero lo cierto es que llega tarde a todos los partidos y pide cambio a los diez minutos.' },
    { ...pick(2), name: 'Jo', phrase: '' },
    { ...pick(3), rating: 99 },
    { ...pick(4), rating: 5 },
    { ...pick(5), name: 'Agustín Nuñez-Peñalba', phrase: 'Ñoño 🐐⚽🔥' },
    ...roster.slice(6),
  ];
}

const LONG = 'Juan Martín Fernández Etcheverry';

export const worstMatches = [
  {
    id: 'w1',
    createdAt: '2026-10-04T23:00:00Z',
    mode: 7,
    result: { winner: 'teamB', margin: 10 },
    teams: {
      teamA: ['Chino', 'Gonzi', 'Rui', 'Nahue', 'Lk', 'Emi', LONG],
      teamB: ['Sailor', 'Cru', 'Alan', 'Kike', 'JJ', 'Agustín Nuñez-Peñalba', 'Jo'],
    },
    up: [
      { name: LONG, from: 55, to: 61 },
      { name: 'Agustín Nuñez-Peñalba', from: 70, to: 72 },
      { name: 'Sailor', from: 79, to: 80 },
      { name: 'Cru', from: 71, to: 72 },
      { name: 'Kike', from: 69, to: 70 },
      { name: 'JJ', from: 80, to: 81 },
      { name: 'Jo', from: 9, to: 10 },
    ],
    down: [{ name: 'Gonzi', from: 99, to: 87 }],
    mvp: ['Sailor', 'Cru', LONG],
    worst: ['Chino', 'Gonzi', 'Rui', 'Nahue'],
  },
  {
    id: 'w2',
    createdAt: null,
    day: '',
    mode: 5,
    result: null,
    teams: { teamA: [], teamB: [] },
    players: [],
    up: [],
    down: [],
    mvp: [],
    worst: [],
  },
  {
    id: 'w3',
    createdAt: '2026-09-20T23:00:00Z',
    mode: 5,
    result: { winner: 'teamA', margin: 1 },
    teams: { teamA: ['Jo'], teamB: [] },
    up: [],
    down: [{ name: 'Jo', from: 10, to: 9 }],
    mvp: ['Jo'],
    worst: [],
  },
];

export function devMatches(realMatches) {
  const mode = devDataMode();
  if (mode === 'worst') return worstMatches;
  if (mode === 'empty') return [];
  if (mode === 'one') return worstMatches.slice(2);
  return realMatches;
}

export function devRoster(roster) {
  const mode = devDataMode();
  if (mode === 'worst') return worstRoster(roster);
  if (mode === 'empty') return [];
  if (mode === 'one') return roster.slice(0, 1);
  return roster;
}

// Selector fijo abajo al centro. Es chrome de desarrollo, no parte del diseño.
export function DevDataToggle() {
  if (!import.meta.env.DEV) return null;
  const current = devDataMode();
  const labels = { demo: 'Demo', worst: 'Peor caso', empty: 'Vacío', one: 'Uno' };
  const go = (mode) => {
    const url = new URL(window.location.href);
    if (mode === 'demo') url.searchParams.delete('data');
    else url.searchParams.set('data', mode);
    window.location.assign(url.toString());
  };
  return (
    <div style={{ position: 'fixed', zIndex: 9999, bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: '#d9d9d9', font: '12px system-ui, sans-serif' }}>
      {DATA_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => go(mode)}
          style={{ padding: '4px 10px', border: 0, borderRadius: 999, background: mode === current ? '#fff' : 'transparent', color: '#222', font: 'inherit', cursor: 'pointer' }}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  );
}
