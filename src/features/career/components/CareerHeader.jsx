// ============================================================================
// CAREER HEADER — barra compacta del Modo Carrera (refactor UX)
// ============================================================================
// Barra única: volver + identidad mínima (nombre/edad/temporada) + navegación
// global integrada (Inicio/Mi carrera/Plantel). Solo presentación.
// ============================================================================

import { SectionNav } from '../../../components/SectionNav.jsx';
import { phaseLabel } from './careerFormat.js';

// Mismo título y menú de texto que el resto de la app (DESIGN.md), con las
// clases de SectionHeader. No usa SectionHeader en sí porque ese trae la cuenta
// (useAuth) y el modo carrera se renderiza también sin AuthProvider (smoke SSR).
export default function CareerHeader({ career, phase, onBack, onNavigate }) {
  const name = (career && career.name) || '';
  const age = Number.isFinite(career && career.age) ? `${career.age} años` : null;
  const season = Number.isFinite(career && career.season) ? `Temporada ${career.season}` : phaseLabel(phase);
  const subtitle = [name, age, season].filter(Boolean).join(' · ');
  const go = (id) => { if (typeof onNavigate === 'function') onNavigate(id); };

  return (
    <header className="section-header">
      <div>
        <h1>Mi carrera</h1>
        <p>{subtitle}</p>
      </div>
      <div className="section-header-tools">
        {/* Llamado como función (no tiene hooks) para que los botones queden en
            este árbol: el smoke de navegación recorre los onClick de CareerHeader. */}
        {SectionNav({
          current: 'career',
          onHome: onBack,
          onSquad: () => go('squad'),
          onLineup: () => go('lineup'),
          onHistory: () => go('history'),
        })}
      </div>
    </header>
  );
}
