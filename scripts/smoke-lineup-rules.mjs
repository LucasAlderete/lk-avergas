// ============================================================================
// Smoke de las REGLAS DE LA CANCHA (src/components/lineupRules.js)
// Uso: node scripts/smoke-lineup-rules.mjs
//
// Dos equipos sobre la misma cancha: 5 arriba (azules) + 5 abajo (rojos) en
// fútbol 5, o 6 + 6 en fútbol 6. El tope es POR EQUIPO.
//   A) La cancha es entera: se puede cruzar el medio sin ningún tope.
//   B) Modalidades: 5, 6 o 7 jugadores por equipo.
//   B-bis) Los Randoms son sólo de alineación (no están en el Plantel).
//   C) Desde la lista SÓLO se agrega: nunca sustituye, y con la mitad llena
//      no entra.
//   D) Intercambio entre los que ya están en la cancha.
//   E) Entrar y salir de la cancha.
//   F) La cancha vacía NO se traba (el bug que vació la pantalla entera).
//   G) normalizeLineup repara los saves viejos (teamA/teamB e inflados).
//   H) La geometría del arrastre arranca bien.
//   I) Las reglas son puras: el lineup de entrada no se muta.
// ============================================================================
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = await import(pathToFileURL(path.join(root, 'src', 'components', 'lineupRules.js')).href);
const { alignmentPlayers, lineupOnlyPlayers, players } = await import(pathToFileURL(path.join(root, 'src', 'data.js')).href);

const {
  addToPitch, benchOf, benchByPool, beginDragRecord, canPlaceOnPitch, changeMode, clampToPitch, countByTeam, DEFAULT_INJURIES, dropPlayer,
  findSlot, freshLineup, MODES, normalizeLineup, playedFromLineup, removeFromPitch, sizeForMode, STARTERS,
  starterLineup, swapTargetIndex, teamForY, totalForMode, SWAP_RADIUS,
} = rules;

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

const names = alignmentPlayers.map((item) => item.name);
const onPitch = (lineup) => lineup.slots.map((slot) => slot.name);
// Cuántos quedaron arriba (azules) y abajo (rojos).
const halves = (lineup) => countByTeam(lineup);

console.log('== Z) Formación y lesionados por defecto ==');
{
  // La base tiene que ser ESTA lista, no "los primeros N de la lista".
  assert(STARTERS.length === 10, 'arrancan 10 jugadores');
  const expected = ['Lucas', 'Rui', 'Chino', 'Gonzi', 'Nahue', 'JJ', 'Alan', 'Kike', 'Sailor', 'Cru'];
  assert(
    JSON.stringify(STARTERS) === JSON.stringify(expected),
    `la lista de arranque es la pedida (fue: ${STARTERS.join(', ')})`,
  );

  const base = freshLineup();
  assert(JSON.stringify(onPitch(base)) === JSON.stringify(expected), 'y freshLineup() los pone en ese orden');

  // 5 arriba / 5 abajo, cada uno en su mitad.
  assert(halves(base).teamA === 5 && halves(base).teamB === 5, '5 y 5');
  assert(
    base.slots.slice(0, 5).every((slot) => teamForY(slot.y) === 'teamA'),
    'los primeros 5 al equipo de arriba',
  );
  assert(
    base.slots.slice(5).every((slot) => teamForY(slot.y) === 'teamB'),
    'los otros 5 al de abajo',
  );

  // Todos existen de verdad (si se renombró alguno, freshLineup lo completa).
  for (const name of expected) {
    assert(names.includes(name), `${name} existe en la lista de la Alineación`);
  }

  // Lesionados de arranque: Emi y Rulo.
  assert(
    JSON.stringify([...DEFAULT_INJURIES].sort()) === JSON.stringify(['Emi', 'Rulo']),
    `los lesionados son Emi y Rulo (fue: ${DEFAULT_INJURIES.join(', ')})`,
  );

  // Invariante: un lesionado NO puede arrancar. Antes Emi y Rulo salían de la
  // lista automática, así que estaban lesionados y en la cancha a la vez.
  for (const name of DEFAULT_INJURIES) {
    assert(!STARTERS.includes(name), `${name} está lesionado, así que no puede arrancar`);
  }
  for (const name of STARTERS) {
    assert(!DEFAULT_INJURIES.includes(name), `${name} arranca, así que no puede estar lesionado`);
  }

  // Si un nombre de la lista desaparece, la cancha se completa y no queda floja.
  const raw = starterLineup();
  assert(raw.slots.every((slot) => typeof slot.name === 'string' && slot.name), 'todos los huecos tienen nombre');
  assert(raw.slots.length === 10, 'y siguen siendo 10');
}

