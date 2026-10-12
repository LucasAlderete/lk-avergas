// =============================================================================
// COPAS REALES — qué título se gana según el país y la liga del club
// =============================================================================
// El motor tira los dados por tipo (league / cup / continental / worldcup) y
// acá se traduce a la competición real: ganar la "continental" con el Real
// Madrid es la Champions League; con River, la Copa Libertadores.
// Cada copa tiene un `id` estable (se guarda en career.trophies) y su imagen en
// /public/trophies (IMAGES; fotos de Wikimedia Commons, créditos en
// public/trophies/CREDITS.md). Si una copa no tiene imagen, la UI usa el emoji.
// =============================================================================

export const TROPHIES = {
  // Ligas (primera división de cada país)
  league_ar: { label: 'Liga Profesional', icon: '🏆' },
  league_es: { label: 'LaLiga', icon: '🏆' },
  league_en: { label: 'Premier League', icon: '🏆' },
  league_it: { label: 'Serie A', icon: '🏆' },
  league_fr: { label: 'Ligue 1', icon: '🏆' },
  league_de: { label: 'Bundesliga', icon: '🏆' },
  league_pt: { label: 'Liga Portugal', icon: '🏆' },
  league_br: { label: 'Brasileirão', icon: '🏆' },
  league_mx: { label: 'Liga MX', icon: '🏆' },
  league_us: { label: 'MLS Cup', icon: '🏆' },
  // Segundas divisiones: se sale campeón del ascenso
  league_2: { label: 'Campeón del ascenso', icon: '🏆' },
  // Copas nacionales
  cup_ar: { label: 'Copa Argentina', icon: '🥈' },
  cup_es: { label: 'Copa del Rey', icon: '🥈' },
  cup_en: { label: 'FA Cup', icon: '🥈' },
  cup_it: { label: 'Coppa Italia', icon: '🥈' },
  cup_fr: { label: 'Coupe de France', icon: '🥈' },
  cup_de: { label: 'DFB-Pokal', icon: '🥈' },
  cup_pt: { label: 'Taça de Portugal', icon: '🥈' },
  cup_br: { label: 'Copa do Brasil', icon: '🥈' },
  cup_mx: { label: 'Copa MX', icon: '🥈' },
  cup_us: { label: 'US Open Cup', icon: '🥈' },
  // Internacionales
  ucl: { label: 'Champions League', icon: '🌟' },
  libertadores: { label: 'Copa Libertadores', icon: '🌟' },
  concacaf: { label: 'Concacaf Champions Cup', icon: '🌟' },
  worldcup: { label: 'Copa del Mundo', icon: '🌎' },
};

const EUROPE = ['ES', 'EN', 'IT', 'FR', 'DE', 'PT'];
const SOUTH_AMERICA = ['AR', 'BR'];

/** Id de la copa real para un tipo de título y el club (del catálogo). */
export function trophyIdFor(type, world) {
  if (type === 'worldcup') return 'worldcup';
  const country = world && world.countryCode;
  if (!country) return null;
  const code = country.toLowerCase();
  if (type === 'league') return world.leagueLevel > 1 ? 'league_2' : `league_${code}`;
  if (type === 'cup') return `cup_${code}`;
  if (type === 'continental') {
    if (EUROPE.includes(country)) return 'ucl';
    if (SOUTH_AMERICA.includes(country)) return 'libertadores';
    return 'concacaf';
  }
  return null;
}

// Archivo de cada copa en /public/trophies (Copa MX y US Open Cup no tienen
// imagen libre en Commons: van con el emoji).
const JPG = ['league_br', 'cup_it'];
const NO_IMAGE = ['league_mx', 'cup_mx', 'cup_us'];

/** Ruta de la imagen de la copa (o null si no hay). */
export function trophyImage(trophy) {
  const id = trophy && trophy.trophyId;
  if (!id || !TROPHIES[id] || NO_IMAGE.includes(id)) return null;
  return `/trophies/${id}.${JPG.includes(id) ? 'jpg' : 'png'}`;
}
