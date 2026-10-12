// ============================================================================
// CAREER SETUP — "sin carrera": elegir jugador y arrancar (Paso 11A)
// ============================================================================
// Estado inicial del modo carrera (state === null en useCareer) más el caso
// "estado detenido" (flow arrancó sin career válida). Solo presenta los datos
// de data.js y dispara `start(player, { seed, difficulty })`; las validaciones
// y la creación real las hace flow.js/engine.js.
// ============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Play } from 'lucide-react';

import { players } from '../../../data';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../config.js';
import { safeNumber } from './careerFormat.js';
import CountryFlag from './CountryFlag.jsx';
import { photoOf } from '../../../playerPhotos.js';
import { POSITIONS, suggestedPosition } from '../config.js';
import { COUNTRIES } from '../../../data/careerWorld/countries.js';

const STEP_NAMES = ['Jugador', 'Identidad', 'Ritmo'];

export default function CareerSetup({
  onBack,
  onStart,
  initialStep = 1,
  stoppedReason,
  draftName,
  onDraftName,
  difficulty,
  onDifficulty,
  position,
  onPosition,
  nationality,
  onNationality,
  shirtNumber,
  onShirtNumber,
  busy,
}) {
  const list = Array.isArray(players) ? players : [];
  const [step, setStep] = useState(initialStep);
  const active = list.find((player) => player.name === draftName) || list[0] || null;

  return (
    <div className="career-setup">
      {stoppedReason ? (
        <p className="career-alert career-alert--danger">
          <AlertTriangle size={16} />
          La carrera anterior se trabó. Elegí un jugador y arrancá de nuevo.
        </p>
      ) : null}

      {/* Setup en pasos (como Copero): cada paso entra en una pantalla. */}
      <p className="career-setup-step" aria-live="polite">{`Paso ${step} de 3 · ${STEP_NAMES[step - 1]}`}</p>
      {step === 1 ? (
        <>
          <section className="career-section">
            <h2 className="career-block-title">¿Con quién jugás?</h2>
            <p className="career-section-note">
              Debutás a los 16 en un club de cantera, con OVR de pibe. Hasta dónde llegás lo deciden las temporadas.
            </p>
            <div className="career-picker">
              {list.map((player) => (
                <button
                  type="button"
                  key={player.name}
                  className={`career-player-chip${active && player.name === active.name ? ' is-active' : ''}`}
                  aria-pressed={Boolean(active && player.name === active.name)}
                  onClick={() => onDraftName(player.name)}
                >
                  <span className="career-player-avatar">
                    {photoOf(player.name)
                      ? <img src={photoOf(player.name)} alt="" loading="lazy" decoding="async" />
                      : player.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="career-player-body">
                    <strong>{player.name}</strong>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {step === 2 ? (
        <>
          {/* Identidad del jugador (como Copero): posición y nacionalidad. La
              nacionalidad define el país de las ofertas de cantera. */}
          <section className="career-section">
            <h2 className="career-block-title">Posición y número</h2>
            <label className="career-setup-number">
              <span>Número</span>
              <input
                className="career-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="99"
                value={shirtNumber}
                onChange={(event) => onShirtNumber(event.target.value)}
              />
            </label>
            <div className="career-setup-chips">
              {POSITIONS.map((pos) => {
                const selected = (position || (active ? suggestedPosition(active) : null)) === pos.id;
                return (
                  <button
                    type="button"
                    key={pos.id}
                    className={`career-setup-chip${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => onPosition(pos.id)}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="career-section">
            <h2 className="career-block-title">Nacionalidad</h2>
            <p className="career-section-note">Define de qué país te llegan las primeras ofertas.</p>
            <div className="career-setup-chips">
              {Object.entries(COUNTRIES).map(([code, country]) => (
                <button
                  type="button"
                  key={code}
                  className={`career-setup-chip${nationality === code ? ' is-active' : ''}`}
                  aria-pressed={nationality === code}
                  onClick={() => onNationality(code)}
                >
                  <CountryFlag code={code} size={16} /> {country.name}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <section className="career-section">
            <h2 className="career-block-title">Ritmo de la carrera</h2>
            <div className="career-setup-options">
              <div className="career-field">
                <div className="career-difficulties" role="group" aria-label="Ritmo de la carrera">
                  {DIFFICULTY_ORDER.map((id) => {
                    const info = DIFFICULTIES[id] || {};
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`career-difficulty${difficulty === id ? ' is-active' : ''}`}
                        aria-pressed={difficulty === id}
                        onClick={() => onDifficulty(id)}
                      >
                        <strong>{info.label || id}</strong>
                        <span>{info.description || ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="career-setup-actions">
              <button
                type="button"
                className="career-button career-button--primary career-button--block"
                onClick={onStart}
                disabled={Boolean(busy)}
              >
                Iniciar carrera <Play size={16} />
              </button>
            </div>
          </section>
        </>
      ) : null}

      <div className="career-setup-steps-nav">
        {step > 1 ? (
          <button type="button" className="career-button career-button--ghost" onClick={() => setStep(step - 1)}>
            Volver
          </button>
        ) : (
          <button type="button" className="career-button career-button--ghost" data-navigation="home" onClick={onBack}>
            Volver
          </button>
        )}
        {step < 3 ? (
          <button type="button" className="career-button career-button--primary" onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        ) : null}
      </div>
    </div>
  );
}