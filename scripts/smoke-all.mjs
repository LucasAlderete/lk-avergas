// ============================================================================
// Runner de smoke tests del Career Mode
// Uso: node scripts/smoke-all.mjs   (o `npm run smoke`)
//
// Ejecuta TODOS los scripts/smoke-*.mjs en orden alfabético, uno por proceso
// (cada smoke es independiente y no comparte estado), y resume PASS/FAIL.
// Se excluye a sí mismo. Sale con código 1 si alguno falla.
// ============================================================================
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const self = path.basename(fileURLToPath(import.meta.url));

const scripts = fs.readdirSync(here)
  .filter((file) => file.startsWith('smoke-') && file.endsWith('.mjs') && file !== self)
  .sort();

if (scripts.length === 0) {
  console.error('No hay smoke tests en scripts/');
  process.exit(1);
}

const results = [];
for (const script of scripts) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(here, script)], { encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const ok = run.status === 0;
  const lines = output.split(/\r?\n/).map((line) => line.trim());

  // Todas las fallas, no sólo las dos últimas. Con slice(-2), un test que rompe
  // el render de una pantalla entera (que tira cientos de aserciones) mostraba
  // un errorito sin la causa real.
  const failures = lines.filter((line) => /x FAIL/.test(line));
  const summary = [
    ...(failures.length ? [`${failures.length} falla(s)`] : []),
    ...lines.filter((line) => /TODO OK|FALLAS/.test(line)).slice(-1),
  ].join(' · ');

  results.push({ script, ok, ms: Date.now() - started, summary, failures });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${script}  (${((Date.now() - started) / 1000).toFixed(1)}s)${summary ? `  ${summary}` : ''}`);
  if (!ok) {
    // Primero la causa raíz (ReferenceError, TypeError, SyntaxError) y después
    // el resto de las fallas.
    const root = lines.filter((line) => /ReferenceError|TypeError|SyntaxError|is not defined|is not a function/.test(line));
    const rest = failures.filter((line) => !root.includes(line));
    console.error(`   causa raíz:\n${[...new Set(root)].slice(0, 5).map((l) => `     ${l}`).join('\n') || '     (sin causa raíz detectable)'}`);
    if (rest.length) console.error(`   fallas:\n${rest.slice(0, 10).map((l) => `     ${l}`).join('\n')}`);
    if (failures.length > 10) console.error(`     ...y ${failures.length - 10} más`);
  }
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke tests en verde`);
if (failed.length) console.error(`Fallaron: ${failed.map((row) => row.script).join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
