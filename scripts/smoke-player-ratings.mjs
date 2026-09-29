// ============================================================================
// Smoke de los STATS BASE DEL PLANTEL (src/data.js)
// Uso: node scripts/smoke-player-ratings.mjs
//
//   A) Cada jugador tiene EXACTAMENTE el OVR pedido.
//   B) El OVR sale de los 6 atributos: si se "freezea" un rating, esto lo avisa.
//   C) Atributos en rango y frases/lore intactos.
//
// El OVR es el promedio de los 6 atributos de FIFA (como en el juego). Por eso
// para cambiarlo hay que calibrar los 6, no escribir un número: acá se
// comprueba que los dos caminos dan lo mismo.
// ============================================================================
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { alignmentPlayers, lineupOnlyPlayers, players, RATING_STATS, overallOf, statOf } = await import(
  pathToFileURL(path.join(root, 'src', 'data.js')).href
);

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

// OVR acordados. Si se cambia alguno, se cambia acá también.
const EXPECTED = {
  Chino: 80, Emi: 76, Mati: 69, Rui: 66, Gonzi: 87, Lucas: 75, Tigre: 99,
  Rulo: 66, Sailor: 80, Cru: 72, Nahue: 65, JJ: 81, Luquitas: 60, Kike: 70, Alan: 68,
};

console.log('== A) Cada jugador tiene el OVR pedido ==');
{
  assert(players.length === Object.keys(EXPECTED).length, 'el Plantel sigue teniendo 15 jugadores');
  for (const [name, target] of Object.entries(EXPECTED)) {
    const player = players.find((item) => item.name === name);
    if (!player) { fail(`falta el jugador ${name}`); continue; }
    assert(player.rating === target, `${name} es ${target} (está en ${player.rating})`);
  }
  // Orden por OVR, como se ve en pantalla.
  const sorted = [...players].sort((a, b) => b.rating - a.rating).map((item) => item.name);
  assert(sorted[0] === 'Tigre', `el más rated es Tigre (fue: ${sorted[0]})`);
  assert(sorted[sorted.length - 1] === 'Luquitas', `el menos rated es Luquitas (fue: ${sorted[sorted.length - 1]})`);
}

console.log('== B) El OVR se CALCULA, no está escrito ==');
{
  // Si alguien reemplaza el `rating` calculado por un número fijo, el OVR dejaría
  // de seguir a los atributos. Se comprueba con los valores de la fuente.
  for (const player of players) {
    const recomputed = overallOf(player);
    assert(recomputed === player.rating, `${player.name}: rating coincide con el promedio de sus 6 stats`);
  }
  // Y que mover un atributo mueva el OVR (o sea, de verdad manda el promedio).
  const gonzi = players.find((item) => item.name === 'Gonzi');
  const bumped = { ...gonzi, shooting: gonzi.shooting + 1 };
  assert(overallOf(bumped) !== overallOf(gonzi), 'subir un atributo sube el OVR');
  // Y que los 6 sirvan: si uno no contara, subirlo no cambiaría nada.
  for (const stat of RATING_STATS) {
    const moved = { ...gonzi, [stat.key]: gonzi[stat.key] + 0.3 };
    assert(overallOf(moved) !== overallOf(gonzi), `${stat.label} cuenta para el OVR`);
  }
}

console.log('== C) Rango, perfiles y datos que NO hay que romper ==');
{
  for (const player of players) {
    for (const stat of RATING_STATS) {
      const value = statOf(player, stat.key);
      assert(value >= 0 && value <= 99, `${player.name} ${stat.label} está en 0-99 (está en ${value})`);
    }
    assert(typeof player.phrase === 'string' && player.phrase.length > 0, `${player.name} tiene frase`);
    assert(typeof player.lore?.perfil === 'string' && player.lore.perfil.length > 0, `${player.name} tiene perfil`);
    assert(Array.isArray(player.lore?.rasgos), `${player.name} tiene rasgos`);
    assert(Array.isArray(player.lore?.cargadas), `${player.name} tiene cargadas`);
  }
  // Los que sólo están en la Alineación no se tocan: siguen en 0-10 y su OVR
  // se recalcula por el mismo promedio.
  assert(lineupOnlyPlayers.length === 8, 'hay 8 que sólo están en la Alineación');
  for (const player of lineupOnlyPlayers) {
    assert(overallOf(player) === player.rating, `${player.name}: su OVR también sale del promedio`);
    assert(player.rating > 0 && player.rating < 99, `${player.name} tiene un OVR de Randoms sensato`);
  }
  const pablito = lineupOnlyPlayers.find((item) => item.name === 'Pablito Lechuga');
  const joni = lineupOnlyPlayers.find((item) => item.name === 'Joni Pelado 2');
  assert(pablito?.rating === 70, 'Pablito Lechuga es 70');
  assert(joni?.rating === 70, 'Joni Pelado 2 es 70');
  const kike = players.find((item) => item.name === 'Kike');
  assert(kike?.pool === 'premium', 'Kike está en Randoms Premium Ultra');
  // Los lesionados por defecto no son los que arrancan (ver lineupRules).
  assert(alignmentPlayers.length === 23, 'la Alineación tiene 23 (15 + 8)');
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
