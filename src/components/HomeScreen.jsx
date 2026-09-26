import { BriefcaseBusiness, ChevronRight, ClipboardList, Users } from 'lucide-react';

import { isFeatureEnabled } from '../navigation.js';

const destinations = [
  {
    id: 'career',
    title: 'Mi carrera',
    description: 'Tu carrera profesional',
    icon: BriefcaseBusiness,
  },
  {
    id: 'squad',
    title: 'Plantel',
    description: 'Puntaje y frase de cada jugador',
    icon: Users,
  },
  {
    id: 'lineup',
    title: 'Alineación',
    description: 'Arrastrá a los jugadores por la cancha',
    icon: ClipboardList,
    wide: true,
  },
];

export default function HomeScreen({ onNavigate }) {
  // Las secciones apagadas en FEATURE_FLAGS no llegan ni a la lista.
  const visible = destinations.filter((row) => isFeatureEnabled(row.id));

  return (
    <main className="home-page">
      <header className="home-intro">
        <p className="eyebrow">Averga&apos;s Club</p>
        <h1>Inicio</h1>
        <p>Elegí dónde querés seguir.</p>
      </header>

      <section className="home-destinations" aria-label="Secciones disponibles">
        {visible.map(({ id, title, description, icon: Icon, wide }) => (
          <button
            key={id}
            type="button"
            className={`home-destination${wide ? ' home-destination--wide' : ''}`}
            data-navigation={id}
            onClick={() => onNavigate(id)}
          >
            <span className="home-destination-icon" aria-hidden="true">
              <Icon size={28} strokeWidth={1.8} />
            </span>
            <span className="home-destination-copy">
              <strong>{title}</strong>
            </span>
            <ChevronRight className="home-destination-arrow" size={22} aria-hidden="true" />
          </button>
        ))}
      </section>
    </main>
  );
}
