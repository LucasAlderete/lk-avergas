import { BriefcaseBusiness, ChevronRight, ClipboardList, History, ListChecks, Users } from 'lucide-react';

import AccountBar from '../auth/AccountBar.jsx';
import { useIsAdmin } from '../auth/AuthContext.jsx';
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
  {
    id: 'history',
    title: 'Historial',
    description: 'Quién ganó por diferencia, el MVP y el peor',
    icon: History,
    wide: true,
  },
  {
    id: 'admin',
    title: 'Votos',
    description: 'Quién le dio puntos a quién, partido por partido',
    icon: ListChecks,
    adminOnly: true,
    wide: true,
  },
];

export function HomeDestinations({ onNavigate, isAdmin = false }) {
  const visible = destinations.filter((row) => (
    row.adminOnly ? isAdmin : isFeatureEnabled(row.id)
  ));

  return (
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
            <small>{description}</small>
          </span>
          <ChevronRight className="home-destination-arrow" size={22} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

export default function HomeScreen({ onNavigate }) {
  const isAdmin = useIsAdmin();

  return (
    <main className="home-page">
      <header className="home-intro">
        <p className="eyebrow">Averga&apos;s Club</p>
        <h1>Inicio</h1>
        <p>Elegí dónde querés seguir.</p>
        <AccountBar />
      </header>
      <HomeDestinations onNavigate={onNavigate} isAdmin={isAdmin} />
    </main>
  );
}
