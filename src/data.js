const roster = [
  { name: 'Chino', pace: 8.6, shooting: 6.6, passing: 6.8, dribbling: 6.8, defense: 9.6, physical: 9, phrase: 'Inflando sueños', lore: { perfil: 'El chino que siempre busca la ventaja.', rasgos: ['es chino'], cargadas: ['hace trampa para sacar ventaja', 'se queja de todo a cada rato'] } },
  { name: 'Emi', pace: 6.6, shooting: 8.5, passing: 6.7, dribbling: 8.4, defense: 8.5, physical: 6.9, phrase: 'Aah ahhh ahhh ∞', lore: { perfil: 'El colorado bonachón de más de 100 kg.', rasgos: ['es colorado', 'es gordo (+100 kg)', 'es buen pibe'], cargadas: ['el romance de Cru con su hermana'] } },
  { name: 'Mati', pace: 6.2, shooting: 6.1, passing: 7.9, dribbling: 6.5, defense: 7.5, physical: 7.2, phrase: 'Real Madrid fan', lore: { perfil: 'El fanático del Real Madrid.', rasgos: ['hincha del Real Madrid'], cargadas: [] } },
  { name: 'Rui', pace: 5.8, shooting: 7.5, passing: 7.2, dribbling: 6.9, defense: 8.4, physical: 6.8, phrase: 'Exportador de ruilleros', lore: { perfil: 'El gordo bajón.', rasgos: ['es gordo (+100 kg)', 'es súper pesimista'], cargadas: ['es el rey del malviaje', 'siempre la está bajando ("la baja")'] } },
  { name: 'Gonzi', pace: 9.3, shooting: 8.4, passing: 7.9, dribbling: 9.3, defense: 7.8, physical: 9.5, phrase: '¿Qué le faltó a tu equipo?', lore: { perfil: 'La estrella del grupo.', rasgos: ['es el crack'], cargadas: [] } },
  { name: 'Lucas', pace: 6.9, shooting: 8.3, passing: 8.4, dribbling: 8.8, defense: 6.5, physical: 6.1, phrase: '$5000. Winter is here', lore: { perfil: 'El hombre de los $5000.', rasgos: ['cobra $5000', 'Winter is here'], cargadas: [] } },
  { name: 'Tigre', pace: 9.9, shooting: 9.9, passing: 9.9, dribbling: 9.9, defense: 9.9, physical: 9.9, phrase: 'La amenaza silenciosa', lore: { perfil: 'El sensible.', rasgos: ['es muy sensible'], cargadas: ['sus problemas con las drogas (chiste)'] } },
  { name: 'Rulo', pace: 6, shooting: 5.8, passing: 7.6, dribbling: 6.8, defense: 6.7, physical: 6.7, phrase: 'Desde la lesión ya no soy el mismo', lore: { perfil: 'El bajito de rulos que vive en kinesiología.', rasgos: ['es muy enano', 'tiene rulos', 'siempre está lesionado'], cargadas: ['está siempre lesionado'] } },
  { name: 'Sailor', pace: 9.5, shooting: 7.8, passing: 6.3, dribbling: 8, defense: 6.7, physical: 9.7, phrase: 'Malviajo, luego existo', lore: { perfil: 'El insoportable intenso del grupo.', rasgos: ['es el insoportable', 'es simpático pero intenso'], cargadas: ['siempre está malviajando'] } },
  { name: 'Cru', pace: 7.2, shooting: 6.6, passing: 6.7, dribbling: 6.7, defense: 7.2, physical: 8.8, phrase: '¿Alguien dijo hermana?', lore: { perfil: 'El ratón de gimnasio.', rasgos: ['es fanático del gimnasio', 'siempre se quiere sacar la remera para mostrar su físico'], cargadas: ['quiere acostarse con las hermanas de los amigos'] } },
  { name: 'Nahue', pace: 6.8, shooting: 7.1, passing: 7.1, dribbling: 6.8, defense: 7.5, physical: 6.7, phrase: 'Mis 3 dedos es lo único que tengo', lore: { perfil: 'El más pajero.', rasgos: ['es el más pajero (siempre sin ganas)', 'es el más falopero'], cargadas: ['estar siempre sin ganas', 'el falopero (chiste)'] } },
  { name: 'JJ', pace: 8.1, shooting: 7.8, passing: 8, dribbling: 8.5, defense: 7.7, physical: 8.5, phrase: '¿A qué hora te vas?', lore: { perfil: 'El conquistador.', rasgos: ['siempre quiere conquistar a las mujeres de los amigos'], cargadas: ['quiere levantarse a las mujeres de los amigos'] } },
  { name: 'Luquitas', pace: 7, shooting: 7, passing: 7, dribbling: 7, defense: 7, physical: 7, phrase: 'Equilibrio total', lore: { perfil: 'El equilibrado.', rasgos: ['es parejo en todo'], cargadas: [] } },
  { name: 'Kike', pace: 7.4, shooting: 8.2, passing: 7, dribbling: 8.1, defense: 4.8, physical: 6.5, phrase: 'Un toque más y era gol', pool: 'premium', lore: { perfil: 'El del toque extra.', rasgos: ['casi siempre mete gol'], cargadas: [] } },
  { name: 'Alan', pace: 6.2, shooting: 5.9, passing: 7.9, dribbling: 7.1, defense: 7.6, physical: 7.3, phrase: 'Yo la veo, vos correte', lore: { perfil: 'El armador.', rasgos: ['ve todos los pases'], cargadas: [] } },
  { name: 'Wini', pace: 6.7, shooting: 6.9, passing: 7.4, dribbling: 6.8, defense: 7.2, physical: 7, phrase: 'Uno de los de siempre', lore: { perfil: 'Averga oficial del grupo.', rasgos: ['es un averga oficial'], cargadas: [] } },
];

