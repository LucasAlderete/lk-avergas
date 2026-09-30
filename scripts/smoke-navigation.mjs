// Smoke de navegación de la app reducida: Home ↔ Mi carrera ↔ Plantel ↔ Alineación.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'scripts', 'ssr', 'navigation-entry.jsx');
const outDir = path.join(root, 'tmp', 'ssr-navigation');
const bundle = path.join(outDir, 'navigation-entry.js');
const navigation = await import(pathToFileURL(path.join(root, 'src', 'navigation.js')).href);
const { lineupOnlyPlayers, players } = await import(pathToFileURL(path.join(root, 'src', 'data.js')).href);

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

console.log('== 1) Build SSR de navegación ==');
try {
  execFileSync('npx', ['vite', 'build', '--ssr', entry, '--outDir', outDir, '--emptyOutDir', 'true'], {
    cwd: root,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  assert(fs.existsSync(bundle), 'se generó el bundle SSR de navegación');
} catch (error) {
  fail(`no se pudo compilar el entry SSR (${String(error.message).split('\n')[0]})`);
  console.log(`\n${failures} FALLAS`);
  process.exit(1);
}

const ui = await import(pathToFileURL(bundle).href);

console.log('\n== 2) Render de las cuatro pantallas ==');
const home = ui.renderHome();
const career = ui.renderCareer();
const squad = ui.renderSquad();
const lineup = ui.renderLineup();
const history = ui.renderHistory();
const admin = ui.renderAdmin();
const header = ui.renderCareerHeader();
for (const [name, result] of Object.entries({ home, career, squad, lineup, history, admin, header })) {
  assert(result.ok, `${name} renderiza sin error`);
  assert(Boolean(result.html), `${name} produce HTML`);
}

console.log('\n== 3) Home y exclusiones ==');
// "Mi carrera" se apaga con FEATURE_FLAGS, sin borrar el código. El HTML tiene
// que seguir siempre al flag: si algún día lo prendés, estas mismas
// comprobaciones lo cubren y no hay que tocar el test.
const careerOn = navigation.FEATURE_FLAGS.career !== false;
assert(
  home.html.includes('Mi carrera') === careerOn,
  careerOn ? 'Home contiene Mi carrera' : 'Home no ofrece Mi carrera (está apagada por el flag)',
);
assert(home.html.includes('Plantel'), 'Home contiene Plantel');
assert(home.html.includes('Alineación'), 'Home contiene Alineación');
assert(home.html.includes('Historial'), 'Home contiene Historial');
assert(home.html.includes('Puntaje y frase de cada jugador'), 'Home muestra la descripción de Plantel');
assert(home.html.includes('Arrastrá a los jugadores por la cancha'), 'Home muestra la descripción de Alineación');
assert(
  home.html.includes('Tu carrera profesional') === careerOn,
  'la descripción de Mi carrera aparece sólo si la tarjeta está',
);
for (const retired of ['Juegos', 'Ficha', 'Copero', 'Cartas', 'Partido en vivo', 'Career 2', 'Carrera 2']) {
  assert(!home.html.includes(retired), `Home no contiene la sección retirada ${retired}`);
}
assert(
  (home.html.match(/data-navigation=/g) || []).length === (careerOn ? 4 : 3),
  `Home ofrece exactamente ${careerOn ? 4 : 3} accesos navegables`,
);

console.log('\n== 4) Pantallas y callbacks ==');
// La pantalla de Carrera sigue existiendo y compila aunque esté apagada: el flag
// la esconde, no la borra. Estos checks garantizan que cuando la prendas anda.
assert(career.html.includes('Mi carrera'), 'Mi carrera renderiza su pantalla');
assert(career.html.includes('data-navigation="home"'), 'Mi carrera puede volver a inicio');
assert(career.html.includes('data-navigation="squad"'), 'Mi carrera puede navegar a Plantel');
assert(career.html.includes('data-navigation="lineup"'), 'Mi carrera puede navegar a Alineación');
assert(header.html.includes('Volver a inicio'), 'el header de Carrera ofrece Volver a inicio');
assert(header.html.includes('>Inicio<'), 'el header de Carrera ofrece Inicio');
// Ojo: el texto ">Mi carrera<" aparece también en el título de la barra, así
// que para el menú hay que mirar el atributo data-navigation, no la etiqueta.
assert(
  (header.html.match(/data-navigation="career"/g) || []).length === (careerOn ? 1 : 0),
  careerOn ? 'el header de Carrera ofrece Mi carrera en el menú' : 'el header de Carrera no ofrece Mi carrera en el menú',
);
assert(header.html.includes('>Plantel<'), 'el header de Carrera ofrece Plantel');
assert(header.html.includes('>Alineación<'), 'el header de Carrera ofrece Alineación');
assert(admin.html.includes('Sólo el admin puede ver esto'), 'Votos pide la cuenta admin si no hay sesión');
{
  const adminSource = fs.readFileSync(path.join(root, 'src', 'components', 'AdminScreen.jsx'), 'utf8');
  assert(adminSource.includes('Borrar partido'), 'el admin puede borrar un partido');
  assert(adminSource.includes("method: 'DELETE'"), 'el borrado pega al API');
  assert(adminSource.includes('¿Borrar este partido y sus votos?'), 'pide confirmación antes de borrar');
}
{
  const serverSource = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
  assert(serverSource.includes('app.delete("/api/matches/:id"'), 'el API borra el partido');
  assert(serverSource.includes('ballots.deleteMany({ matchId })'), 'y también las boletas de ese partido');
}
for (const retired of ['Juegos', 'Ficha', 'Volver a los juegos']) {
  assert(!header.html.includes(retired), `el header de Carrera no contiene ${retired}`);
}

assert(squad.html.includes('Plantel'), 'Plantel renderiza su pantalla');
assert(squad.html.includes('data-navigation="home"'), 'Plantel puede volver a inicio');
assert(
  squad.html.includes('data-navigation="career"') === careerOn,
  careerOn ? 'Plantel puede navegar a Mi carrera' : 'Plantel no ofrece Mi carrera',
);
assert(squad.html.includes('data-navigation="lineup"'), 'Plantel puede navegar a Alineación');
assert(squad.html.includes('data-navigation="history"'), 'Plantel puede navegar a Historial');
for (const player of players) {
  assert(squad.html.includes(player.name), `Plantel conserva el jugador ${player.name}`);
  assert(squad.html.includes(player.phrase), `Plantel conserva la frase de ${player.name}`);
  assert(squad.html.includes(String(player.rating)), `Plantel conserva el puntaje de ${player.name}`);
}
// Los "Random" son sólo de la Alineación: no pueden aparecer en el Plantel.
for (const player of lineupOnlyPlayers) {
  assert(!squad.html.includes(player.name), `Plantel no muestra al jugador ${player.name}`);
}
// Pero sí están disponibles en la Alineación.
for (const player of lineupOnlyPlayers) {
  assert(lineup.html.includes(player.name), `Alineación ofrece al jugador ${player.name}`);
}
assert(lineup.html.includes('Randoms Premium Ultra'), 'Alineación muestra Randoms Premium Ultra');
{
  const plantelAt = lineup.html.indexOf('available-pool--squad');
  const ultraAt = lineup.html.indexOf('available-pool--ultra');
  const randomsAt = lineup.html.indexOf('available-pool--randoms');
  assert(plantelAt >= 0 && ultraAt > plantelAt && randomsAt > ultraAt, 'el orden es Avergas, Randoms Premium Ultra, Randoms');
}
for (const pitchOnly of ['DISPONIBLES', 'LESIONADOS', 'shared-pitch', 'Restablecer alineación']) {
  assert(!squad.html.includes(pitchOnly), `Plantel ya no dibuja la cancha (${pitchOnly})`);
}

assert(lineup.html.includes('Alineación'), 'Alineación renderiza su pantalla');
assert(lineup.html.includes('DISPONIBLES'), 'Alineación renderiza disponibles');
assert(lineup.html.includes('LESIONADOS'), 'Alineación renderiza lesionados');
assert(lineup.html.includes('shared-pitch'), 'Alineación renderiza la cancha');
assert(lineup.html.includes('pitch-count-a'), 'contador del equipo azul a la izquierda');
assert(lineup.html.includes('pitch-count-b'), 'contador del equipo rojo a la derecha');
assert((lineup.html.match(/pitch-count-ovr/g) || []).length === 2, 'cada equipo muestra su promedio');
assert(lineup.html.includes('5/5'), 'con fútbol 5 el contador es 5/5');
{
  const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  const leftRule = /\.pitch-count-a \{([^}]*)\}/.exec(css)?.[1] || '';
  const rightRule = /\.pitch-count-b \{([^}]*)\}/.exec(css)?.[1] || '';
  assert(/left:\s*8px/.test(leftRule), 'el 5/5 azul va a la esquina izquierda');
  assert(/right:\s*8px/.test(rightRule), 'el 5/5 rojo va a la esquina derecha');
  assert(!/left:\s*50%/.test(/\.pitch-count \{([^}]*)\}/.exec(css)?.[1] || ''), 'ya no están centrados juntos');
}
// La flechita de estado: clickeable y con el estado actual expuesto.
assert((lineup.html.match(/class="status-arrow status-/g) || []).length > 0, 'Alineación muestra las flechas de estado');
assert(lineup.html.includes('data-status="'), 'cada flecha expone su estado en data-status');
for (const label of ['Arriba', 'Arriba-derecha', 'Derecha', 'Abajo-derecha', 'Abajo']) {
  assert(lineup.html.includes(`: ${label}`), `las flechas nombran el estado "${label}"`);
}
// Los lesionados son checks, no drag and drop.
assert((lineup.html.match(/type="checkbox"/g) || []).length === players.length, 'hay un check por cada jugador del Plantel');
assert(!lineup.html.includes('injured-row'), 'la lista de lesionados ya no arrastra');
assert(lineup.html.includes('data-navigation="home"'), 'Alineación puede volver a inicio');
assert(
  lineup.html.includes('data-navigation="career"') === careerOn,
  careerOn ? 'Alineación puede navegar a Mi carrera' : 'Alineación no ofrece Mi carrera',
);
assert(lineup.html.includes('data-navigation="squad"'), 'Alineación puede navegar a Plantel');
assert(lineup.html.includes('data-navigation="history"'), 'Alineación puede navegar a Historial');

assert(history.html.includes('Historial'), 'Historial renderiza su pantalla');
assert(history.html.includes('quién subió o bajó de OVR'), 'Historial avisa que muestra los movimientos de OVR');
assert(history.html.includes('data-navigation="home"'), 'Historial puede volver a inicio');
assert(history.html.includes('data-navigation="squad"'), 'Historial puede navegar a Plantel');

const homeCalls = ui.exerciseHomeCallbacks();
assert(homeCalls.includes('career') === careerOn, careerOn ? 'Home -> Mi carrera ejecuta el callback' : 'Home no llama a Mi carrera');
assert(homeCalls.includes('squad'), 'Home -> Plantel ejecuta el callback');
assert(homeCalls.includes('lineup'), 'Home -> Alineación ejecuta el callback');
assert(homeCalls.includes('history'), 'Home -> Historial ejecuta el callback');
const careerCalls = ui.exerciseCareerCallbacks();
for (const target of ['home', 'career', 'squad', 'lineup', 'history'].filter((id) => id !== 'career' || careerOn)) {
  assert(careerCalls.includes(target), `Mi carrera -> ${target} ejecuta el callback`);
}
const squadCalls = ui.exerciseSquadCallbacks();
assert(squadCalls.includes('home'), 'Plantel -> Inicio ejecuta el callback');
assert(squadCalls.includes('career') === careerOn, careerOn ? 'Plantel -> Mi carrera ejecuta el callback' : 'Plantel no llama a Mi carrera');
assert(squadCalls.includes('lineup'), 'Plantel -> Alineación ejecuta el callback');
assert(squadCalls.includes('history'), 'Plantel -> Historial ejecuta el callback');
assert(!squadCalls.includes('squad'), 'Plantel no navega a sí mismo');
const lineupCalls = ui.exerciseLineupCallbacks();
assert(lineupCalls.includes('home'), 'Alineación -> Inicio ejecuta el callback');
assert(lineupCalls.includes('career') === careerOn, careerOn ? 'Alineación -> Mi carrera ejecuta el callback' : 'Alineación no llama a Mi carrera');
assert(lineupCalls.includes('squad'), 'Alineación -> Plantel ejecuta el callback');
assert(lineupCalls.includes('history'), 'Alineación -> Historial ejecuta el callback');
assert(!lineupCalls.includes('lineup'), 'Alineación no navega a sí misma');

console.log('\n== 5) Máquina de navegación ==');
// Sólo las pantallas prendidas son rutas: la lista sale del mismo flag que usa
// el menú, así que no puede quedar una ruta viva sin botón (ni al revés).
const routes = [...navigation.APP_SCREENS];
for (const from of routes) {
  for (const to of routes) {
    assert(navigation.transitionScreen(from, to) === to, `transición ${from} → ${to}`);
  }
}
assert(navigation.isAppScreen('lineup'), 'lineup es una pantalla válida');
assert(navigation.isAppScreen('history'), 'history es una pantalla válida');
assert(navigation.isAppScreen('career') === careerOn, 'el estado de Mi carrera sigue al flag');
for (const retired of ['games', 'match', 'cards', 'profile', 'formation', 'career2']) {
  assert(navigation.transitionScreen('home', retired) === 'home', `la ruta ${retired} no es accesible`);
  assert(navigation.resolveStoredScreen(retired) === 'home', `el storage no restaura ${retired}`);
}
// Apagada: ni se entra ni el storage la restaura (quien la tenía guardada cae
// en Inicio, no se queda en una pantalla que ya no existe para el usuario).
if (!careerOn) {
  assert(navigation.transitionScreen('home', 'career') === 'home', 'no se puede entrar a Mi carrera');
  assert(navigation.transitionScreen('squad', 'career') === 'squad', 'ni desde otra pantalla');
  assert(navigation.resolveStoredScreen('career') === 'home', 'el storage no restaura Mi carrera');
}
assert(navigation.resolveStoredScreen('lineup') === 'lineup', 'el storage restaura la pantalla Alineación');
assert(navigation.resolveStoredScreen('history') === 'history', 'el storage restaura el Historial');
assert(!navigation.isAppScreen('admin'), 'Votos no es una ruta pública');
assert(!navigation.canOpenScreen('admin'), 'sin admin no entra a Votos');
assert(navigation.canOpenScreen('admin', { isAdmin: true }), 'el admin sí entra a Votos');
assert(navigation.resolveStoredScreen('admin') === 'home', 'el storage no restaura Votos sin admin');
assert(navigation.transitionScreen('home', 'admin', { isAdmin: true }) === 'admin', 'el admin puede ir a Votos');
assert(!home.html.includes('Quién le dio puntos a quién'), 'Home no muestra Votos si no sos admin');

console.log('\n== 6) Persistencia y datos ==');
const lineupSource = fs.readFileSync(path.join(root, 'src', 'components', 'LineupEditor.jsx'), 'utf8');
// Las claves se suben de versión cuando cambia el default (v2 = la formación
// con los diez de siempre). Lo que importa es que no se mezclen: si bajaran a
// una versión vieja, alguien leería un guardado con otro formato.
for (const key of ['avergas-lineup-v2', 'avergas-injuries-v3', 'avergas-player-status-v1']) {
  assert(lineupSource.includes(key), `se conserva la clave ${key}`);
}
for (const staleKey of ['avergas-lineup-v1"', 'avergas-injuries-v2"']) {
  assert(!lineupSource.includes(staleKey), `la clave vieja ${staleKey} ya no se usa`);
}
const selectionSource = fs.readFileSync(path.join(root, 'src', 'components', 'playerSelection.js'), 'utf8');
assert(selectionSource.includes('avergas-player'), 'la selección de jugador conserva su clave y la comparten ambas pantallas');
assert(players.length > 0 && lineup.html.includes('Alineación'), 'Alineación usa el roster existente');

console.log('\n== 6-bis) Ficha de stats ==');
{
  const sheet = ui.renderStatsSheet();
  assert(sheet.ok && sheet.html, 'la ficha de stats renderiza');
  const chino = players.find((player) => player.name === 'Chino');
  assert(sheet.html.includes('Chino'), 'la ficha muestra el nombre del jugador');
  assert(sheet.html.includes(`OVR ${ui.playerOvr(chino)}`), 'la ficha muestra el OVR');
  for (const label of ['Ritmo', 'Tiro', 'Pase', 'Regate', 'Defensa', 'Físico']) {
    assert(sheet.html.includes(label), `la ficha muestra el atributo ${label}`);
  }
  assert(sheet.html.includes('role="dialog"'), 'es un diálogo modal accesible');
  assert(sheet.html.includes('Cerrar stats'), 'tiene botón de cerrar');
  assert(sheet.html.includes('Medallero'), 'la ficha muestra el medallero');
  assert(sheet.html.includes('MVP por primera vez'), 'lista la medalla de primer MVP');
  // El OVR es exactamente el promedio de los 6 atributos de FIFA, ya pasados a
  // 0-99 (los mismos números que muestran las barras).
  for (const player of players) {
    const stats = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical']
      .map((key) => Math.round(player[key] * 10));
    const average = Math.round(stats.reduce((sum, value) => sum + value, 0) / stats.length);
    assert(ui.playerOvr(player) === average, `el OVR de ${player.name} es el promedio de sus atributos`);
    assert(player.rating === ui.playerOvr(player), `el OVR guardado de ${player.name} coincide con el cálculo`);
  }
  // Plantel no muestra la ficha hasta que se toca un jugador.
  assert(!squad.html.includes('role="dialog"'), 'la ficha no está abierta por defecto en Plantel');
  assert(squad.html.includes('Tocá un jugador para ver sus stats'), 'Plantel invita a tocar un jugador');
}

console.log('\n== 7) Fotos de los jugadores ==');
{
  const info = ui.photoInfo();
  console.log(`   con foto: ${info.withPhoto.length} · sin foto: ${info.withoutPhoto.length}`);
  console.log(`   con foto: ${info.withPhoto.join(', ')}`);

  // Una foto que no se asocia a nadie es invisible: nadie la ve y nadie sabe
  // que está ahí. Con el apodo de "pelado" ya resuelto, no debería quedar ninguna.
  assert(
    info.unused.length === 0,
    `no sobran fotos sin jugador (sobran: ${info.unused.join(', ')})`,
  );

  assert(info.withPhoto.length > 0, 'hay al menos una foto cargada');
  assert(
    info.withPhoto.length + info.withoutPhoto.length === players.length,
    'todos los jugadores están clasificados (con o sin foto)',
  );

  // Cada foto es una URL del bundle (no una ruta suelta que no exista).
  for (const name of info.withPhoto) {
    const url = info.of(name);
    assert(typeof url === 'string' && url.length > 0, `${name} tiene URL de foto`);
    assert(url.startsWith('/'), `la foto de ${name} es una ruta del bundle (${url})`);
  }

  // Plantel: los que tienen foto muestran <img>, los demás las iniciales.
  const imgCount = (squad.html.match(/class="player-card-photo"/g) || []).length;
  assert(imgCount === info.withPhoto.length, `Plantel dibuja ${info.withPhoto.length} miniaturas con foto`);
  assert(!squad.html.includes('class="player-card-photo" alt="" loading="lazy" decoding="async" src="undefined"'), 'ninguna foto quedó sin URL');
  for (const name of info.withoutPhoto) {
    const initials = name.slice(0, 2).toUpperCase();
    assert(squad.html.includes(`>${initials}<`), `${name} (sin foto) cae a las iniciales ${initials}`);
  }

  // El modal: banner grande arriba para los que tienen foto.
  const chino = players.find((player) => player.name === 'Chino');
  const withPhotoSheet = ui.renderStatsSheet(chino);
  assert(withPhotoSheet.html.includes('class="stats-banner"'), `${chino.name} abre el banner con su foto`);
  assert(withPhotoSheet.html.includes('class="stats-banner-img"'), 'el banner trae la imagen');
  assert(withPhotoSheet.html.includes('stats-banner-scrim'), 'el banner tiene el velo para leer el nombre encima');
  assert(withPhotoSheet.html.includes('stats-sheet-head is-over'), 'el OVR y el nombre se superponen al banner');
  assert(withPhotoSheet.html.includes('is-banner'), 'la hoja se marca como "con banner"');
  assert(withPhotoSheet.html.includes(info.of(chino.name)), 'y usa la misma foto que la miniatura');

  // Sin foto: ni banner ni velo, y la hoja queda como estaba.
  const sinFoto = players.find((player) => info.withoutPhoto.includes(player.name));
  if (sinFoto) {
    const plainSheet = ui.renderStatsSheet(sinFoto);
    assert(!plainSheet.html.includes('stats-banner'), `${sinFoto.name} (sin foto) no dibuja banner`);
    assert(!plainSheet.html.includes('is-over'), `${sinFoto.name} no superpone el header`);
    assert(plainSheet.html.includes('stats-ovr'), 'pero el OVR y los atributos siguen ahí');
  }

  // La foto del banner tiene que verse COMPLETA. Las fotos son cuadradas y con
  // `cover` (que es lo que había antes) se cortaban a la mitad sin avisar.
  const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  const bannerRule = /\.stats-banner-img \{([^}]*)\}/.exec(css)?.[1] || '';
  assert(bannerRule.length > 0, 'existe la regla .stats-banner-img');
  assert(/object-fit:\s*contain/.test(bannerRule), 'el banner usa object-fit: contain (se ve entera)');
  assert(!/object-fit:\s*cover/.test(bannerRule), 'y NO cover, que la recortaba a la mitad');
  assert(/height:\s*auto/.test(bannerRule), 'el alto lo define la imagen (no se estira)');
  // El header se superpone con margen negativo: eso es lo que arma la carta.
  assert(/\.stats-sheet-head\.is-over \{[^}]*margin-top:\s*-\d/.test(css), 'el header se superpone al banner');
}

console.log('\n== 8) Audios de los jugadores ==');
{
  const info = ui.audioInfo();
  assert(info.keyFrom('rui_1') === 'rui', 'rui_1.m4a se asocia a Rui');
  assert(info.keyFrom('rui_5') === 'rui', 'rui_5.m4a también se asocia a Rui');
  assert(info.keyFrom('gonzi_1') === 'gonzi', 'gonzi_1.m4a se asocia a Gonzi');
  assert(info.keyFrom('sailor_1') === 'sailor', 'sailor_1.m4a se asocia a Sailor');
  assert(info.keyFrom('mati_1') === 'mati', 'mati_1.m4a se asocia a Mati');
  assert(info.keyFrom('cru_1') === 'cru', 'cru_1.m4a se asocia a Cru');
  assert(info.keyFrom('rui') === 'rui', 'rui.m4a también');
  assert(info.keyFrom('chino_2') === 'chino', 'chino_2.m4a se asocia a Chino');
  assert(info.unused.length === 0, `no sobran audios sin jugador (sobran: ${info.unused.join(', ')})`);
  for (const name of ['Rui', 'Gonzi', 'Sailor', 'Mati', 'Cru']) {
    assert(info.withAudio.includes(name), `${name} tiene al menos un audio`);
    assert(info.clips(name).length >= (name === 'Rui' ? 5 : 1), `${name} tiene clips para reproducir`);
    assert(squad.html.includes(`Reproducir audio de ${name}`), `Plantel muestra el 🔈 de ${name}`);
    const sheet = ui.renderStatsSheet(players.find((player) => player.name === name));
    assert(sheet.html.includes(`Reproducir audio de ${name}`), `la ficha de ${name} también tiene el 🔈`);
  }
  assert(info.clips('Rui').every((url) => typeof url === 'string' && url.length > 0), 'los clips de Rui son URLs del bundle');
  assert(!squad.html.includes('Reproducir audio de Chino'), 'quien no tiene audio no muestra el 🔈');
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
