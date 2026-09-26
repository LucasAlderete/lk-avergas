// ============================================================================
// fetch-club-crests.mjs — descarga escudos de clubes desde Wikimedia Commons
// ============================================================================
// Reanudable: mantiene docs/crest-manifest.json con lo ya descargado.
// Solo acepta archivos con licencia libre (Public domain / CC0 / CC BY / CC BY-SA).
// Todo lo que no pueda resolverse con licencia libre queda con fallback procedural.
//
// Uso:  node scripts/fetch-club-crests.mjs [--limit N] [--delay MS]
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'career', 'clubs');
const MANIFEST = path.join(ROOT, 'docs', 'crest-manifest.json');
const GEN_FILE = path.join(ROOT, 'src', 'data', 'careerWorld', 'crests.generated.js');

const args = process.argv.slice(2);
const argOf = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const LIMIT = argOf('--limit', 0);
const DELAY = argOf('--delay', 350);

const UA = 'lk-avergas-crest-fetcher/0.1 (https://github.com/LucasAlderete/lk-avergas; local dev)';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

// Licencias aceptables para redistribución en el proyecto.
const FREE_LICENSE = /^(public domain|cc0|cc by(-sa)?( [1-4].0)?|attribution|creative commons attribution)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 4) { await sleep(1200 * attempt); return api(url, attempt + 1); }
    throw err;
  }
}

// ---------- catálogo: lee los clubes directamente del RAW (sin inventar) ----
const clubsMod = await import(new URL('../src/data/careerWorld/clubs.js', import.meta.url).href);
const countriesMod = await import(new URL('../src/data/careerWorld/countries.js', import.meta.url).href);
const { RAW_CLUBS } = clubsMod;
const { COUNTRIES } = countriesMod;

const slugify = (name) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CLUBS = RAW_CLUBS.map((raw) => ({
  slug: slugify(raw.n),
  name: raw.n,
  country: COUNTRIES[raw.c]?.name || raw.c,
}));

// ---------- helpers de búsqueda ---------------------------------------------
const tokens = (name) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['club', 'football', 'deportivo', 'atletico', 'sport', 'city', 'real', 'sporting', 'association', 'union', 'futbol', 'balompie', 'the', 'fc', 'cf', 'sc'].includes(w));

const EXCLUDE = /(kit|shirt|jersey|home|away|third|stadium|ground|arena|photo|match|squad|team|supporters|ultras|flag|map|training|season|player|portrait|trophy|copa|league|table|banner|panorama|view|street|station|building|coat of arms of|wordmark)/i;

async function searchTitle(clubName, country) {
  const queries = [
    `${clubName} ${country} football`,
    `${clubName} football club`,
    clubName,
  ];
  for (const q of queries) {
    const data = await api(`${WIKI}?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(q)}`);
    const hits = data?.query?.search || [];
    const wanted = tokens(clubName);
    for (const hit of hits) {
      const norm = hit.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const score = wanted.filter((w) => norm.includes(w)).length;
      if (score >= Math.min(2, wanted.length)) return hit.title;
    }
    await sleep(DELAY);
  }
  return null;
}

async function pageImages(title) {
  const data = await api(`${WIKI}?action=query&format=json&redirects=1&prop=pageimages|images&imlimit=80&piprop=name&titles=${encodeURIComponent(title)}`);
  const page = Object.values(data?.query?.pages || {})[0] || {};
  return { pageimage: page.pageimage || null, images: (page.images || []).map((i) => i.title) };
}



async function fileInfo(title) {
  const data = await api(`${COMMONS}?action=query&format=json&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=320&titles=${encodeURIComponent(title)}`);
  const page = Object.values(data?.query?.pages || {})[0] || {};
  if (page.missing !== undefined) return { missing: true };
  const info = (page.imageinfo || [])[0];
  if (!info) return { missing: true };
  const meta = info.extmetadata || {};
  return {
    missing: false,
    thumb: info.thumburl || info.url,
    mime: info.mime,
    license: meta.LicenseShortName?.value || null,
    artist: (meta.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || null,
    descriptionUrl: info.descriptionurl,
  };
}

function pickCandidates(images, pageimage, clubName) {
  const wanted = tokens(clubName);
  // El token más distintivo del nombre debe estar en el archivo: evita que
  // "Manchester City" matchee "Greater Manchester ..." o que "Cruzeiro"
  // matchee "Cruzeiro BH" (otro club). Palabras geográficas genéricas no cuentan.
  const GEO = /greater|numbered|location|province|provincia|departamento|district|region|county|england|spain|germany|france|brazil|argentina|italy|mexico|uruguay|netherlands|belgium|portugal|map/;
  const longest = wanted.slice().sort((a, b) => b.length - a.length)[0] || '';
  return images
    .filter((t) => /\.(svg|png)$/i.test(t))
    .filter((t) => !EXCLUDE.test(t))
    .map((t) => {
      const norm = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const hits = wanted.filter((w) => norm.includes(w)).length;
      const hasLongest = longest && norm.includes(longest) ? 1 : 0;
      const crestWord = /crest|logo|badge|escudo/.test(norm) ? 1 : 0;
      const geo = GEO.test(norm) ? 1 : 0;
      const dated = /\b(18|19|20)\d{2}\b/.test(norm) ? 1 : 0;
      const score = hasLongest * 4 + hits * 2 + crestWord * 3 - geo * 5 - dated;
      return { title: t, score, hits, hasLongest, crestWord, geo, dated, isPageImage: pageimage === t, norm };
    })
    .filter((c) => c.hasLongest === 1 && c.geo === 0 && c.dated === 0)
    .sort((a, b) => (b.isPageImage - a.isPageImage) || (b.score - a.score) || (a.norm.length - b.norm.length));
}

// Detecta el formato real del contenido descargado por magic bytes,
// NO por la extensión sugerida por Wikimedia (que puede ser .svg aunque
// el contenido sea PNG).  Wikimedia a veces sirve PNG bajo nombres .svg.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const detectFormat = (buf) => {
  if (buf.length >= 8 && buf.slice(0, 8).equals(PNG)) return 'png';
  // SVG: empieza con '<?xml' o '<svg' (después de posible BOM/whitespace)
  const head = buf.slice(0, 512).toString('utf8').trimStart();
  if (/^<\?xml/.test(head) || /^<svg[\s>]/.test(head)) return 'svg';
  return 'png'; // fallback seguro: PNG es el formato más tolerante del navegador
};

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error('archivo demasiado chico');
  await fs.writeFile(dest, buf);
  return buf.length;
}


