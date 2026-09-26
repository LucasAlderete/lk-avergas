// ============================================================================
// CAREER SETUP — "sin carrera": elegir jugador y arrancar (Paso 11A)
// ============================================================================
// Estado inicial del modo carrera (state === null en useCareer) más el caso
// "estado detenido" (flow arrancó sin career válida). Solo presenta los datos
// de data.js y dispara `start(player, { seed, difficulty })`; las validaciones
// y la creación real las hace flow.js/engine.js.
// ============================================================================

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Play, Shield, Sparkles, Trophy } from 'lucide-react';

import { players } from '../../../data';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../config.js';
import { worldMeta } from '../../../data/careerWorld.js';
import { safeNumber } from './careerFormat.js';

export default function CareerSetup({
  onBack,
  onStart,
  stoppedReason,
  draftName,
  onDraftName,
  difficulty,
  onDifficulty,
  seedInput,
  onSeedInput,
  busy,
}) {
  const list = Array.isArray(players) ? players : [];
  const active = list.find((player) => player.name === draftName) || list[0] || null;

  return (
    <div className="career-setup">
      <section className="career-setup-hero">
        <button type="button" data-navigation="home" className="career-icon-button" onClick={onBack} aria-label="Volver a inicio">
          <ArrowLeft size={18} />
        </button>
        <p className="career-setup-kicker" style={{ marginTop: '14px' }}>{`Mi carrera · ${worldMeta.name}`}</p>
        <h1 className="career-setup-title">Mi carrera</h1>
        <p className="career-setup-copy">
          Elegí quién protagoniza la historia y arrancá en la cantera. Cada temporada cambia tu OVR, tu valor de
          mercado y los clubes que te buscan. Tu partida se guarda automáticamente en este dispositivo.
        </p>
      </section>

      {stoppedReason ? (
        <p className="career-alert career-alert--danger">
          <AlertTriangle size={16} />
          {`La carrera anterior quedó detenida (${stoppedReason}). Elegí un jugador y arrancá de nuevo.`}
        </p>
      ) : null}

      <section className="career-section">
        <div className="career-section-head">
          <span className="career-section-kicker"><Shield size={14} /> Jugador</span>
        </div>
        <div className="career-picker">
          {list.map((player) => (
            <button
              type="button"
              key={player.name}
              className={`career-player-chip${active && player.name === active.name ? ' is-active' : ''}`}
              onClick={() => onDraftName(player.name)}
            >
              <span className="career-player-avatar">{player.name.slice(0, 2).toUpperCase()}</span>
              <span className="career-player-body">
                <strong>{player.name}</strong>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="career-section">
        <div className="career-section-head">
          <span className="career-section-kicker"><Sparkles size={14} /> Configuración</span>
          <span className="career-section-note">Solo cambia el ritmo de las decisiones</span>
        </div>
        <div className="career-setup-options">
          <div className="career-field" style={{ flex: '1 1 420px' }}>
            <span className="career-field-label">Dificultad</span>
            <div className="career-difficulties">
              {DIFFICULTY_ORDER.map((id) => {
                const info = DIFFICULTIES[id] || {};
                return (
                  <button
                    type="button"
                    key={id}
                    className={`career-difficulty${difficulty === id ? ' is-active' : ''}`}
                    onClick={() => onDifficulty(id)}
                  >
                    <strong>{info.label || id}</strong>
                    <span>{info.description || ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="career-field">
            <span className="career-field-label">Semilla (opcional)</span>
            <input
              className="career-input"
              value={seedInput}
              inputMode="numeric"
              onChange={(event) => onSeedInput(event.target.value)}
              placeholder="2026"
            />
          </label>
        </div>

        <div className="career-setup-actions" style={{ marginTop: '18px' }}>
          <span className="career-setup-note">
            <Trophy size={14} /> {`${worldMeta.clubs} clubes · ${worldMeta.countries} países · 3 divisiones`}
          </span>
          <button
            type="button"
            className="career-button career-button--primary"
            onClick={onStart}
            disabled={Boolean(busy)}
          >
            Iniciar carrera <Play size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}