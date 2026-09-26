// ============================================================================
// Smoke de las REGLAS DE VOTACIÓN (src/voting/voteRules.js)
// Uso: node scripts/smoke-vote-rules.mjs
//
//   A) Presupuesto: 5 puntos por persona, 2 por jugador.
//   B) Sumar y restar, y el OVR que se recalcula.
//   C) Se puede deshacer un voto (queda en 0 y se borra).
//   D) Varios fantasmas: los votos se suman y el OVR se mueve para todos.
//   E) El OVR nunca se sale de 0-99 ni rompe el promedio.
//   F) Las reglas son puras: la boleta de entrada no se muta.
// ============================================================================
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { players } = await import(pathToFileURL(path.join(root, 'src', 'data.js')).href);
const v = await import(pathToFileURL(path.join(root, 'src', 'voting', 'voteRules.js')).href);

const {
  POINTS_PER_PLAYER, TOTAL_POINTS, aggregateBallots, canCast, castVote, clearBallot,
  costOfPlayer, dynamicAlignmentRoster, dynamicRoster, emptyBallot, remaining, spent, withVotes,
  ballotSummary,
} = v;

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

const chino = players.find((player) => player.name === 'Chino');
const ovrOf = (deltas) => withVotes(chino, deltas).rating;
const { buildReport, readReport } = await import(pathToFileURL(path.join(root, 'src', 'voting', 'voteReport.js')).href);

console.log('== A) Presupuesto: 5 en total, 2 por jugador ==');
{
  assert(TOTAL_POINTS === 5, 'hay 5 puntos por persona');
  assert(POINTS_PER_PLAYER === 2, '2 puntos máximo por jugador');

  let ballot = emptyBallot();
  assert(remaining(ballot) === 5, 'arranca con 5 puntos');

  // +1 pase y -1 ritmo = los 2 puntos de ese jugador.
  ballot = castVote(ballot, 'Chino', 'passing', 1);
  ballot = castVote(ballot, 'Chino', 'pace', -1);
  assert(costOfPlayer(ballot.Chino) === 2, '+1 pase y -1 ritmo usan los 2 puntos del jugador');
  assert(spent(ballot) === 2 && remaining(ballot) === 3, 'quedan 3 de los 5');

  // Tercer punto sobre el mismo jugador: rechazado.
  const third = castVote(ballot, 'Chino', 'defense', 1);
  assert(third === ballot, 'no se puede pasar de 2 puntos en un jugador');
  assert(canCast(ballot, 'Chino', 'defense', 1).code === 'player-limit', 'y avisa que es el tope por jugador');

  // Dos jugadores completos = 4 puntos, y queda 1.
  let spread = castVote(ballot, 'Emi', 'shooting', 1);
  spread = castVote(spread, 'Emi', 'defense', -1);
  assert(spent(spread) === 4 && remaining(spread) === 1, 'dos jugadores a 2 puntos = quedan 1');

  // El quinto punto va a un tercer jugador.
  const fifth = castVote(spread, 'Mati', 'dribbling', 1);
  assert(spent(fifth) === 5 && remaining(fifth) === 0, 'el quinto punto se puede usar');

  // Sexto punto: rechazado.
  const sixth = castVote(fifth, 'Gonzi', 'pace', 1);
  assert(sixth === fifth, 'no se puede pasar de 5 puntos en total');
  assert(canCast(fifth, 'Gonzi', 'pace', 1).code === 'no-points', 'y avisa que no quedan puntos');
  assert(remaining(fifth) === 0, 'no quedan puntos');
}

console.log('\n== B) Sumar y restar recalcula el OVR ==');
{
  const base = ovrOf();

  // El atributo individual se mueve de a uno (escala 0-99).
  assert(withVotes(chino, { passing: 1 }).attributes.passing === Math.round(chino.passing * 10) + 1, '+1 sube el atributo de a uno');
  assert(withVotes(chino, { pace: -1 }).attributes.pace === Math.round(chino.pace * 10) - 1, '-1 lo baja de a uno');

  // El OVR es el promedio, así que 2 puntos en UN atributo pueden no moverlo
  // (el redondeo se los come) pero nunca lo mueven más de 1.
  assert(Math.abs(ovrOf({ passing: 2 }) - base) <= 1, '2 puntos en un atributo mueven el OVR a lo sumo 1');
  assert(Math.abs(ovrOf({ passing: -2 }) - base) <= 1, 'restarlos también a lo sumo 1');

  // Con votos de sobra el OVR se mueve de a uno por punto promedio.
  const everyone = { pace: 2, passing: 2, defense: 2, shooting: 2, dribbling: 2, physical: 2 };
  assert(ovrOf(everyone) === base + 2, '+2 en los 6 atributos sube el OVR en 2');
  const nobody = { pace: -2, passing: -2, defense: -2, shooting: -2, dribbling: -2, physical: -2 };
  assert(ovrOf(nobody) === base - 2, 'y -2 en los 6 lo baja en 2');

  // Un voto de una sola persona (2 puntos como mucho) no puede hacer escudos.
  assert(ovrOf({ passing: 2 }) <= base + 1, 'una persona sola no puede subir más de 1 el OVR');
}