// ---------- main -------------------------------------------------------------
const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8').catch(() => '{}'));
await fs.mkdir(OUT_DIR, { recursive: true });

const pending = CLUBS.filter((c) => !manifest[c.slug]);
const batch = LIMIT > 0 ? pending.slice(0, LIMIT) : pending;
console.log(`Clubes: ${CLUBS.length} · ya resueltos: ${CLUBS.length - pending.length} · en este batch: ${batch.length}`);

for (const club of batch) {
  try {
    const title = await searchTitle(club.name, club.country);
    if (!title) {
      manifest[club.slug] = { status: 'no-article', name: club.name };
    } else {
      const { pageimage, images } = await pageImages(title);
      const candidates = pickCandidates(images, pageimage, club.name);
      let done = false;
      for (const cand of candidates.slice(0, 4)) {
        const info = await fileInfo(cand.title);
        if (info.missing) continue;
        const lic = info.license || '?';
        if (!FREE_LICENSE.test(lic)) continue;
        if (!/^(image\/(png|svg\+xml)|text\/svg)/.test(info.mime || '')) continue;
        // Detectar el formato REAL por magic bytes del contenido, no por la
        // extension sugerida por Wikimedia (que puede ser .svg aunque el
        // contenido sea PNG).
        const tmp = path.join(OUT_DIR, `${club.slug}.downloadtmp`);
        const size = await download(info.thumb, tmp);
        const buf = await fs.readFile(tmp);
        const ext = detectFormat(buf);
        const dest = path.join(OUT_DIR, `${club.slug}.${ext}`);
        await fs.rename(tmp, dest);
        manifest[club.slug] = {
          status: 'ok',
          name: club.name,
          file: `career/clubs/${club.slug}.${ext}`,
          bytes: size,
          source: cand.title,
          license: lic,
          artist: info.artist,
          page: info.descriptionUrl,
          article: title,
        };
        console.log(`OK  ${club.slug} <- ${cand.title} [${lic}] (${size}b)`);
        done = true;
        break;
      }
      if (!done) manifest[club.slug] = { status: 'no-free-crest', name: club.name, article: title };
    }
  } catch (err) {
    console.log(`ERR ${club.slug}: ${err.message}`);
  }
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  await sleep(DELAY);
}

await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));

// ---------- regenera el mapa del proyecto ------------------------------------
const entries = Object.entries(manifest).filter(([, m]) => m.status === 'ok')
  .sort(([a], [b]) => a.localeCompare(b));
const lines = [
  '// ============================================================================',
  '// crests.generated.js — MAPA DE ESCUDOS REALES (generado, NO editar a mano)',
  '// ============================================================================',
  '// Generado por scripts/fetch-club-crests.mjs desde Wikimedia Commons.',
  '// Origen y licencia de cada archivo: docs/crest-manifest.json (en el repo).',
  '// Los clubes sin entrada acá usan el fallback procedural del adapter.',
  '// ============================================================================',
  '',
  'export const CREST_FILES = {',
  ...entries.map(([slug, m]) => `  '${slug}': '${m.file}',`),
  '};',
  '',
  'export const CREST_META = {',
  ...entries.map(([slug, m]) => `  '${slug}': { source: ${JSON.stringify(m.source)}, license: ${JSON.stringify(m.license)}, page: ${JSON.stringify(m.page)} },`),
  '};',
  '',
  'export default CREST_FILES;',
  '',
];
await fs.writeFile(GEN_FILE, lines.join('\n'));

const okCount = entries.length;
const failed = Object.values(manifest).filter((m) => m.status !== 'ok').length;
console.log(`\nResumen: ${okCount} escudos · ${failed} pendientes/fallback · procesado: ${Object.keys(manifest).length}/${CLUBS.length}`);
