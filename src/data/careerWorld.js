// ============================================================================
// careerWorld.js — ADAPTER del catálogo de clubes reales (fase 1)
// ============================================================================
// API EXACTA que consumía el mundo Avergas, ahora servida desde el catálogo
// real curado (clubs.js + countries.js). El engine, events, flow, persistence
// y la UI NO cambian: consumen esta API.
//
// Semántica de la división INTERNA del engine (no confundir con la liga real):
//   nivel 1 = Primera · nivel 2 = Segunda (piso del mundo jugable).
// La jerarquía jugable del modo carrera tiene DOS categorías: la Tercera
// División NO existe como categoría del career world. Todo club por debajo de
// la banda de Primera es Segunda.
// La división interna se DERIVA del OVR curado por bandas globales
// (DIVISION_THRESHOLDS), no de la liga real del club. `leagueLevel` conserva
// el nivel deportivo real de su competición (countries.js).
// ============================================================================

import { COUNTRIES, LEAGUES } from './careerWorld/countries.js';
import { RAW_CLUBS } from './careerWorld/clubs.js';

// ----------------------------------------------------------------------------
// Versión del mundo: cualquier cambio estructural del mundo (acá: la
// desaparición de la Tercera División) INVALIDA los saves viejos
// (persistence.js rechaza worldVersion distinto → nueva carrera).
// ----------------------------------------------------------------------------
export const CAREER_WORLD_VERSION = 3;

// Divisiones internas jugables (ascendente: 1 = la más alta).
export const BASE_DIVISION = 2; // Segunda: piso del mundo jugable
export const TOP_DIVISION = 1;  // Primera

// Bandas de OVR → división interna. Documentadas en docs/README-CAREER-CLUBS.md.
// Solo dos bandas: lo que queda por debajo de Primera es Segunda (no hay D3).
const DIVISION_THRESHOLDS = [
  { min: 76, division: TOP_DIVISION },  // Primera (élite / primera fuerte)
  { min: 0, division: BASE_DIVISION },  // Segunda (profesional medio y clubes chicos)
];

const divisionForOvr = (ovr) =>
  DIVISION_THRESHOLDS.find((band) => ovr >= band.min)?.division ?? BASE_DIVISION;

// ----------------------------------------------------------------------------
// Normalización del RAW al formato que consume el engine.
// Campos derivados: slug (desde el nombre), key, division (bandas de OVR).
// ----------------------------------------------------------------------------

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Escudo: real (imagen) cuando disponible, procedural (CSS) como fallback.
// La UI usa `crest.type` para decidir: 'image' = img con src, 'procedural' = CSS.
// CREST_FILES se importa dinámicamente para no romper el import estático del módulo.
const crestFor = (short, colors, slug) => {
  // Resolver CREST_FILES de forma sincrona mediante caché estático.
  // El primer call lazy-loads el módulo generado; los siguientes usan caché.
  if (!crestFor._cache) {
    try {
      crestFor._cache = import('./careerWorld/crests.generated.js').then((m) => m.CREST_FILES);
    } catch { crestFor._cache = Promise.resolve(null); }
  }
  // En contexto síncrono devolvemos procedural; la UI resuelve el src después.
  // El campo `src` se añade por clubVisual() en careerFormat.js que sí puede ser async.
  return {
    type: 'procedural',
    shape: 'shield',
    primary: colors.primary,
    secondary: colors.secondary,
    symbol: (typeof short === 'string' && short.trim() ? short.trim().slice(0, 3) : 'FC').toUpperCase(),
    _slug: slug,
  };
};

const buildClub = (raw) => {
  const slug = slugify(raw.n);
  const colors = { primary: raw.p, secondary: raw.q };
  const league = LEAGUES[raw.c]?.[raw.l] || { name: raw.l, level: 1 };
  const country = COUNTRIES[raw.c] || { name: raw.c, flag: '🏳️' };
  // La división INTERNA siempre se deriva del OVR por bandas globales.
  // (raw.d es un tier curado de referencia; NO se usa como división.)
  const division = divisionForOvr(raw.o);
  return {
    // Identidad
    slug,
    id: slug,
    key: `${division}/${slug}`,
    name: raw.n,
    short: raw.s,
    shortName: raw.s, // alias del modelo documentado (el engine consume `short`)
    country: country.name,
    countryCode: raw.c,
    countryFlag: country.flag,
    city: raw.city,
    // Competición real
    league: league.name,
    leagueId: raw.l,
    leagueLevel: league.level,
    // Niveles del engine
    division,
    ovr: raw.o,
    overall: raw.o, // alias del modelo documentado (el engine consume `ovr`)
    refTier: raw.d, // tier curado de referencia (1-5), informativo
    // Reputaciones 0-5 (curadas)
    domesticReputation: raw.k,
    continentalReputation: raw.i,
    internationalReputation: raw.i, // fase 1: continental como proxy
    // Presentación
    colors,
    crest: crestFor(raw.s, colors),
    // Otros
    founded: raw.y,
    stadium: raw.st || '',
    barrio: raw.city, // compat: engine/events usan club.barrio como "zona local"
    baseline: raw.o,  // baseline = OVR curado del club
  };
};

