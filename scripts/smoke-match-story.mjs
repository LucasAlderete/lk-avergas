// Smoke de resultado por diferencia, MVP/peor y medallas.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const story = await import(pathToFileURL(path.join(root, 'src', 'matches', 'matchStory.js')).href);
const { players } = await import(pathToFileURL(path.join(root, 'src', 'data.js')).href);
const { withVotes } = await import(pathToFileURL(path.join(root, 'src', 'voting', 'voteRules.js')).href);

const {
  buildHistory, highlights, historyCard, medalsOf, netReceived, ovrJump, parseResult, playedIn,
  playerTeam, ratingMoves, resultLine, teamsFromSlots, wonMatch,
} = story;

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

console.log('== A) Resultado por diferencia ==');
{
  assert(parseResult({ winner: 'teamB', margin: 4 }).margin === 4, 'rojo por 4 guarda la diferencia');
  assert(parseResult({ winner: 'teamB', margin: 4 }).winner === 'teamB', 'el ganador es el rojo');
  assert(parseResult({ winner: 'draw' }).margin === 0, 'empate no tiene diferencia');
  assert(parseResult({ winner: 'teamA', margin: 0 }) === null, 'ganar por 0 no vale');
  assert(parseResult({ winner: 'teamA', margin: 21 }) === null, 'más de 20 no vale');
  assert(parseResult({ winner: 'verde', margin: 2 }) === null, 'un color inventado no vale');
  assert(resultLine({ winner: 'teamB', margin: 4 }) === 'Ganó el rojo por 4 goles', 'el texto habla de diferencia, no de 5-1');
  assert(resultLine({ winner: 'draw' }) === 'Empate', 'empate se lee empate');
  assert(resultLine(null) === 'Todavía no hay resultado', 'sin cargar, se avisa');
}

console.log('== B) Equipos desde la cancha ==');
{
  const slots = [
    { name: 'Gonzi', x: 50, y: 20 },
    { name: 'Rui', x: 50, y: 80 },
    { name: 'Chino', x: 30, y: 25 },
  ];
  const teams = teamsFromSlots(slots);
  assert(teams.teamA.join(',') === 'Gonzi,Chino', 'arriba son azules');
  assert(teams.teamB.join(',') === 'Rui', 'abajo es rojo');
  const match = { slots, result: { winner: 'teamB', margin: 4 } };
  assert(playerTeam(match, 'Rui') === 'teamB', 'Rui estaba en el rojo');
  assert(wonMatch(match, 'Rui') === true, 'Rui ganó con el rojo');
  assert(wonMatch(match, 'Gonzi') === false, 'Gonzi no ganó');
  assert(playedIn(match, 'Chino'), 'Chino jugó');
}

console.log('== C) MVP y peor por votos del partido ==');
{
  const ballots = [
    { Gonzi: { pace: 1, shooting: 1 }, Rui: { pace: -1 } },
    { Gonzi: { passing: 1 }, Chino: { defense: -1, physical: -1 } },
  ];
  const nets = netReceived(ballots);
  assert(nets.Gonzi === 3, 'Gonzi recibió +3 netos');
  assert(nets.Rui === -1, 'Rui recibió -1');
  assert(nets.Chino === -2, 'Chino recibió -2');
  const marks = highlights(nets);
  assert(JSON.stringify(marks.mvp) === JSON.stringify(['Gonzi']), 'MVP es quien más positivo recibió');
  assert(JSON.stringify(marks.worst) === JSON.stringify(['Chino']), 'el peor es quien más negativo recibió');
  const bump = { pace: 1, shooting: 1, passing: 1, dribbling: 1, defense: 1, physical: 1 };
  const gonzi = players.find((player) => player.name === 'Gonzi');
  const rui = players.find((player) => player.name === 'Rui');
  const gonziTo = withVotes(gonzi, bump).rating;
  const ruiTo = withVotes(rui, { pace: -1, shooting: -1, passing: -1, dribbling: -1, defense: -1, physical: -1 }).rating;
  const ovr = ratingMoves({ Gonzi: bump, Rui: { pace: -1, shooting: -1, passing: -1, dribbling: -1, defense: -1, physical: -1 } });
  assert(ovr.up[0].name === 'Gonzi' && ovr.up[0].from === gonzi.rating && ovr.up[0].to === gonziTo, 'subió el OVR de Gonzi, no el conteo de +1');
  assert(ovr.down[0].name === 'Rui' && ovr.down[0].from === rui.rating && ovr.down[0].to === ruiTo, 'bajó el OVR de Rui');
  assert(ovrJump(ovr.up[0]) === `${gonzi.rating} → ${gonziTo}`, 'el cartel es 87 → 88');
  const ruiUp = ratingMoves({ Rui: bump });
  assert(ovrJump(ruiUp.up[0]) === `${rui.rating} → ${rui.rating + 1}`, 'Rui 71 → 72 cuando el OVR global sube');
  const tie = highlights({ Alan: 2, Nahue: 2, Rui: -1, Lk: -1 });
  assert(JSON.stringify(tie.mvp) === JSON.stringify(['Alan', 'Nahue']), 'empate de MVP entra los dos');
  assert(JSON.stringify(tie.worst) === JSON.stringify(['Lk', 'Rui']), 'empate de peor entra los dos');
  const none = highlights({ Alan: 0, Rui: 0 });
  assert(none.mvp.length === 0 && none.worst.length === 0, 'todo en 0 no destaca a nadie');
}

