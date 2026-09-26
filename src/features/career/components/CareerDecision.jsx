// ============================================================================
// CAREER DECISION — acciones del checkpoint (Modo Carrera, Paso 11A)
// ============================================================================
// Renderiza las acciones que flow.js declara válidas para el checkpoint
// vigente (`decisionOptions` del hook). El componente NO decide qué se puede
// hacer: solo dibuja botones grandes para las acciones recibidas y las dispara
// (`onAction(action)` → chooseAction en la pantalla; la temporada avanza sola
// en useCareer y este componente nunca dibuja un botón de avance).
//
// Acciones soportadas (FLOW_ACTIONS): stay · retire. 'advance_season' no es
// acción del jugador (la simula el hook) y 'transfer' vive en CareerDestinations.
// ============================================================================

import { motion } from 'framer-motion';
import { LogOut, ShieldCheck } from 'lucide-react';

const ACTION_VIEW = {
  stay: {
    icon: ShieldCheck,
    label: 'Seguir en el club',
    hint: 'Bonus lealtad',
    variant: '',
  },
  // NOTA: 'transfer' NO tiene entrada a propósito. Abrir el mercado dejó de ser
  // una acción del usuario: CareerScreen lo abre solo al llegar al checkpoint de
  // decisión y las ofertas se eligen en el selector de destino
  // (CareerDestinations: club actual + ofertas + retirarse). Así la UI nunca
  // vuelve a mostrar un botón "Ver ofertas" como paso intermedio.
  retire: {
    icon: LogOut,
    label: 'Retirarse',
    hint: 'Cierra la carrera',
    variant: 'career-action--danger',
  },
};

export default function CareerDecision({ options, retirementDue, onAction, busy, bare = false }) {
  const list = Array.isArray(options) ? options.filter((action) => ACTION_VIEW[action]) : [];
  if (list.length === 0) return null;
  const isBusy = (action) => busy === action || busy === true;
  const inner = (
    <>
      {retirementDue ? (
        <p className="career-alert career-alert--danger career-alert--tight">
          El cuerpo ya no aguanta otra temporada: la única decisión posible es el retiro.
        </p>
      ) : null}

      <div className={`career-actions career-actions--compact${list.length > 1 ? ' career-actions--duo' : ''}`}>
        {list.map((action, index) => {
          const view = ACTION_VIEW[action];
          const Icon = view.icon;
          return (
            <motion.button
              type="button"
              className={`career-action career-action--compact ${view.variant}${view.wide && list.length === 1 ? ' career-action--wide' : ''}`}
              key={action}
              onClick={() => onAction(action)}
              disabled={Boolean(busy)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.09), ease: 'easeOut' }}
            >
              <span className="career-action-icon"><Icon size={15} /></span>
              <span className="career-action-text">
                <span className="career-action-label">{isBusy(action) ? 'Procesando…' : view.label}</span>
                <span className="career-action-hint">{view.hint}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </>
  );
  if (bare) return inner;
  return (
    <section className="career-section">
      <div className="career-section-head">
        <span className="career-section-kicker"><ShieldCheck size={14} /> Qué hacemos</span>
        <h2 className="career-section-title">Tu decisión</h2>
      </div>
      {inner}
    </section>
  );
}