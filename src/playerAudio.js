// ============================================================================
// AUDIOS DE LOS JUGADORES — se descubren solas, como las fotos
//
// Cualquier .m4a / .mp3 / .ogg / .wav / .aac en src/assets (o src/assets/audio)
// entra solo. El nombre del archivo es el del jugador:
//   rui.m4a        -> Rui
//   rui_1.m4a      -> Rui
//   gonzi_1.m4a    -> Gonzi
//   sailor_1.m4a   -> Sailor
//   mati_1.m4a     -> Mati
//   rui_2.m4a      -> Rui (se elige uno al azar al tocar el 🔈)
//
// El `_1`, `_2` al final es el índice del clip, no parte del nombre. Para
// agregar otro audio de Rui alcanza con tirar `rui_3.m4a` en la carpeta.
// ============================================================================
import { alignmentPlayers } from './data.js';

const files = {
  ...import.meta.glob('./assets/*.{m4a,mp3,ogg,wav,aac}', { eager: true, import: 'default' }),
  ...import.meta.glob('./assets/audio/*.{m4a,mp3,ogg,wav,aac}', { eager: true, import: 'default' }),
};

const keyOf = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

// `rui_1` / `rui-2` / `rui 3` caen en "rui". Un archivo sin índice (`rui.m4a`)
// también. No se recortan dígitos a lo loco: "Random 1" tiene que seguir siendo
// `random1`, no `random`.
export const playerKeyFromStem = (stem) => keyOf(String(stem).replace(/[_\-\s]+\d+$/, ''));

const AUDIO_ALIASES = {};

const byPlayer = new Map();
const byFile = new Map();

for (const [filePath, url] of Object.entries(files)) {
  const file = filePath.split('/').pop();
  const stem = file.replace(/\.[^.]+$/, '');
  const fileKey = keyOf(stem);
  const alias = AUDIO_ALIASES[fileKey];
  const playerKey = alias ? keyOf(alias) : playerKeyFromStem(stem);
  if (!fileKey || !playerKey || !url) continue;
  byFile.set(fileKey, playerKey);
  const clips = byPlayer.get(playerKey) || [];
  clips.push(url);
  byPlayer.set(playerKey, clips);
}

export const clipsOf = (name) => byPlayer.get(keyOf(name)) || [];
export const hasAudio = (name) => clipsOf(name).length > 0;

export const unusedAudios = () => {
  const taken = new Set(alignmentPlayers.map((player) => keyOf(player.name)));
  return [...byFile.entries()]
    .filter(([, playerKey]) => !taken.has(playerKey))
    .map(([fileKey]) => fileKey);
};

let current = null;

export function playPlayerAudio(name) {
  const clips = clipsOf(name);
  if (!clips.length || typeof Audio === 'undefined') return;
  if (current) {
    current.pause();
    current.removeAttribute('src');
    current.load();
    current = null;
  }
  const url = clips[Math.floor(Math.random() * clips.length)];
  const audio = new Audio(url);
  audio.play().catch(() => {});
  current = audio;
}

export default playPlayerAudio;