export const CLUBS = RAW_CLUBS.map(buildClub);

// ----------------------------------------------------------------------------
// Metadatos del mundo
// ----------------------------------------------------------------------------
// Jerarquía jugable de DOS categorías (sin Tercera División):
//   Argentina: Primera División → Primera Nacional
//   España: LaLiga → Segunda · Francia: Ligue 1 → Ligue 2 · Inglaterra:
//   Premier League → Championship · Italia: Serie A → Serie B.
// La división interna es el nivel RELATIVO de club (bandas de OVR), no la liga
// real: `club.league`/`club.leagueLevel` conservan la competición verdadera.
// ----------------------------------------------------------------------------

export const DIVISIONS = [
  {
    nivel: TOP_DIVISION,
    name: 'Primera',
    short: 'D1',
    description: 'Clubes de élite y primera división fuerte.',
    ovrMin: 76,
  },
  {
    nivel: BASE_DIVISION,
    name: 'Segunda',
    short: 'D2',
    description: 'Clubes profesionales de nivel medio y clubes chicos.',
    ovrMin: 0,
  },
];

export const divisions = DIVISIONS;
export const worldMeta = {
  name: 'Mundo Real',
  version: CAREER_WORLD_VERSION,
  countries: Object.keys(COUNTRIES).length,
  leagues: Object.values(LEAGUES).reduce((acc, byCountry) => acc + Object.keys(byCountry).length, 0),
  clubs: CLUBS.length,
};

// ----------------------------------------------------------------------------
// Índices
// ----------------------------------------------------------------------------

const CLUBS_BY_SLUG = new Map(CLUBS.map((club) => [club.slug, club]));
const CLUBS_BY_KEY = new Map(CLUBS.map((club) => [club.key, club]));
const CLUBS_BY_DIVISION = DIVISIONS.map(({ nivel }) => CLUBS.filter((c) => c.division === nivel));

// ----------------------------------------------------------------------------
// API del mundo (misma firma que el mundo Avergas)
// ----------------------------------------------------------------------------

/** Lista nueva con todos los clubes (copia del array, no de los items). */
export const allClubs = () => [...CLUBS];

/** Clubes normalizados (sin clonar) para el engine. */
export const clubs = CLUBS;

/** Key compuesta estable "division/slug". */
export const clubKey = (club) => (club ? `${club.division}/${club.slug}` : null);

/** Busca por slug (con fallback tolerante). */
export const findClub = (slug) =>
  (typeof slug === 'string' ? CLUBS_BY_SLUG.get(slug) : null) || null;

/** Busca por key "division/slug" (o slug puro como fallback). */
export const findClubByKey = (key) =>
  (typeof key === 'string' ? CLUBS_BY_KEY.get(key) || CLUBS_BY_SLUG.get(key) : null) || null;

/** Reputación doméstica 0-5. */
export const domesticReputation = (club) =>
  (club && Number.isFinite(club.domesticReputation) ? club.domesticReputation : 0);

/** Baseline del club (OVR curado). */
export const clubBaseline = (club) =>
  (club && Number.isFinite(club.baseline ?? club.ovr) ? (club.baseline ?? club.ovr) : 50);

/**
 * Divisiones de inicio elegibles según el OVR del jugador (ascendente).
 * Con la jerarquía de DOS categorías:
 *   OVR >= 76 → [1, 2]  (Primera o Segunda: el debut lo elige el RNG del engine)
 *   OVR <  76 → [2]     (solo Segunda; NUNCA una tercera categoría inventada)
 * El engine NO toma un elemento fijo: sortea entre las elegibles.
 */
export const startingDivisionsForOvr = (ovr) => {
  if (!Number.isFinite(ovr)) return [];
  const allowed = DIVISIONS.filter((d) => ovr >= d.ovrMin).map((d) => d.nivel);
  return allowed.length > 0 ? allowed : [BASE_DIVISION];
};

/** Clubes por nivel de división interna (array nuevo, sin clonar items). */
export const clubsByDivision = (nivel) =>
  (Number.isFinite(nivel) ? [...(CLUBS_BY_DIVISION[nivel - 1] || [])] : []);

export default {
  CAREER_WORLD_VERSION,
  BASE_DIVISION,
  TOP_DIVISION,
  divisions,
  clubs,
  clubKey,
  allClubs,
  clubsByDivision,
  findClub,
  findClubByKey,
  domesticReputation,
  clubBaseline,
  startingDivisionsForOvr,
  worldMeta,
};
