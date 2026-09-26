// ============================================================================
// Smoke del FOCO DE LAS HOJAS MODALES
// Uso: node scripts/smoke-sheet-focus.mjs
//
// Por qué existe: las hojas de stats y de votación hacen, al abrirse,
//   document.body.style.overflow = 'hidden'   y   closeRef.focus().
// Eso congela la página y enfoca la X de arriba. Está perfecto al ABRIR.
//
// El bug: el useEffect dependía de [player, onClose]. `onClose` se pasa como
// arrow inline desde Plantel (`onClose={() => setOpen(null)}`), así que cambia
// de identidad en cada render. Escribir una letra en el input del votante
// re-renderizaba Plantel -> el efecto se volvía a disparar -> la X recuperaba
// el foco -> el navegador la traía a la vista y el scroll saltaba arriba.
//
// No hay jsdom en el proyecto, así que en vez de montar un DOM real se chequea
// la invariante queeahi lo rompía: en un useEffect, jamás una función como
// dependencia, sólo valores primitivos o refs. Un callback inline como
// dependencia siempre es un bug esperando.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

// Saca cada useEffect(...) junto con su array de dependencias.
const effectsOf = (source) => {
  const found = [];
  const re = /useEffect\(\s*(?:async\s*)?\(([\s\S]*?)\)\s*=>\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    // Avanza la llave del cuerpo para no cortar antes de tiempo.
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    const body = source.slice(re.lastIndex, i - 1);
    const tail = source.slice(i);
    // Ojo: el `}` de cierre del cuerpo ya lo consumió el escaneo de llaves de
    // arriba, así que acá sólo se busca la coma con el array de deps.
    const deps = /^\s*,\s*\[([^\]]*)\]\s*\)\s*;?/.exec(tail);
    found.push({
      label: body.trim().split('\n')[0].slice(0, 40),
      args: match[1].split(',').map((arg) => arg.trim()).filter(Boolean),
      body,
      deps: deps ? deps[1].split(',').map((d) => d.trim()).filter(Boolean) : null,
    });
  }
  return found;
};

console.log('== A) Ningún useEffect depende de un callback ==');
{
  const sheets = [
    ['src/voting/VoteSheet.jsx', ['onClose', 'onCast', 'onLabelChange']],
    ['src/components/PlayerStatsSheet.jsx', ['onClose']],
  ];
  for (const [rel, callbacks] of sheets) {
    const source = read(rel);
    const effects = effectsOf(source);
    assert(effects.length > 0, `${rel}: se encontró al menos un useEffect`);

    for (const effect of effects) {
      assert(effect.deps !== null, `${rel}: el efecto "${effect.label}" tiene deps`);
      for (const dep of effect.deps || []) {
        for (const callback of callbacks) {
          assert(
            dep !== callback && !dep.startsWith(`${callback}.`),
            `${rel}: "${dep}" no puede ser dependencia del efecto (es un callback inline)`,
          );
        }
      }
    }
  }
}

console.log('== B) Los handlers hablan con el ref, no con la prop ==');
{
  // El escape tiene que salir por el ref: si usara `onClose()` directo, el
  // closure del efecto quedaría con la función del primer render.
  for (const rel of ['src/voting/VoteSheet.jsx', 'src/components/PlayerStatsSheet.jsx']) {
    const source = read(rel);
    assert(source.includes('onCloseRef.current = onClose'), `${rel}: guarda onClose en un ref`);
    assert(/onKeyDown[\s\S]{0,200}onCloseRef\.current\(\)/.test(source), `${rel}: Escape llama al ref`);
    assert(!/onKeyDown[\s\S]{0,200}?\bonClose\(\)/.test(source), `${rel}: y no a la prop suelta`);
  }
}

console.log('== C) La dependencia es un string estable ==');
{
  // `playerName` sale de player?.name: un string, o sea estable entre renders.
  // Si algún día vuelve `[player, onClose]`, esto lo detecta.
  for (const rel of ['src/voting/VoteSheet.jsx', 'src/components/PlayerStatsSheet.jsx']) {
    const source = read(rel);
    assert(source.includes('const playerName = player?.name'), `${rel}: deriva playerName del nombre`);
    const focusEffect = effectsOf(source).find((effect) => effect.body.includes('focus()'));
    assert(focusEffect !== undefined, `${rel}: está el efecto que enfoca la X`);
    assert(
      focusEffect.deps.length === 1 && focusEffect.deps[0] === 'playerName',
      `${rel}: el efecto del focus sólo depende de playerName (fue: [${focusEffect.deps}])`,
    );
  }
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