console.log('\n== C) Se puede deshacer ==');
{
  let ballot = castVote(emptyBallot(), 'Chino', 'passing', 1);
  ballot = castVote(ballot, 'Chino', 'pace', -1);
  assert(spent(ballot) === 2, 'dos votos aplicados');

  const undoOne = castVote(ballot, 'Chino', 'pace', 1);
  assert(undoOne.Chino.pace === undefined, 'al volver a 0 el atributo se borra de la boleta');
  assert(costOfPlayer(undoOne.Chino) === 1, 'y se recupera el punto');
  assert(remaining(undoOne) === 4, 'vuelven a quedar 4 puntos');

  const undoAll = castVote(undoOne, 'Chino', 'passing', -1);
  assert(undoAll.Chino === undefined, 'si no queda ningún voto, el jugador desaparece de la boleta');
  assert(spent(undoAll) === 0 && remaining(undoAll) === 5, 'la boleta vuelve a estar vacía');
}


console.log('\n== D) Los votos de todos se suman ==');
{
  const ballots = [
    { Chino: { passing: 1 } },
    { Chino: { passing: 1, pace: -1 } },
    { Emi: { defense: 2 } },
  ];
  const total = aggregateBallots(ballots);
  assert(total.Chino.passing === 2, 'dos personas suman sus votos al mismo atributo');
  assert(total.Chino.pace === -1, 'y los restados se acumulan');
  assert(total.Emi.defense === 2, 'cada jugador lleva su propia bolsa');

  const roster = dynamicRoster(total);
  const votedChino = roster.find((player) => player.name === 'Chino');
  assert(votedChino.rating === ovrOf(total.Chino), 'el roster dinámico usa el OVR con los votos de todos');
  assert(votedChino.attributes.passing === Math.round(chino.passing * 10) + 2, 'y el atributo acumula los dos votos');

  // Sin votos, el roster es idéntico al original.
  const clean = dynamicRoster({});
  for (const player of players) {
    const same = clean.find((row) => row.name === player.name);
    assert(same.rating === player.rating, `${player.name} sin votos conserva su OVR`);
  }
  // El roster de alineación también (incluye a los Random).
  const extra = { name: 'Random 1', pace: 5, shooting: 5, passing: 5, dribbling: 5, defense: 5, physical: 5 };
  const align = dynamicAlignmentRoster(total, [...players, extra]);
  assert(align.length === players.length + 1, 'el roster de alineación incluye a los Random');
  assert(align.at(-1).rating === 50, 'y su OVR también sale de los 6 atributos');
}

console.log('\n== E) El OVR nunca se sale de rango ==');
{
  const crazy = dynamicRoster({ Chino: { pace: 50, passing: -50, defense: 50, shooting: 50, dribbling: 50, physical: 50 } });
  const loco = crazy.find((player) => player.name === 'Chino');
  for (const value of Object.values(loco.attributes)) {
    assert(value >= 0 && value <= 99, `el atributo ${value} queda entre 0 y 99`);
  }
  assert(loco.rating >= 0 && loco.rating <= 99, 'el OVR queda entre 0 y 99');
  assert(Object.values(loco.attributes).every(Number.isInteger), 'los atributos son enteros');
  const zero = withVotes({ name: 'X', pace: 0, shooting: 0, passing: 0, dribbling: 0, defense: 0, physical: 0 }, { pace: 5 });
  assert(zero.rating === 1, 'con todos los atributos en 0 el OVR redondea a 1');
  const broken = withVotes({ name: 'Y' }, {});
  assert(broken.rating === 0, 'un jugador sin atributos da OVR 0 y no explota');
}

console.log('\n== F) Las reglas son puras ==');
{
  const ballot = { Chino: { passing: 1 } };
  const snapshot = JSON.stringify(ballot);
  castVote(ballot, 'Chino', 'pace', 1);
  castVote(ballot, 'Emi', 'shooting', 1);
  castVote(ballot, 'Chino', 'defense', 1);
  aggregateBallots([ballot]);
  withVotes(chino, ballot.Chino);
  assert(JSON.stringify(ballot) === snapshot, 'ninguna función muta la boleta que recibe');
  assert(castVote(ballot, 'Chino', 'pace', 1) !== ballot, 'un voto válido devuelve una boleta nueva');
  assert(spent({}) === 0 && spent(null) === 0, 'spent tolera boletas vacías o nulas');
}

