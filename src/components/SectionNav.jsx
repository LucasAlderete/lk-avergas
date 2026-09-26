// Menú global de secciones. Cada handler es opcional para que la pantalla
// activa pueda omitir el suyo sin romper el render.
import { isFeatureEnabled } from '../navigation.js';

export function SectionNav({ current, onHome, onCareer, onSquad, onLineup }) {
  const sections = [
    { id: 'home', label: 'Inicio', onSelect: onHome },
    { id: 'career', label: 'Mi carrera', onSelect: onCareer },
    { id: 'squad', label: 'Plantel', onSelect: onSquad },
    { id: 'lineup', label: 'Alineación', onSelect: onLineup },
  ].filter((row) => isFeatureEnabled(row.id));

  return (
    <nav className="section-nav" aria-label="Navegación principal">
      {sections.map(({ id, label, onSelect }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            data-navigation={id}
            className={active ? 'is-active' : ''}
            onClick={active ? undefined : onSelect}
            aria-current={active ? 'page' : undefined}
            disabled={active}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export default SectionNav;