console.log('== A) La cancha es entera ==');
{
  const base = freshLineup();
  assert(teamForY(49.9) === 'teamA' && teamForY(50) === 'teamB', 'la mitad decide el equipo/color');
  // Arrastrar de la mitad de arriba a la de abajo: se mueve de equipo.
  // (93,95) es una esquina libre: no hay nadie lo bastante cerca como para
  // que sea un intercambio. Primero liberamos un lugar abajo, porque con los
  // dos equipos llenos el pase no se permite (ver C-bis).
  const withRoom = removeFromPitch(freshLineup(), freshLineup().slots.find((slot) => slot.y >= 50).name);
  const crosser = withRoom.slots.find((slot) => slot.y < 50).name;
  const crossed = dropPlayer(withRoom, crosser, 93, 95);
  assert(onPitch(crossed).includes(crosser), 'cruzar el medio no saca al jugador de la cancha');
  assert(findSlot(crossed, crosser).x === 93 && findSlot(crossed, crosser).y === 95, 'queda donde se lo soltó');
  assert(teamForY(findSlot(crossed, crosser).y) === 'teamB', 'y pasa a ser del otro equipo');

  assert(clampToPitch(-400, -400).join() === '7,5', 'acota al borde izquierdo/arriba');
  assert(clampToPitch(400, 400).join() === '93,95', 'acota al borde derecho/abajo');
}

console.log('\n== B) Modalidades: 5, 6 o 7 por equipo ==');
{
  assert(MODES.join() === '5,6,7', 'las modalidades son 5, 6 y 7');
  assert(sizeForMode(5) === 5 && totalForMode(5) === 10, 'fútbol 5 -> 5 por equipo, 10 en total');
  assert(sizeForMode(6) === 6 && totalForMode(6) === 12, 'fútbol 6 -> 6 por equipo, 12 en total');
  assert(sizeForMode(7) === 7 && totalForMode(7) === 14, 'fútbol 7 -> 7 por equipo, 14 en total');
  assert(sizeForMode(9) === 5, 'una modalidad desconocida cae en 5');
  assert(sizeForMode('x') === 5, 'y un valor inválido también');

  const base = freshLineup();
  assert(base.slots.length === 10, 'la formación base trae 10 jugadores');
  assert(halves(base).teamA === 5, '5 arriba (azules)');
  assert(halves(base).teamB === 5, '5 abajo (rojos)');
  assert(new Set(onPitch(base)).size === 10, 'sin repetidos');
  assert(benchOf(base).length === names.length - 10, 'la lista queda con los que sobran');

  // Nadie puede pasarse de 5 en su mitad, aunque se le inserte a mano.
  const half = Math.ceil(names.length / 2);
  const bloated = normalizeLineup({
    mode: 5,
    slots: names.map((name, index) => ({ name, x: 50, y: index < half ? 20 : 80 })),
  });
  assert(halves(bloated).teamA === 5, 'un equipo inflado se recorta a 5');
  assert(halves(bloated).teamB === 5, 'y el otro también');
  assert(bloated.slots.length === 10, 'quedan 10 en total');

  // Cambiar de modalidad ajusta las DOS mitades.
  const six = changeMode(freshLineup(), 6);
  assert(halves(six).teamA === 6 && halves(six).teamB === 6, 'fútbol 6 -> 6 y 6');
  assert(six.slots.length === 12, '12 en total');
  const seven = changeMode(freshLineup(), 7);
  assert(halves(seven).teamA === 7 && halves(seven).teamB === 7, 'fútbol 7 -> 7 y 7');
  assert(seven.slots.length === 14, '14 en total');
  const back = changeMode(seven, 5);
  assert(halves(back).teamA === 5 && halves(back).teamB === 5, 'volver a fútbol 5 -> 5 y 5');
  assert(back.slots.length === 10, '10 en total');
  assert(new Set(onPitch(back)).size === 10, 'sin repetidos al volver');
  // Todos los que quedan afuera vuelven a estar disponibles.
  assert(benchOf(back).length === names.length - 10, 'nadie se pierde al cambiar de modalidad');
}

