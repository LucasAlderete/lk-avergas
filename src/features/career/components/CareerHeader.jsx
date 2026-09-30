// ============================================================================
// CAREER HEADER — barra compacta del Modo Carrera (refactor UX)
// ============================================================================
// Barra única: volver + identidad mínima (nombre/edad/temporada) + navegación
// global integrada (Inicio/Mi carrera/Plantel). Solo presentación.
// ============================================================================

import { motion } from 'framer-motion';
import { ArrowLeft, ClipboardList, History, Home, UserRound, Users } from 'lucide-react';

import { isFeatureEnabled } from '../../../navigation.js';
import { phaseLabel } from './careerFormat.js';

export default function CareerHeader({ career, phase, onBack, onNavigate }) {
  const name = (career && career.name) || 'Mi carrera';
  const age = Number.isFinite(career && career.age) ? `${career.age} años` : null;
  const season = Number.isFinite(career && career.season) ? `Temporada ${career.season}` : phaseLabel(phase);
  const go = (id) => { if (typeof onNavigate === 'function') onNavigate(id); };

  // Esta barra tiene su propio nav en vez de usar SectionNav (acá van íconos).
  // El filtro por flag se repite para que "Mi carrera" no quede con un botón
  // hacia una pantalla que la app no abre.
  const barNav = [
    { id: 'home', label: 'Inicio', Icon: Home },
    { id: 'career', label: 'Mi carrera', Icon: UserRound },
    { id: 'squad', label: 'Plantel', Icon: Users },
    { id: 'lineup', label: 'Alineación', Icon: ClipboardList },
    { id: 'history', label: 'Historial', Icon: History },
  ].filter((row) => isFeatureEnabled(row.id));

  return (
    <motion.header
      className="career-header career-header--bar"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="career-bar">
        <button
          type="button"
          className="career-icon-button"
          onClick={onBack}
          data-navigation="home"
          aria-label="Volver a inicio"
          title="Volver a inicio"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="career-bar-id">
          <span className="career-bar-title">Mi carrera</span>
          <span className="career-bar-sub">
            {name}
            {age ? ` · ${age}` : ''}
            <span className="career-bar-season"> · {season}</span>
          </span>
        </div>
        <nav className="career-bar-nav" aria-label="Navegación de carrera">
          {barNav.map(({ id, label, Icon }) => (
            <button key={id} type="button" data-navigation={id} onClick={() => go(id)} title={label}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