const even70 = {
  pace: 7, shooting: 7, passing: 7, dribbling: 7, defense: 7, physical: 7,
};

// ============================================================================
// JUGADORES SOLO DE ALINEACIÓN
// ============================================================================
// No forman parte del Plantel: sólo existen en la pantalla de Alineación
// (cancha y lista de disponibles). Sirven para completar los equipos hasta 5 o
// 6 por lado sin tocar el roster real.
const lineupOnlyRoster = [
  { name: 'Random 1', pace: 5.5, shooting: 5.5, passing: 5.5, dribbling: 5.5, defense: 5.5, physical: 5.5, phrase: 'Recién llegando', lineupOnly: true, pool: 'randoms' },
  { name: 'Random 2', pace: 5.8, shooting: 6.2, passing: 5.4, dribbling: 5.9, defense: 5.1, physical: 6.4, phrase: 'Prestón del barrio', lineupOnly: true, pool: 'randoms' },
  { name: 'Random 3', pace: 6.1, shooting: 6.6, passing: 6.3, dribbling: 6.0, defense: 5.8, physical: 6.2, phrase: 'Juega de a poco', lineupOnly: true, pool: 'randoms' },
  { name: 'Random 4', pace: 6.4, shooting: 7.0, passing: 6.8, dribbling: 7.1, defense: 6.0, physical: 6.6, phrase: 'Silencioso y rápido', lineupOnly: true, pool: 'randoms' },
  { name: 'Random 5', pace: 6.9, shooting: 7.6, passing: 7.2, dribbling: 7.4, defense: 6.4, physical: 7.1, phrase: 'La figura del partido', lineupOnly: true, pool: 'randoms' },
  { name: 'Pablito Lechuga', ...even70, phrase: 'La lechuga', lineupOnly: true, pool: 'randoms' },
  { name: 'Joni Pelado 2', ...even70, phrase: 'El pelado 2', lineupOnly: true, pool: 'randoms' },
  { name: 'Fede', ...even70, phrase: 'Randoms Premium Ultra', lineupOnly: true, pool: 'premium' },
];

// ============================================================================
// OVR = PROMEDIO DE LOS 6 ATRIBUTOS (los de FIFA)
// ============================================================================
// Ritmo, Tiro, Pase, Regate, Defensa y Físico van de 0 a 10 en el archivo y se
// muestran en 0-99. El OVR es su promedio, igual que hace FIFA con los
// atributos base. Se CALCULA siempre: no hay número guardado, así que el OVR
// nunca puede quedar desfasado de los stats.
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const RATING_STATS = [
  { key: 'pace', label: 'Ritmo', abbr: 'RIT' },
  { key: 'shooting', label: 'Tiro', abbr: 'TIR' },
  { key: 'passing', label: 'Pase', abbr: 'PAS' },
  { key: 'dribbling', label: 'Regate', abbr: 'REG' },
  { key: 'defense', label: 'Defensa', abbr: 'DEF' },
  { key: 'physical', label: 'Físico', abbr: 'FÍS' },
];

// Un atributo individual en escala 0-99 (para las barras y para el OVR).
export const statOf = (player, key) => {
  const value = Number(player?.[key]);
  const safe = Number.isFinite(value) ? clamp(value, 0, 10) : 0;
  return clamp(Math.round(safe * 10), 0, 99);
};

// El OVR final: promedio de los SEIS atributos ya pasados a 0-99. Se promedian
// los valores redondeados (los mismos que muestra la barra) para que el OVR
// nunca se mueva solo por redondeo cuando no hay votos.
export const overallOf = (player) => Math.round(
  RATING_STATS.reduce((sum, stat) => sum + statOf(player, stat.key), 0) / RATING_STATS.length,
);

// Plantel: los 16 amigos, con el OVR ya calculado.
export const players = roster.map((player) => ({ ...player, rating: overallOf(player) }));

// Roster de la Alineación: el Plantel + los que sólo están acá.
export const alignmentPlayers = [...players, ...lineupOnlyRoster.map((player) => ({
  ...player,
  rating: overallOf(player),
}))];

// OJO: `lineupOnlyPlayers` sale de `alignmentPlayers` para que sea el mismo
// objeto que usa la pantalla de Alineación.
export const lineupOnlyPlayers = alignmentPlayers.filter((player) => player.lineupOnly);

export const POOL = Object.freeze({
  squad: 'squad',
  randoms: 'randoms',
  premium: 'premium',
});

export const poolOf = (player) => {
  if (player?.pool === POOL.premium || player?.pool === POOL.randoms || player?.pool === POOL.squad) {
    return player.pool;
  }
  return player?.lineupOnly ? POOL.randoms : POOL.squad;
};