console.log('\n== B-bis) Los Randoms son sólo de alineación ==');
{
  assert(lineupOnlyPlayers.length === 8, 'hay 8 jugadores exclusivos de alineación');
  assert(lineupOnlyPlayers.some((item) => item.name === 'Pablito Lechuga'), 'está Pablito Lechuga');
  assert(lineupOnlyPlayers.some((item) => item.name === 'Joni Pelado 2'), 'está Joni Pelado 2');
  assert(lineupOnlyPlayers.some((item) => item.name === 'Fede'), 'está Fede');
  // No forman parte del Plantel.
  for (const item of lineupOnlyPlayers) {
    assert(!players.some((real) => real.name === item.name), `${item.name} no está en el Plantel`);
    assert(item.lineupOnly === true, `${item.name} está marcado como sólo de alineación`);
  }
  assert(alignmentPlayers.length === players.length + 8, 'el roster de alineación es el Plantel + 8');
  assert(players.length === 15, 'el Plantel sigue teniendo 15');

  // En la alineación sí se pueden usar: entran desde la lista (hay que liberar
  // un lugar, porque abajo ya están los 5).
  const full = freshLineup();
  assert(benchOf(full).includes('Random 1'), 'los Random están en la lista de disponibles');
  assert(!onPitch(full).includes('Random 1'), 'y no arrancan en la cancha solos');

  const lineup = removeFromPitch(full, full.slots.find((slot) => slot.y >= 50).name);
  const joined = dropPlayer(lineup, 'Random 1', 93, 95);
  assert(onPitch(joined).includes('Random 1'), 'se pueden arrastrar a la cancha');
  assert(findSlot(joined, 'Random 1') !== null, 'con su posición guardada');
  assert(findSlot(joined, 'Random 1').y === 95, 'y queda donde se lo soltó');

  const voted = playedFromLineup(joined);
  assert(!voted.includes('Random 1'), 'Random no entra en el partido para votar');
  assert(voted.every((name) => players.some((player) => player.name === name)), 'sólo sale gente del plantel');
  assert(playedFromLineup({ slots: [] }).length === 0, 'cancha vacía no abre partido');

  const grouped = benchByPool({ mode: 5, slots: [] });
  assert(grouped.randoms.includes('Pablito Lechuga') && grouped.randoms.includes('Joni Pelado 2'), 'Randoms tiene a Pablito y Joni');
  assert(grouped.premium.includes('Kike') && grouped.premium.includes('Fede'), 'Premium Ultra tiene a Kike y Fede');
  assert(!grouped.squad.includes('Kike'), 'Kike no queda en el plantel de disponibles');
}



console.log('\n== C-bis) Pasar de un lado al otro respeta el tope ==');
{
  const full = freshLineup();
  assert(halves(full).teamA === 5 && halves(full).teamB === 5, 'arranca 5 y 5');

  // Con las dos mitades llenas, NADIE puede pasar al otro lado.
  const blue = full.slots.find((slot) => slot.y < 50);
  const crossBlue = dropPlayer(full, blue.name, 93, 95);
  assert(crossBlue === full, 'un azul no puede pasar si los rojos ya están en 5');
  const red = full.slots.find((slot) => slot.y >= 50);
  const crossRed = dropPlayer(full, red.name, 7, 5);
  assert(crossRed === full, 'ni un rojo puede pasar si los azules ya están en 5');
  assert(halves(full).teamA === 5 && halves(full).teamB === 5, 'sigue 5 y 5');

  // Moverse dentro de SU mitad siempre se puede.
  const inside = dropPlayer(full, blue.name, 20, 44);
  assert(inside !== full, 'dentro de su mitad se mueve sin problema');
  assert(halves(inside).teamA === 5 && halves(inside).teamB === 5, 'y no cambia ninguna cantidad');

  // Si el otro equipo tiene lugar, el pase sí se permite.
  const withRoom = removeFromPitch(full, red.name);
  assert(halves(withRoom).teamB === 4, 'abajo quedó un lugar');
  const passed = dropPlayer(withRoom, blue.name, 93, 95);
  assert(passed !== withRoom, 'con lugar abajo, el azul puede pasar');
  assert(halves(passed).teamA === 4 && halves(passed).teamB === 5, 'queda 4 y 5');

  // Y no se puede dejar 10 y 0 arrastrando de a uno.
  let lineup = freshLineup();
  for (let step = 0; step < 10; step += 1) {
    const candidate = lineup.slots.find((slot) => teamForY(slot.y) === 'teamA');
    if (!candidate) break;
    lineup = dropPlayer(lineup, candidate.name, 93, 95);
  }
  assert(halves(lineup).teamA === 5, 'nunca quedan menos de 5 arriba');
  assert(halves(lineup).teamB === 5, 'ni más de 5 abajo');
  assert(lineup.slots.length === 10, 'siguen siendo 10 en la cancha');

  // El intercambio, en cambio, siempre se puede: los dos cruzan a la vez y las
  // cantidades no cambian.
  const swapped = dropPlayer(full, blue.name, red.x, red.y);
  assert(swapped !== full, 'intercambiar con el otro equipo siempre se puede');
  assert(halves(swapped).teamA === 5 && halves(swapped).teamB === 5, 'y sigue 5 y 5');
}