console.log('\n== G) El informe de WhatsApp (ida y vuelta) ==');
{
  let ballot = castVote(emptyBallot(), 'Chino', 'passing', 1);
  ballot = castVote(ballot, 'Chino', 'pace', -1);
  ballot = castVote(ballot, 'Emi', 'shooting', 1);
  // Así es exactamente como lo manda la persona desde el celu.
  const line = buildReport(ballot, 'Lucas');
  assert(line.startsWith('AV1|'), 'el informe arranca con el magic AV1');
  assert(line.includes('Chino:passing+1,pace-1'), 'trae los votos del jugador');
  assert(line.includes('Emi:shooting+1'), 'y de los demás jugadores');
  assert(!/[^\x20-\x7E]/.test(line), 'es ASCII puro (WhatsApp no lo rompe)');
  assert(line.length < 160, 'entra cómodo en un mensaje de WhatsApp');

  // Ida y vuelta: parsear lo mismo devuelve la boleta original.
  const back = readReport(line);
  assert(back.ok, 'vuelve a leerse sin errores');
  assert(back.label === 'Lucas', 'conserva el nombre de la persona');
  assert(JSON.stringify(back.ballot) === JSON.stringify(ballot), 'y devuelve la boleta idéntica');

  // Pegado dentro de un texto de chat.
  const chat = ['Lucas: ahí va', line, 'gracias!'].join('\n');
  const fromChat = readReport(chat);
  assert(fromChat.ok, 'se lee aunque venga metido en un chat');
  assert(fromChat.label === 'Lucas', 'y saca el nombre de adentro');

  // Y aunque el código NO empiece la línea (WhatsApp pone texto antes).
  const prefixed = readReport(`mi voto: ${line}`);
  assert(prefixed.ok, 'se lee aunque tenga texto antes del código');
  assert(prefixed.label === 'Lucas', 'y sigue sacando el nombre');

  // Informes inválidos: los detecta y avisa por qué.
  assert(!readReport('hola qué tal').ok, 'un texto normal no es un informe');
  assert(!readReport('AV1|Lucas|Chino:volar+1').ok, 'rechaza un atributo inexistente');
  const tooMany = readReport('AV1|Lucas|Chino:passing+1,pace+1,defense+1');
  assert(!tooMany.ok, 'rechaza 3 puntos para un mismo jugador');
  assert(tooMany.errors.join(' ').includes('2'), 'y dice que el máximo es 2');

  // Informe vacío: válido pero sin nada que aplicar.
  assert(readReport('AV1|Nico|').ok, 'una boleta vacía es válida');
  assert(Object.keys(readReport('AV1|Nico|').ballot).length === 0, 'pero no aporta votos');
}

console.log('== H) Borrar mi voto (reset para volver a votar) ==');
{
  const ballots = [
    { voterId: 'v-ana', votes: castVote(emptyBallot(), 'Chino', 'passing', 1) },
    { voterId: 'v-beto', votes: castVote(emptyBallot(), 'Emi', 'shooting', 1) },
  ];

  // Borra sólo la boleta de una persona; la de los demás queda igual.
  const after = clearBallot(ballots, 'v-ana');
  assert(after.length === 1, 'saca una boleta');
  assert(after[0].voterId === 'v-beto', 'y deja las de los otros');
  assert(after[0].votes.Emi.shooting === 1, 'sin tocar los votos ajenos');
  assert(ballots.length === 2, 'la entrada no se muta');

  // Y la boleta borrada se puede volver a hacer desde cero.
  const again = castVote(emptyBallot(), 'Chino', 'passing', 1);
  assert(spent(again) === 1 && remaining(again) === 4, 'se puede volver a votar con los 5 puntos');

  // Si la persona no votó, devuelve la MISMA referencia: React no re-renderiza.
  const untouched = clearBallot(ballots, 'v-nadie');
  assert(untouched === ballots, 'si no había boleta, no cambia la referencia');

  // Casos borde de storage roto / vacío.
  assert(clearBallot([], 'v-ana').length === 0, 'lista vacía no rompe');
  assert(clearBallot(undefined, 'v-ana').length === 0, 'undefined no rompe');
  assert(clearBallot(null, 'v-ana').length === 0, 'null no rompe');

  // Ojo: esto sólo borra lo LOCAL. Los votos de castedVotes.js van en el bundle
  // y los ve todo el mundo, así que el reset de un celu no los toca nunca.
  assert(typeof ballots === 'object' && Array.isArray(ballots), 'la lista sigue siendo de boletas locales');
}

console.log('== I) Resumen de boleta para el admin ==');
{
  let ballot = emptyBallot();
  ballot = castVote(ballot, 'Chino', 'passing', 1);
  ballot = castVote(ballot, 'Chino', 'pace', -1);
  ballot = castVote(ballot, 'Emi', 'shooting', 1);
  const rows = ballotSummary(ballot);
  assert(rows.length === 2, 'agrupa por jugador');
  assert(rows[0].player === 'Chino', 'primero Chino');
  assert(rows[0].parts.some((part) => part.label === 'Pase' && part.delta === 1), 'Chino recibió +1 Pase');
  assert(rows[0].parts.some((part) => part.label === 'Ritmo' && part.delta === -1), 'y −1 Ritmo');
  assert(rows[1].player === 'Emi' && rows[1].parts[0].delta === 1, 'Emi recibió +1 Tiro');
  assert(ballotSummary({}).length === 0, 'boleta vacía no lista a nadie');
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
