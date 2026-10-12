// =============================================================================
// Países y ligas del catálogo real — modo carrera.
//
// Dos nociones distintas (no mezclar):
//  - `leagues[...]`: competición REAL del país (nivel deportivo verdadero).
//  - `division` (1/2) del engine: nivel INTERNO de carrera, derivado del OVR
//    del club, no de la liga real. Documentado en docs/README-CAREER-CLUBS.md.
//
// UNIVERSO CERRADO (estabilización): 10 países y 15 competiciones. No agregar
// países o ligas fuera de esta lista sin avisar.
// =============================================================================

export const COUNTRIES = {
  AR: { name: 'Argentina', flag: '🇦🇷', code3: 'ARG', tier: 4 },
  ES: { name: 'España', flag: '🇪🇸', code3: 'ESP', tier: 1 },
  FR: { name: 'Francia', flag: '🇫🇷', code3: 'FRA', tier: 2 },
  EN: { name: 'Inglaterra', flag: '🏴󰁧󰁢󰁥󰁮󰁧󰁿', code3: 'ING', tier: 1 },
  IT: { name: 'Italia', flag: '🇮🇹', code3: 'ITA', tier: 1 },
  BR: { name: 'Brasil', flag: '🇧🇷', code3: 'BRA', tier: 3 },
  US: { name: 'Estados Unidos', flag: '🇺🇸', code3: 'USA', tier: 3 },
  MX: { name: 'México', flag: '🇲🇽', code3: 'MEX', tier: 3 },
  PT: { name: 'Portugal', flag: '🇵🇹', code3: 'POR', tier: 2 },
  DE: { name: 'Alemania', flag: '🇩🇪', code3: 'ALE', tier: 1 },
};

// `tier` = ranking del país para el mercado (1 = ligas top de Europa,
// 4 = Argentina). Cuanto más alto el nivel, más OVR pide para llegar ofertas
// desde ahí (ABROAD_RULES en features/career/config.js).

/** Ligas reales por país. `level` = nivel real deportivo (1 = máxima). */
export const LEAGUES = {
  AR: {
    ar_lp: { name: 'Primera División', level: 1 },
    ar_nac: { name: 'Primera Nacional', level: 2 },
  },
  ES: {
    es_1: { name: 'LaLiga', level: 1 },
    es_2: { name: 'Segunda División', level: 2 },
  },
  FR: {
    fr_1: { name: 'Ligue 1', level: 1 },
    fr_2: { name: 'Ligue 2', level: 2 },
  },
  EN: {
    en_pl: { name: 'Premier League', level: 1 },
    en_ch: { name: 'Championship', level: 2 },
  },
  IT: {
    it_a: { name: 'Serie A', level: 1 },
    it_b: { name: 'Serie B', level: 2 },
  },
  BR: {
    br_a: { name: 'Série A', level: 1 },
  },
  US: {
    us_mls: { name: 'MLS', level: 1 },
  },
  MX: {
    mx_1: { name: 'Liga MX', level: 1 },
  },
  PT: {
    pt_1: { name: 'Liga Portugal', level: 1 },
  },
  DE: {
    de_1: { name: 'Bundesliga', level: 1 },
  },
};

/** Notas de curación por país (contexto de mantenimiento, no dato de juego). */
export const COUNTRY_NOTES = {
  AR: 'Dos niveles reales: Primera División (30 clubes) y Primera Nacional (36 clubes). La división interna D1/D2 sale del OVR, no de la liga real.',
  ES: 'LaLiga (20) y Segunda División (22).',
  FR: 'Ligue 1 (18) y Ligue 2 (18).',
  EN: 'Premier League (20) y Championship (24). Un club del Championship con OVR alto puede ser D2 interno.',
  IT: 'Serie A (20) y Serie B (20).',
  BR: 'Solo Série A (20 clubes).',
  US: 'MLS (30 clubes).',
  MX: 'Solo Liga MX (18 clubes): la Liga de Expansión queda fuera del universo.',
  PT: 'Solo Liga Portugal (18 clubes, 2025-26). Destino típico de argentinos.',
  DE: 'Solo Bundesliga (18 clubes, 2025-26). La 2. Bundesliga queda fuera.',
};

export default COUNTRIES;