console.log('\n== C) Desde la lista SÓLO se agrega ==');
{
  const benchNow = benchOf(freshLineup());
  // OJO: 'Alan' y 'Nahue' son de la lista (fuera de la cancha). 'Lucas' NO:
  // es el 6º titular, así queServes para probar la rama del intercambio.
  const spare = benchNow.find((name) => !name.startsWith('Random')) || benchNow[0];

  // El suplente sale del banquillo REAL, no hardcodeado: antes era 'Alan', pero
  // en cuanto la formacion por defecto lo puso titular el test empezo a fallar
  // sin que hubiera cambiado ninguna regla.

  // 5 arriba, 4 abajo: hay lugar abajo.
  const base = freshLineup();
  const oneOut = removeFromPitch(base, base.slots.find((slot) => slot.y >= 50).name);
  assert(halves(oneOut).teamB === 4, 'abajo quedó un lugar libre');
  const added = dropPlayer(oneOut, spare, 93, 95);
  assert(halves(added).teamB === 5, 'el jugador entra abajo');
  assert(onPitch(added).includes(spare), 'y está en la cancha');
  assert(oneOut.slots.length + 1 === added.slots.length, 'la cancha creció en uno');

  // Mitad llena: NO entra y NO se saca a nadie.
  const full = freshLineup();
  const rejected = dropPlayer(full, spare, full.slots[0].x, full.slots[0].y);
  assert(rejected === full, 'con los 5 de arriba, el drop se rechaza (no cambia nada)');
  assert(halves(full).teamA === 5 && halves(full).teamB === 5, 'y no se sacó a nadie');

  // Ni aunque lo suelte justo encima de alguien.
  const rejectedMid = dropPlayer(full, spare, 50, 20);
  assert(rejectedMid === full, 'tampoco entra aunque caiga encima de un jugador');

  // Arriba llena pero abajo con lugar: entrar abajo, soltar arriba no hace nada.
  assert(dropPlayer(oneOut, spare, 93, 10) === oneOut, 'arriba llena: soltar arriba no hace nada');
  const down = dropPlayer(oneOut, spare, 93, 95);
  assert(halves(down).teamB === 5, 'pero abajo sí había lugar y entra');

  // Al liberar un lugar, vuelve a entrar.
  const reopened = dropPlayer(removeFromPitch(full, full.slots[3].name), spare, 50, 20);
  assert(halves(reopened).teamA === 5, 'al hacer lugar arriba, entra de nuevo');
}

console.log('\n== D) Intercambio entre los que están en la cancha ==');
{
  const base = freshLineup();
  const a = base.slots[0];
  const b = base.slots[5];
  const third = base.slots[1];

  const swapped = dropPlayer(base, a.name, b.x, b.y);
  assert(swapped.slots.length === base.slots.length, 'el intercambio no cambia la cantidad');
  assert(findSlot(swapped, a.name).x === b.x && findSlot(swapped, a.name).y === b.y, 'el arrastrado toma la casilla del otro');
  assert(findSlot(swapped, b.name).x === a.x && findSlot(swapped, b.name).y === a.y, 'y el otro toma la del arrastrado');
  assert(benchOf(swapped).length === benchOf(base).length, 'un intercambio no manda a nadie a la lista');

  const far = [3, 95];
  const moved = dropPlayer(base, a.name, far[0], far[1]);
  assert(findSlot(moved, b.name).x === b.x && findSlot(moved, b.name).y === b.y, 'lejos de los demás no toca a nadie');
  assert(findSlot(moved, third.name).x === third.x, 'ni a los otros');
}

console.log('\n== E) Entrar y salir ==');
{
  const base = freshLineup();
  const out = base.slots[0].name;
  const off = removeFromPitch(base, out);
  assert(!onPitch(off).includes(out), 'sacar a un jugador lo baja de la cancha');
  assert(benchOf(off).includes(out), 'y aparece en la lista');
  assert(removeFromPitch(off, 'Zombie') === off, 'sacar un nombre desconocido no hace nada');
  assert(off.slots.length === 9, 'la cancha queda con 9');
}

