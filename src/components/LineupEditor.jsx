import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Star } from 'lucide-react';

import { alignmentPlayers, players, poolOf, POOL } from '../data.js';
import { readJSON } from '../auth/AuthContext.jsx';
import useVotes from '../voting/useVotes.js';
import MatchBar from './MatchBar.jsx';
import PlayerAudioButton from './PlayerAudioButton.jsx';
import {
  addToPitch,
  benchByPool,
  beginDragRecord,
  canPlaceOnPitch,
  changeMode as buildMode,
  clampToPitch,
  countByTeam,
  DEFAULT_INJURIES,
  dropPlayer,
  findSlot,
  freshLineup,
  MODES,
  normalizeLineup,
  removeFromPitch,
  sizeForMode,
  teamForY,
} from './lineupRules.js';

const statusAngles = [0, 45, 90, 135, 180];
// Nombre de cada estado, para poder saber de un vistazo dónde apunta.
const statusLabels = ['Arriba', 'Arriba-derecha', 'Derecha', 'Abajo-derecha', 'Abajo'];
const lineupKey = 'avergas-lineup-v2';
const injuryKey = 'avergas-injuries-v3';
const statusKey = 'avergas-player-status-v1';

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function load(key, fallback) {
  try {
    const value = storage()?.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* sigue en memoria */ }
}

function StatusArrow({ status, onClick, playerName }) {
  const angle = statusAngles[status - 1] ?? 0;
  const label = statusLabels[status - 1] || statusLabels[0];
  return (
    <span
      className={`status-arrow status-${status}`}
      // Sin esto, el click en la flecha dispara el pointerdown del botón de
      // arriba: el arrastre captura el puntero y el click nunca llega acá.
      onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); }}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      role="button"
      tabIndex={0}
      title={`${playerName}: ${label}`}
      aria-label={`Estado de ${playerName}: ${label}. Click para cambiar.`}
      data-status={status}
      data-player={playerName}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 2 L20 11 L15.5 11 L15.5 22 L8.5 22 L8.5 11 L4 11 Z" fill="currentColor" transform={`rotate(${angle} 12 12)`} />
      </svg>
    </span>
  );
}

