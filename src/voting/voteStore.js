// ============================================================================
// ALMACENAMIENTO DE VOTOS
// ============================================================================
// El OVR final sale de DOS fuentes que se suman:
//
//   castedVotes  -> los votos que YA aplicaste con `apply-vote-reports.mjs`
//                  (vienen de los informes de WhatsApp, y están en el archivo
//                  generado src/data/castedVotes.js: los ve todo el mundo).
//   localStorage -> los votos de ESTA persona en ESTE navegador.
//
// O sea: el OVR es el mismo para todos (los votos compartidos) más lo que cada
// uno haya cargado en su celu y todavía no mandó.
//
// El "voterId" del almacenamiento local es lo que evita que una persona vote
// dos veces. Para pasar a un backend real, reemplazá loadBallots/saveBallots por
// GET/PUT y ya está.

import { castedVoters, castedVotes } from '../data/castedVotes.js';

const VOTES_KEY = 'avergas-votes-v1';
const VOTER_KEY = 'avergas-voter-id';

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// Identificador de esta persona. Se genera una vez y queda en el navegador:
// sirve para que el backend sepa que ya votó y no le sume doble.
export function getVoterId() {
  try {
    const store = storage();
    if (!store) return 'anon';
    const saved = store.getItem(VOTER_KEY);
    if (saved) return saved;
    const id = `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    store.setItem(VOTER_KEY, id);
    return id;
  } catch {
    return 'anon';
  }
}

// Lista de boletas: [{ voterId, votes }]
export function loadBallots() {
  try {
    const raw = storage()?.getItem(VOTES_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.voterId === 'string' && row.votes && typeof row.votes === 'object');
  } catch {
    return [];
  }
}

export function saveBallots(ballots) {
  try {
    storage()?.setItem(VOTES_KEY, JSON.stringify(ballots));
  } catch {
    // Sin storage la app sigue andando: sólo no se recuerda al recargar.
  }
}

// Los votos que ya aplicaste desde los informes de WhatsApp: los ve todo el
// mundo porque vienen en el bundle.
export { castedVotes, castedVoters };

// Cuántas personas han aportado votos: las que mandaron informe más las que
// todavia no mandaron el suyo desde este celu.
export const votersCount = (ballots) => (
  castedVoters + new Set((ballots || []).map((row) => row.voterId)).size
);

// Vacía TODOS los votos locales (sólo para desarrollo / pruebas).
export function clearVotes() {
  try {
    storage()?.removeItem(VOTES_KEY);
  } catch {
    /* sin storage no hay nada que borrar */
  }
}