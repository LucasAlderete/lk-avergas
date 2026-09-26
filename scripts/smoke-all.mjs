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
  const summary = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /TODO OK|FALLAS|FAIL|^x /.test(line))
    .slice(-2)
    .join(' · ');
  results.push({ script, ok, ms: Date.now() - started, summary });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${script}  (${((Date.now() - started) / 1000).toFixed(1)}s)${summary ? `  ${summary}` : ''}`);
  if (!ok) console.error(output.split(/\r?\n/).slice(-25).join('\n'));
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke tests en verde`);
if (failed.length) console.error(`Fallaron: ${failed.map((row) => row.script).join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