console.log('== D) Medallas ==');
{
  const day = (n) => ({
    status: 'closed',
    createdAt: `2026-01-${String(n).padStart(2, '0')}T12:00:00.000Z`,
    slots: n % 2 === 0
      ? [{ name: 'Alan', x: 50, y: 80 }]
      : [{ name: 'Alan', x: 50, y: 20 }, { name: 'Rui', x: 50, y: 80 }],
    result: n % 2 === 0
      ? { winner: 'teamB', margin: 2 }
      : { winner: 'teamA', margin: 1 },
    mvp: n === 1 ? ['Alan'] : [],
  });

  const first = medalsOf('Alan', [day(1)]);
  assert(first.find((medal) => medal.id === 'first-mvp').earned, 'el primer MVP desbloquea la medalla');
  assert(!first.find((medal) => medal.id === 'played-10').earned, 'un partido no alcanza para 10');

  const five = medalsOf('Alan', [1, 2, 3, 4, 5].map(day));
  assert(five.find((medal) => medal.id === 'streak-played-5').earned, '5 seguidos jugados desbloquean');

  const broken = [
    day(1), day(2), day(3),
    { status: 'closed', createdAt: '2026-01-04T12:00:00.000Z', slots: [{ name: 'Rui', x: 50, y: 20 }], result: { winner: 'teamA', margin: 1 }, mvp: [] },
    day(5), day(6), day(7), day(8),
  ];
  const afterMiss = medalsOf('Alan', broken);
  assert(!afterMiss.find((medal) => medal.id === 'streak-played-5').earned, 'faltar un partido corta la racha de jugados');

  const wins = [1, 3, 5].map(day);
  const threeWins = medalsOf('Alan', wins);
  assert(threeWins.find((medal) => medal.id === 'streak-won-3').earned, '3 ganados seguidos (los que jugó y ganó) desbloquean');

  const ten = medalsOf('Alan', Array.from({ length: 10 }, (_, i) => day(i + 1)));
  assert(ten.find((medal) => medal.id === 'played-10').earned, '10 jugados en total desbloquean');
  assert(ten.every((medal) => medal.earned), 'con 10 partidos de Alan se pueden cumplir las cuatro');
}

console.log('== E) Tarjeta de historial ==');
{
  const card = historyCard(
    {
      _id: 'abc',
      status: 'closed',
      mode: 5,
      slots: [{ name: 'Gonzi', x: 40, y: 20 }, { name: 'Rui', x: 40, y: 80 }],
      result: { winner: 'teamB', margin: 4 },
    },
    [{ Gonzi: { pace: 1, shooting: 1, passing: 1, dribbling: 1, defense: 1, physical: 1 }, Rui: { pace: -1, shooting: -1, passing: -1, dribbling: -1, defense: -1, physical: -1 } }],
  );
  const gonzi = players.find((player) => player.name === 'Gonzi');
  const rui = players.find((player) => player.name === 'Rui');
  assert(card.result.margin === 4, 'la tarjeta guarda la diferencia');
  assert(card.mvp[0] === 'Gonzi' && card.worst[0] === 'Rui', 'MVP y peor salen de los votos de ese partido');
  assert(card.teams.teamA.join(',') === 'Gonzi' && card.teams.teamB.join(',') === 'Rui', 'la tarjeta lista los dos equipos');
  assert(card.up[0].from === gonzi.rating && card.up[0].to === gonzi.rating + 1, 'Gonzi aparece con el OVR de antes y el de después');
  assert(card.down[0].from === rui.rating && card.down[0].to === rui.rating - 1, 'Rui también');
  const stacked = buildHistory(
    [
      { _id: '1', status: 'closed', createdAt: '2026-01-01', slots: [{ name: 'Gonzi', x: 40, y: 20 }] },
      { _id: '2', status: 'closed', createdAt: '2026-01-02', slots: [{ name: 'Gonzi', x: 40, y: 20 }] },
    ],
    {
      1: [{ Gonzi: { pace: 1, shooting: 1, passing: 1, dribbling: 1, defense: 1, physical: 1 } }],
      2: [{ Gonzi: { pace: 1, shooting: 1, passing: 1, dribbling: 1, defense: 1, physical: 1 } }],
    },
  );
  assert(stacked[0].id === '2', 'el historial se lista del más nuevo al más viejo');
  assert(stacked[1].up[0].from === gonzi.rating && stacked[0].up[0].from === gonzi.rating + 1, 'el segundo partido parte del OVR que dejó el primero');
}

if (failures) {
  console.error(`FALLAS: ${failures}`);
  process.exit(1);
}
console.log('TODO OK');