console.log('\n== F) La cancha vacía NO se traba ==');
{
  const empty = { mode: 5, slots: [] };
  assert(benchOf(empty).length === names.length, 'con la cancha vacía están todos disponibles');
  assert(dropPlayer(empty, names[0], 40, 30).slots.length === 1, 'el primer jugador entra en una cancha vacía');

  let lineup = freshLineup();
  for (const name of [...onPitch(lineup)]) lineup = removeFromPitch(lineup, name);
  assert(lineup.slots.length === 0, 'se puede vaciar la cancha');
  names.slice(0, 5).forEach((name, i) => { lineup = dropPlayer(lineup, name, 20 + i * 15, 20); });

console.log('\n== G) normalizeLineup repara los saves viejos ==');
{
  // Save de la versión con EQUIPO A / EQUIPO B.
  const legacy = {
    mode: 5,
    teamA: ['Chino', 'Emi', 'Mati', 'Rui', 'Gonzi'],
    teamB: ['Lucas', 'Tigre', 'Rulo', 'Sailor', 'Cru'],
    positions: { teamA: [[50, 12], [25, 39], [75, 39], [35, 27], [65, 27]], teamB: [[50, 88]] },
  };
  const migrated = normalizeLineup(legacy);
  assert(halves(migrated).teamA === 5, 'el save viejo se aplana: 5 arriba');
  assert(halves(migrated).teamB === 5, 'y 5 abajo');
  assert(new Set(onPitch(migrated)).size === migrated.slots.length, 'sin repetidos');
  assert(migrated.teamA === undefined && migrated.teamB === undefined, 'ya no hay equipos');
  // Cada equipo queda en su mitad aunque el save viejo los tuviera cruzados.
  assert(migrated.slots.filter((slot) => slot.y < 50).length === 5, 'los del equipo A quedan arriba');
  assert(migrated.slots.filter((slot) => slot.y >= 50).length === 5, 'y los del B abajo');

  // Un save viejo con el mismo jugador en A y en B: el repetido se descarta.
  const duplicated = normalizeLineup({
    mode: 5,
    teamA: ['Chino', 'Emi', 'Mati', 'Rui', 'Gonzi'],
    teamB: ['Chino', 'Emi', 'Mati', 'Rui', 'Gonzi'],
    positions: { teamA: [[50, 12]], teamB: [[50, 88]] },
  });
  assert(new Set(onPitch(duplicated)).size === duplicated.slots.length, 'sin duplicados aunque el viejo los tuviera');

  assert(freshLineup().slots.length === 10, 'sin save arranca con 10 en la cancha');
  assert(normalizeLineup(null).slots.length === 10, 'un save null también');
  assert(normalizeLineup({ mode: 5, slots: [{ name: 'Zombie' }, { name: null }] }).slots.length === 0, 'descarta nombres desconocidos');

  const wild = normalizeLineup({ mode: 5, slots: [{ name: names[0], x: 999, y: -999 }, { name: names[1] }] });
  assert(wild.slots[0].x === 93 && wild.slots[0].y === 5, 'acota las posiciones a la cancha');
  assert(wild.slots[1].x >= 7 && wild.slots[1].x <= 93, 'rellena la posición que faltaba');
  assert(wild.slots.every((slot) => Number.isFinite(slot.x) && Number.isFinite(slot.y)), 'toda posición es un número');

  // El radio de intercambio.
  const near = [{ name: 'A', x: 50, y: 50 }, { name: 'B', x: 55, y: 53 }];
  assert(swapTargetIndex(near, 52, 51, 'A') === 1, 'detecta al jugador que está justo debajo');
  assert(swapTargetIndex(near, 10, 10, 'A') === -1, 'no hay intercambio si no hay nadie debajo');
  const alone = [{ name: 'A', x: 50, y: 50 }, { name: 'B', x: 80, y: 80 }];
  assert(swapTargetIndex(alone, 50, 50, 'A') === -1, 'un jugador no se intercambia consigo mismo');
  assert(swapTargetIndex(near, 55, 53, 'B') === 0, 'simétrico: también funciona desde el otro');
  assert(swapTargetIndex([], 50, 50, 'A') === -1, 'cancha vacía: nadie debajo');
  assert(SWAP_RADIUS > 0, 'el radio de intercambio está definido');
}

console.log('\n== H) El arrastre arranca bien (geométrica) ==');
{
  const rect = { left: 40, top: 100, width: 620, height: 650, right: 660, bottom: 750 };
  const base = freshLineup();
  const onPitchSlot = base.slots[0];
  const off = benchOf(base)[0];

  const own = beginDragRecord(base, { source: 'pitch', name: onPitchSlot.name }, rect,
    rect.left + (onPitchSlot.x / 100) * rect.width,
    rect.top + (onPitchSlot.y / 100) * rect.height);
  assert(own.offsetX === 0 && own.offsetY === 0, 'arrastrar un jugador por el centro no lo offseta');
  assert(own.moved === false && own.frame === null, 'arranca sin movimiento y sin frame pendiente');
  assert(own.name === onPitchSlot.name && own.source === 'pitch', 'el registro conserva el payload');

  const grabbed = beginDragRecord(base, { source: 'pitch', name: onPitchSlot.name }, rect,
    rect.left + (onPitchSlot.x / 100) * rect.width + 20,
    rect.top + (onPitchSlot.y / 100) * rect.height + 13);
  assert(grabbed.offsetX > 0 && grabbed.offsetY > 0, 'agarrado a la derecha/abajo, el offset es positivo');
  assert(Math.abs(grabbed.offsetX - (20 / rect.width) * 100) < 0.01, 'el offset en x mide el desvío en px');
  const cursorX = (grabbed.clientX - rect.left) / rect.width * 100;
  assert(Math.abs((cursorX - grabbed.offsetX) - onPitchSlot.x) < 0.01, 'cursor - offset devuelve su casilla');

  const fromList = beginDragRecord(base, { source: 'bench', name: off }, rect, 300, 400);
  assert(fromList.offsetX === 0 && fromList.offsetY === 0, 'el que viene de la lista no tiene offset');
  assert(fromList.name === off, 'y se arrastra al que se pidió');
  assert(beginDragRecord(base, { source: 'pitch', name: off }, rect, 300, 400).offsetX === 0, 'un nombre fuera de la cancha no rompe nada');
}

console.log('\n== I) Las reglas son puras ==');
{
  const base = freshLineup();
  const snapshot = JSON.stringify(base);

  dropPlayer(base, benchOf(base)[0], 30, 30);
  dropPlayer(base, base.slots[0].name, base.slots[5].x, base.slots[5].y);
  removeFromPitch(base, base.slots[0].name);
  changeMode(base, 6);
  normalizeLineup(base);
  clampToPitch(1, 1);
  countByTeam(base);

  assert(JSON.stringify(base) === snapshot, 'ninguna función muta el lineup que recibe');
  assert(changeMode(base, 5) === base, 'changeMode a la misma modalidad devuelve la misma referencia');
  assert(removeFromPitch(base, 'Zombie') === base, 'removeFromPitch de un desconocido devuelve la misma referencia');
  addToPitch(base, 'Fede');
  assert(JSON.stringify(base) === snapshot, 'addToPitch tampoco muta el lineup');
}

console.log('\n== J) Doble toque agrega y saca ==');
{
  const empty = { mode: 5, slots: [] };
  const first = addToPitch(empty, 'Fede');
  assert(first !== empty && empty.slots.length === 0, 'en cancha vacía entra sin mutar el original');
  assert(onPitch(first).includes('Fede'), 'Fede queda en la cancha');
  assert(findSlot(first, 'Fede').y < 50, 'cae en el hueco de arriba');
  assert(addToPitch(first, 'Fede') === first, 'si ya está, no duplica');
  assert(addToPitch(empty, 'Zombie') === empty, 'un desconocido no entra');

  const full = freshLineup();
  assert(!canPlaceOnPitch(full), 'con 5 y 5 no hay lugar');
  assert(addToPitch(full, 'Fede') === full, 'y no entra nadie más');

  const room = removeFromPitch(full, full.slots[0].name);
  assert(canPlaceOnPitch(room), 'al sacar a uno hay lugar');
  const added = addToPitch(room, 'Fede');
  assert(onPitch(added).includes('Fede'), 'con lugar entra al hueco libre');
  const out = removeFromPitch(added, 'Fede');
  assert(!onPitch(out).includes('Fede'), 'sacarlo lo devuelve a la lista');
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);

  names.slice(5, 10).forEach((name, i) => { lineup = dropPlayer(lineup, name, 20 + i * 15, 80); });
  assert(lineup.slots.length === 10, 'y volver a llenarla desde la lista funciona');
  assert(halves(lineup).teamA === 5 && halves(lineup).teamB === 5, '5 arriba y 5 abajo');
}