export default function LineupEditor({ onPlayerSelect }) {
  const [lineup, setLineup] = useState(() => normalizeLineup(load(lineupKey, null)));
  // `settled` marca al jugador recién soltado: para ese render framer NO anima.
  // Sin esto, framer parte del valor viejo que tiene guardado (no conoce lo que
  // pintamos a mano durante el arrastre) y el jugador "vuela" desde su lugar de
  // partida hasta el de destino. Los demás sí crisspan con el resorte.
  const [settled, setSettled] = useState(null);
  // `dragged` sólo existe para el estilo del jugador en la cancha; el ghost es
  // el token que sigue al cursor.
  // La posición vive en dragRef y se pinta a mano: durante el arrastre NO hay
  // re-render de React (ni escrituras al storage) en ningún momento.
  const [dragged, setDragged] = useState(null);
  // Ghost = el token que sigue al cursor. Guarda nombre y equipo para el color.
  const [ghost, setGhost] = useState(null);
  const [injured, setInjured] = useState(() => load(injuryKey, DEFAULT_INJURIES));
  const [statuses, setStatuses] = useState(() => load(statusKey, {}));
  const pitchRef = useRef(null);
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const ghostRef = useRef(null);
  const lineupRef = useRef(lineup);
  const suppressClickRef = useRef(false);
  const pendingRef = useRef(null);
  const lastTapRef = useRef(null);
  const selectTimerRef = useRef(null);
  const onPlayerSelectRef = useRef(onPlayerSelect);
  onPlayerSelectRef.current = onPlayerSelect;
  const [menu, setMenu] = useState(null);
  // Espejo del lineup para poder leer el estado actual desde los listeners
  // (que se registran una sola vez) sin volver a suscribirse.
  lineupRef.current = lineup;

  useEffect(() => { save(lineupKey, lineup); }, [lineup]);
  useEffect(() => { save(injuryKey, injured); }, [injured]);
  useEffect(() => { save(statusKey, statuses); }, [statuses]);

  const remoteReadyRef = useRef(false);
  const skipRemotePutRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fromServer = false;
      let gotOk = false;
      try {
        const data = await readJSON('/api/lineup');
        gotOk = true;
        if (cancelled) return;
        if (data.lineup && Array.isArray(data.lineup.slots)) {
          fromServer = true;
          skipRemotePutRef.current = true;
          setLineup(normalizeLineup(data.lineup));
        }
      } catch {
        // Sin API nos quedamos con lo del navegador y no pisamos el server.
      }
      if (cancelled) return;
      remoteReadyRef.current = true;
      if (gotOk && !fromServer) {
        const current = lineupRef.current;
        readJSON('/api/lineup', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: current.mode, slots: current.slots }),
        }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!remoteReadyRef.current) return;
    if (skipRemotePutRef.current) {
      skipRemotePutRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      readJSON('/api/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: lineup.mode, slots: lineup.slots }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [lineup]);
  // El "no animar" dura un sólo render: en el siguiente ya vuelve el resorte.
  useEffect(() => {
    if (!settled) return undefined;
    const frame = requestAnimationFrame(() => setSettled(null));
    return () => cancelAnimationFrame(frame);
  }, [settled]);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMenu(null);
    };
    const onDown = (event) => {
      if (event.target.closest('.lineup-action-menu')) return;
      setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [menu]);

  const byName = (name) => alignmentPlayers.find((item) => item.name === name) || alignmentPlayers[0];
  const isInjured = (name) => injured.includes(name);
  const toggleInjury = (name) => setInjured((current) => (
    current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
  ));
  const statusFor = (name) => statuses[name] || ((alignmentPlayers.findIndex((item) => item.name === name) % 5) + 1);
  // Un click en la flecha pasa al estado siguiente (1 -> 2 -> ... -> 5 -> 1).
  const cycleStatus = (name) => {
    setStatuses((current) => ({ ...current, [name]: ((statusFor(name) % 5) + 1) }));
  };
  const pools = benchByPool(lineup);
  const benchCount = pools.squad.length + pools.randoms.length + pools.premium.length;
  const counts = countByTeam(lineup);
  const teamSize = sizeForMode(lineup.mode);

  const changeMode = (nextMode) => setLineup((current) => buildMode(current, nextMode));

  // Soltar / sacar: acá recién se toca el estado. Durante el arrastre no.
  // Devuelve si el drop se aceptó: si la regla lo rechaza (mitad llena), el
  // jugador vuelve a su casilla.
  const applyDrop = (name, x, y) => {
    const current = lineupRef.current;
    const next = dropPlayer(current, name, x, y);
    if (next === current) return false;
    setSettled(name);
    setLineup(next);
    return true;
  };

  const takeOffPitch = (name) => setLineup((current) => removeFromPitch(current, name));

  const placeOnPitch = (name) => {
    const current = lineupRef.current;
    const next = addToPitch(current, name);
    if (next === current) return false;
    setSettled(name);
    setLineup(next);
    return true;
  };

  const poolTone = (name) => {
    const pool = poolOf(byName(name));
    if (pool === POOL.premium) return 'ultra';
    if (pool === POOL.randoms) return 'randoms';
    return 'squad';
  };

  const clearSelectTimer = () => {
    if (!selectTimerRef.current) return;
    window.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = null;
  };

  const clearPendingTimer = () => {
    const pending = pendingRef.current;
    if (!pending?.longPress) return;
    window.clearTimeout(pending.longPress);
    pending.longPress = null;
  };

  // --- Arrastre (receta de Red Blob Games: making-of/draggable) ---------------
  // 1) La posición se guarda en una variable (dragRef), no en el estado.
  // 2) Se pinta sólo en un requestAnimationFrame, como máximo uno pendiente.
  // 3) Pointer capture en el pointerdown: seguimos recibiendo eventos aunque el
  //    puntero se salga del elemento o de la ventana.
  // 4) Al soltar se fuerza el último frame, así no queda una posición vieja.

  // Salida: mueve el DOM sin pasar por React.
  // - Arrastrando desde la lista: siempre se ve el ghost bajo el cursor.
  // - Arrastrando un jugador de la cancha: se mueve normal dentro de la
  //   cancha, pero al SACARLO de la cancha aparece el ghost (si no, el
  //   `clamp` lo dejaría clavado en el borde y parecería que no pasa nada).
  const paint = (drag, clientX, clientY) => {
    const [rawX, rawY] = [
      ((clientX - drag.rect.left) / drag.rect.width) * 100 - drag.offsetX,
      ((clientY - drag.rect.top) / drag.rect.height) * 100 - drag.offsetY,
    ];
    const [x, y] = clampToPitch(rawX, rawY);
    drag.x = x;
    drag.y = y;

    const outside = clientX < drag.rect.left || clientX > drag.rect.right
      || clientY < drag.rect.top || clientY > drag.rect.bottom;

    // El ghost acompaña al cursor cuando viene de la lista o cuando el
    // jugador salió de la cancha.
    if (ghostRef.current) {
      ghostRef.current.style.left = `${clientX}px`;
      ghostRef.current.style.top = `${clientY}px`;
      ghostRef.current.style.display = drag.source === 'bench' || outside ? '' : 'none';
    }

    if (drag.source === 'pitch') {
      const node = nodeRefs.current.get(drag.name);
      if (node) {
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        // Fuera de la cancha lo sigue el ghost: el original queda invisible.
        node.style.opacity = outside ? '0' : '';
      }
    }
  };

  // Si el drop no se acepta (fuera de la cancha, encima de LESIONADOS...) el
  // jugador quedó pintado a mano: hay que devolverlo a su posición real, porque
  // framer no reescribe el estilo si el valor de destino no cambió.
  const restore = (drag) => {
    if (drag.source !== 'pitch') return;
    const node = nodeRefs.current.get(drag.name);
    const spot = findSlot(lineupRef.current, drag.name);
    if (node && spot) {
      node.style.left = `${spot.x}%`;
      node.style.top = `${spot.y}%`;
      node.style.opacity = '';
    }
  };

  const paintOnFrame = () => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.frame = null;
    paint(drag, drag.clientX, drag.clientY);
  };

  const actionsRef = useRef({});
  actionsRef.current = { applyDrop, takeOffPitch, placeOnPitch };

  const startDragFromPending = (event, pending) => {
    clearPendingTimer();
    const { payload, rect, startX, startY, pointerId } = pending;
    dragRef.current = {
      ...beginDragRecord(lineupRef.current, payload, rect, startX, startY),
      pointerId,
      moved: true,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    setDragged(payload);
    const spot = findSlot(lineupRef.current, payload.name);
    setGhost({
      name: payload.name,
      source: payload.source,
      team: teamForY(spot ? spot.y : 20),
      tone: poolTone(payload.name),
    });
    if (event.cancelable) event.preventDefault();
    if (dragRef.current.frame == null) dragRef.current.frame = requestAnimationFrame(paintOnFrame);
  };

  const armPointer = (event, payload) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu(null);
    clearPendingTimer();
    const pending = {
      payload,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      openedMenu: false,
      longPress: null,
    };
    pending.longPress = window.setTimeout(() => {
      if (pendingRef.current !== pending) return;
      pending.openedMenu = true;
      pending.longPress = null;
      try { navigator.vibrate?.(12); } catch { /* desktop */ }
      setMenu({ name: payload.name, source: payload.source, x: pending.startX, y: pending.startY });
    }, 520);
    pendingRef.current = pending;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* navegador sin soporte */ }
  };

  const startDragRef = useRef(startDragFromPending);
  startDragRef.current = startDragFromPending;
  const paintOnFrameRef = useRef(paintOnFrame);
  paintOnFrameRef.current = paintOnFrame;

  useEffect(() => {
    const onMove = (event) => {
      const pending = pendingRef.current;
      if (pending && !dragRef.current) {
        if (pending.openedMenu) return;
        if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) < 6) return;
        startDragRef.current(event, pending);
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (event.cancelable) event.preventDefault();
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      if (drag.frame == null) drag.frame = requestAnimationFrame(() => paintOnFrameRef.current());
    };

    const onUp = (event) => {
      const pending = pendingRef.current;
      const drag = dragRef.current;
      clearPendingTimer();
      pendingRef.current = null;

      if (drag) {
        dragRef.current = null;
        try { event.target.releasePointerCapture?.(drag.pointerId); } catch { /* no estaba capturado */ }
        if (drag.frame != null) {
          cancelAnimationFrame(drag.frame);
          drag.frame = null;
          paint(drag, event.clientX, event.clientY);
        }
        setDragged(null);
        setGhost(null);
        if (!drag.moved) return;
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);

        const listRect = listRef.current?.getBoundingClientRect();
        const overList = listRect
          && event.clientX >= listRect.left && event.clientX <= listRect.right
          && event.clientY >= listRect.top && event.clientY <= listRect.bottom;
        if (overList) {
          if (drag.source === 'pitch') actionsRef.current.takeOffPitch(drag.name);
          return;
        }

        const { rect } = drag;
        const inside = event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) {
          restore(drag);
          return;
        }
        if (!actionsRef.current.applyDrop(drag.name, drag.x, drag.y)) restore(drag);
        return;
      }

      if (!pending || pending.openedMenu) return;
      try { event.target.releasePointerCapture?.(pending.pointerId); } catch { /* no estaba capturado */ }

      const { name, source } = pending.payload;
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && last.name === name && last.source === source && now - last.at < 340) {
        lastTapRef.current = null;
        clearSelectTimer();
        if (source === 'pitch') actionsRef.current.takeOffPitch(name);
        else actionsRef.current.placeOnPitch(name);
        return;
      }
      lastTapRef.current = { name, source, at: now };
      clearSelectTimer();
      selectTimerRef.current = window.setTimeout(() => {
        selectTimerRef.current = null;
        if (suppressClickRef.current) return;
        onPlayerSelectRef.current?.(name);
      }, 300);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const resetLineup = () => setLineup(freshLineup());
  const closeMenu = () => setMenu(null);
  const menuAdd = () => {
    if (menu?.name) placeOnPitch(menu.name);
    closeMenu();
  };
  const menuRemove = () => {
    if (menu?.name) takeOffPitch(menu.name);
    closeMenu();
  };

  const renderPlayer = (slot) => {
    const { name, x, y } = slot;
    const isDragged = dragged?.source === 'pitch' && dragged.name === name;
    const isSettled = settled === name;
    const tone = poolTone(name);
    return (
      <motion.button
        type="button"
        className={`five-player${teamForY(y) === 'teamB' ? ' team-b-player' : ''}${isDragged || isSettled ? ' dragging' : ''}${tone === 'ultra' ? ' is-ultra' : ''}${tone === 'randoms' ? ' is-randoms' : ''}`}
        animate={{ left: `${x}%`, top: `${y}%` }}
        transition={isDragged || isSettled ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 34, mass: .22 }}
        key={name}
        ref={(node) => {
          if (node) nodeRefs.current.set(name, node);
          else nodeRefs.current.delete(name);
        }}
        onPointerDown={(event) => armPointer(event, { source: 'pitch', name })}
        onContextMenu={(event) => event.preventDefault()}
        whileTap={{ scale: .9 }}
        aria-label={`${name}, ${rated(name).rating}`}
      >
        {tone === 'ultra' && <Star className="five-player-star" size={13} fill="currentColor" aria-hidden="true" />}
        <PlayerAudioButton name={name} className="five-player-audio" />
        <small>{rated(name).rating}</small>
        <span className="five-player-label" aria-hidden="true">{byName(name).name}</span>
        {!isInjured(name) && <StatusArrow status={statusFor(name)} onClick={() => cycleStatus(name)} playerName={name} />}
        {isInjured(name) && <span className="injury-badge" aria-label="Lesionado" />}
      </motion.button>
    );
  };

  const renderAvailable = (item) => {
    const tone = poolTone(item.name);
    return (
      <div className={`available-player-row${tone === 'ultra' ? ' is-ultra' : ''}${tone === 'randoms' ? ' is-randoms' : ''}`} key={item.name}>
        <button
          type="button"
          onPointerDown={(event) => armPointer(event, { source: 'bench', name: item.name })}
          onContextMenu={(event) => event.preventDefault()}
        >
          <strong>{item.name.slice(0, 2).toUpperCase()}</strong>
          <span className="available-player-name">
            {item.name}
            {tone === 'ultra' && <Star className="ultra-star" size={13} fill="currentColor" aria-hidden="true" />}
            <PlayerAudioButton name={item.name} />
          </span>
          <small>{rated(item.name).rating}</small>
          {!isInjured(item.name) && <StatusArrow status={statusFor(item.name)} onClick={() => cycleStatus(item.name)} playerName={item.name} />}
        </button>
      </div>
    );
  };

  // Los lesionados son sólo del Plantel real: los "Random" no se pueden marcar.
  const injuredPlayers = players.filter((item) => isInjured(item.name));
  // El OVR que se ve en la cancha también es el dinámico (con los votos).
  const { alignmentRoster: votedRoster, match, openMatch, closeMatch, matchBusy, matchError } = useVotes();
  const rated = (name) => votedRoster.find((item) => item.name === name) || byName(name);

  return (
    <section className="lineup-editor" aria-labelledby="lineup-title">
      <div className="section-heading">
        <div><h2 id="lineup-title">Formación</h2></div>
      </div>

      <div className="formation-tabs">
        <label className="sport-select">
          Modalidad
          <select value={lineup.mode} onChange={(event) => changeMode(Number(event.target.value))}>
            {MODES.map((mode) => <option key={mode} value={mode}>{`Fútbol ${mode}`}</option>)}
          </select>
        </label>
        <button type="button" onClick={resetLineup} aria-label="Restablecer alineación"><RotateCcw size={20} /></button>
      </div>

      <MatchBar
        lineup={lineup}
        match={match}
        openMatch={openMatch}
        closeMatch={closeMatch}
        matchBusy={matchBusy}
        matchError={matchError}
      />

      <section className="five-match-board">
        <div className="shared-pitch" ref={pitchRef}>
          <div className="pitch-count">
            <span className="pitch-count-a">{counts.teamA}/{teamSize}</span>
            <span className="pitch-count-b">{counts.teamB}/{teamSize}</span>
          </div>
          <div className="five-goal top-goal" /><div className="five-goal bottom-goal" />
          <div className="five-midline" /><div className="five-circle" />
          {lineup.slots.map((slot) => renderPlayer(slot))}
          {!lineup.slots.length && <p className="empty-pitch">Arrastrá, dos toques o mantené para armar la cancha.</p>}
        </div>
      </section>

      <section className="available-players" ref={listRef}>
        <div className="five-team-heading">
          <span>DISPONIBLES <b>{benchCount}</b></span>
          <small>Arrastrá, dos toques para entrar o salir, o mantené para el menú. Si esa mitad está llena, sacá primero a alguien</small>
        </div>
        {benchCount === 0
          ? <p className="empty-injured">Están todos en la cancha.</p>
          : (
            <>
              {pools.squad.length ? (
                <div className="available-pool available-pool--squad">
                  <div className="available-pool-heading">Avergas <b>{pools.squad.length}</b></div>
                  <div className="available-list">{pools.squad.map((name) => renderAvailable(byName(name)))}</div>
                </div>
              ) : null}
              <div className="available-pool available-pool--ultra">
                <div className="available-pool-heading">
                  <Star className="ultra-star" size={14} fill="currentColor" aria-hidden="true" />
                  Randoms Premium Ultra <b>{pools.premium.length}</b>
                </div>
                {pools.premium.length
                  ? <div className="available-list">{pools.premium.map((name) => renderAvailable(byName(name)))}</div>
                  : <p className="empty-injured">No queda ninguno.</p>}
              </div>
              <div className="available-pool available-pool--randoms">
                <div className="available-pool-heading">Randoms <b>{pools.randoms.length}</b></div>
                {pools.randoms.length
                  ? <div className="available-list">{pools.randoms.map((name) => renderAvailable(byName(name)))}</div>
                  : <p className="empty-injured">No queda ninguno.</p>}
              </div>
            </>
          )}
      </section>

      {/* Lesionados: sin drag and drop, se marca con check. Aparecen todos los
          jugadores de la alineación (incluidos los Random). */}
      <section className="injured-players">
        <div className="five-team-heading">
          <span>LESIONADOS <b>{injuredPlayers.length}</b></span>
          <small>Tildá a quien no puede jugar · siguen habilitados para la cancha</small>
        </div>
        <div className="injured-options">
          {players.map((item) => (
            <label key={item.name} className={`injured-option${isInjured(item.name) ? ' is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={isInjured(item.name)}
                onChange={() => toggleInjury(item.name)}
              />
              <span className="injured-option-name">{item.name}</span>
              <small>{item.rating}</small>
            </label>
          ))}
        </div>
      </section>

      {/* El ghost se monta una vez al empezar el arrastre y después se mueve a
          mano con paint(): no vuelve a renderizar mientras se arrastra. Para
          los que vienen de la lista siempre se ve; para los de la cancha
          aparece sólo cuando salen de ella. */}
      {ghost && (
        <div
          className={`drag-ghost${ghost.source === 'pitch' ? (ghost.team === 'teamB' ? ' drag-ghost-b' : ' drag-ghost-a') : ''}${ghost.tone === 'ultra' ? ' is-ultra' : ''}${ghost.tone === 'randoms' ? ' is-randoms' : ''}`}
          ref={ghostRef}
          style={{ display: 'none' }}
          aria-hidden="true"
        >
          {ghost.tone === 'ultra' && <Star className="five-player-star" size={13} fill="currentColor" />}
          <strong>{byName(ghost.name).name.slice(0, 2).toUpperCase()}</strong><small>{byName(ghost.name).rating}</small>
        </div>
      )}

      {menu && (
        <div
          className="lineup-action-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.source === 'bench' ? (
            <button
              type="button"
              role="menuitem"
              disabled={!canPlaceOnPitch(lineup)}
              onClick={menuAdd}
            >
              {canPlaceOnPitch(lineup) ? 'Agregar a la cancha' : 'No hay lugar'}
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={menuRemove}>
              Quitar de la cancha
            </button>
          )}
        </div>
      )}
    </section>
  );

}
