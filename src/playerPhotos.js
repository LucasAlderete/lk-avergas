// ============================================================================
// FOTOS DE LOS JUGADORES — se descubren solas
//
// No hay ninguna lista de fotos en el código: se toma TODO lo que haya en
// src/assets y se asocia por nombre de archivo. `chino.png` -> "Chino",
// `Gonzi.JPG` -> "Gonzi", "Gonzi 2.png" -> "Gonzi 2".
//
// Así, para agregar una foto alcanza con dejarla en la carpeta con el nombre del
// jugador: no hay que tocar ningún archivo ni reconstruir el mapeo a mano. Y si
// el jugador no tiene foto, la pantalla usa las iniciales como antes.
//
// Vite devuelve la URL final con hash, así que las fotos entran al bundle con su
// nombre real y el navegador las cachea entre recargas.
//
// OJO: este archivo usa `import.meta.glob`, que sólo existe dentro de Vite. Por
// eso vive acá y no en data.js: los smokes de Node puro importan data.js y se
// romperían.
// ============================================================================
import { players } from './data.js';

// Cualquier imagen que se agregue a src/assets entra sola.
const files = import.meta.glob('./assets/*.{png,jpg,jpeg,webp,avif,gif}', {
  eager: true,
  import: 'default',
});

// "Chino" -> "chino"; "Gónzi" -> "gonzi"; "Gonzi 2" -> "gonzi2".
// Se sacan acentos, mayúsculas y todo lo que no sea letra o número, así el
// nombre del archivo no tiene que calcar exactamente el del jugador.
const keyOf = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

// APODOS: hay fotos que no se llaman como el jugador. "pelado.png" es la foto
// de Alan. Con esto el archivo se asocia igual y no hay que renombrarlo.
// Si algún día el apodo cambia o se sube la foto con el nombre real, alcanza con
// tocar esta línea (y borrar la anterior, si quedó vieja).
const PHOTO_ALIASES = {
  pelado: 'Alan',
};

// Las fotos tal cual vinieron, por nombre de archivo normalizado.
const byFile = new Map();
for (const [filePath, url] of Object.entries(files)) {
  const file = filePath.split('/').pop();
  const key = keyOf(file.replace(/\.[^.]+$/, ''));
  if (key && !byFile.has(key)) byFile.set(key, url);
}

// Asociación final: archivo -> jugador. Van primero los apodos y después los
// archivos que ya se llaman como el jugador, así si algún día aparece un
// "alan.png" de verdad, ese manda sobre el apodo (es más específico).
const byPlayer = new Map();
for (const [key, url] of byFile) {
  const alias = PHOTO_ALIASES[key];
  if (alias) byPlayer.set(keyOf(alias), url);
}
for (const [key, url] of byFile) byPlayer.set(key, url);

// La foto de un jugador, o null si no tiene.
export const photoOf = (name) => byPlayer.get(keyOf(name)) || null;
export const hasPhoto = (name) => byPlayer.has(keyOf(name));

// Fotos que no corresponden a ningún jugador ni a ningún apodo conocido.
// Sirve para detectar sobras (un archivo con el nombre mal escrito) y avisar en
// el test, en vez de que la foto quede invisible sin que nadie se entere.
export const unusedPhotos = () => {
  const taken = new Set(players.map((player) => keyOf(player.name)));
  return [...byFile.keys()].filter((key) => !taken.has(key) && !PHOTO_ALIASES[key]);
};

export default photoOf;