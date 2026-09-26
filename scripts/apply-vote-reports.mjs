// ============================================================================
// APLICAR INFORMES DE VOTOS — pega los informes de WhatsApp y actualiza la app
// ============================================================================
// Uso:
//   node scripts/apply-vote-reports.mjs <archivo-con-los-informes>
//   Get-Content .\mis-informes.txt | node scripts/apply-vote-reports.mjs
//   node scripts/apply-vote-reports.mjs --dry-run    (no escribe nada)
//
// Qué hace:
//   1) Lee los informes (uno por línea, aunque venga metidos en un chat con
//      texto alrededor: se ignoran las líneas que no son informes).
//   2) Valida cada uno contra las reglas (5 puntos, 2 por jugador) y descarta
//      los que no dan.
//   3) Suma todos los votos válidos y escribe src/data/castedVotes.js.
//   4) Imprime la tabla de antes/después de cada OVR.
//
// Ese archivo generado se sube al servidor junto con la app: como es estático,
// con redeployar alcanza y TODOS ven los mismos votos.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { players, overallOf } = await import(pathToFileURL(path.join(root, 'src', 'data.js')).href);
const { aggregateBallots, withVotes } = await import(pathToFileURL(path.join(root, 'src', 'voting', 'voteRules.js')).href);
const { REPORT_TAG, readReport } = await import(pathToFileURL(path.join(root, 'src', 'voting', 'voteReport.js')).href);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((arg) => !arg.startsWith('--'));

async function readInput() {
  if (file) return fs.readFileSync(path.resolve(root, file), 'utf8');
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return chunks.join('');
  }
  console.error('Uso: node scripts/apply-vote-reports.mjs <archivo> | --dry-run');
  process.exit(1);
}

const text = await readInput();
const lines = text.split(/\r?\n/);
const candidates = lines.filter((line) => line.includes(REPORT_TAG));

if (!candidates.length) {
  console.error(`No encontré ningún informe. Busqué líneas con "${REPORT_TAG}".`);
  process.exit(1);
}

console.log(`Encontré ${candidates.length} informe(s) en ${lines.length} línea(s).\n`);

const accepted = [];
let rejected = 0;
for (const line of candidates) {
  const report = readReport(line);
  const who = report.label || 'sin etiqueta';
  if (!report.ok) {
    rejected += 1;
    console.log(`  x DESCARTADO (${who}): ${report.errors.join('; ')}`);
    continue;
  }
  if (!Object.keys(report.ballot).length) {
    console.log(`  - (${who}) sin votos, no cuenta`);
    continue;
  }
  accepted.push(report);
}

const total = aggregateBallots(accepted.map((report) => report.ballot));
const voters = accepted.length;

console.log(`\nVotos válidos: ${voters}${rejected ? ` · descartados: ${rejected}` : ''}\n`);

// ---- Tabla antes / después -------------------------------------------------
const header = ['Jugador', 'Base', 'Votos', 'OVR', 'Δ'];
const widths = [10, 5, 22, 5, 4];
console.log(header.map((cell, i) => cell.padEnd(widths[i])).join(''));
console.log('-'.repeat(46));

const rows = players.map((player) => {
  const deltas = total[player.name] || {};
  const before = overallOf(player);
  const after = withVotes(player, deltas).rating;
  const flat = Object.entries(deltas).map(([key, value]) => `${key}${value > 0 ? '+' : ''}${value}`).join(' ');
  return { name: player.name, before, after, flat };
});

for (const row of rows) {
  const delta = row.after - row.before;
  const line = [
    row.name.padEnd(widths[0]),
    String(row.before).padEnd(widths[1]),
    (row.flat || '—').padEnd(widths[2]),
    String(row.after).padEnd(widths[3]),
    delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`,
  ];
  console.log(line.join(''));
}

const changed = rows.filter((row) => row.after !== row.before);
console.log(`\nJugadores con OVR modificado: ${changed.length}/${rows.length}`);

// ---- Escribir el archivo generado -----------------------------------------
const target = path.join(root, 'src', 'data', 'castedVotes.js');
const body = `// ============================================================================
// VOTOS APLICADOS — GENERADO, NO EDITAR A MANO
// ============================================================================
// Lo genera \`node scripts/apply-vote-reports.mjs\` a partir de los informes que
// mandó cada persona. Se sube al servidor con la app: al redeployar, todos
// ven estos votos.
//
// Para cambiarlo: pisá los informes y corré el script de nuevo.
// It's generated: edit the reports, not this file.
// ${voters} voter(s), ${rejected} report(s) descartado(s).
// ============================================================================

export const castedVoters = ${voters};

export const castedVotes = ${JSON.stringify(total, null, 2)};

export default castedVotes;
`;

if (dryRun) {
  console.log(`\n(--dry-run) No escribí nada. Destino: ${path.relative(root, target)}`);
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, 'utf8');
  console.log(`\nEscrito ${path.relative(root, target)} · ${voters} votante(s). Subilo y redeployá.`);
}
