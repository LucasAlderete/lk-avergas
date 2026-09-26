// ============================================================================
// SELECCIÓN DE JUGADOR COMPARTIDA — la usan Plantel y la pantalla Alineación
// ============================================================================
// El jugador elegido vive en la clave `avergas-player`. Como Plantel y
// Alineación son pantallas separadas, el estado se relee del storage al montar
// cada una: el jugador que tocaste en la cancha sigue resaltado en el roster y
// al revés. Misma clave, mismo comportamiento que antes de la división.

import { useCallback, useState } from 'react';

import { players } from '../data.js';

const playerKey = 'avergas-player';

const DEFAULT_PLAYER = players.find((player) => player.name === 'Gonzi') || players[0];

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function isKnownPlayerName(name) {
  return typeof name === 'string' && players.some((player) => player.name === name);
}

export function defaultPlayerName() {
  return DEFAULT_PLAYER?.name || '';
}

export function readSelectedPlayer() {
  try {
    const stored = storage()?.getItem(playerKey);
    const parsed = stored == null ? null : JSON.parse(stored);
    const name = typeof parsed === 'string' ? parsed : parsed?.name;
    return isKnownPlayerName(name) ? name : defaultPlayerName();
  } catch {
    return defaultPlayerName();
  }
}

export function writeSelectedPlayer(name) {
  try {
    storage()?.setItem(playerKey, JSON.stringify(name));
  } catch {
    // La selección sigue funcionando en memoria si el storage está bloqueado.
  }
}

export function useSelectedPlayer() {
  const [selected, setSelected] = useState(readSelectedPlayer);

  const select = useCallback((name) => {
    if (!isKnownPlayerName(name)) return;
    setSelected(name);
    writeSelectedPlayer(name);
  }, []);

  return [selected, select];
}