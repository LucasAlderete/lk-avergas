// =============================================================================
// Países y ligas del catálogo real — modo carrera.
//
// Dos nociones distintas (no mezclar):
//  - `leagues[...]`: competición REAL del país (nivel deportivo verdadero).
//  - `division` (1/2) del engine: nivel INTERNO de carrera, derivado del OVR
//    del club, no de la liga real. Documentado en docs/README-CAREER-CLUBS.md.
//
// UNIVERSO CERRADO (estabilización): 8 países y 13 competiciones. No agregar
// países o ligas fuera de esta lista sin avisar.
// =============================================================================

export const COUNTRIES = {
  AR: { name: 'Argentina', flag: '🇦🇷' },
  ES: { name: 'España', flag: '🇪🇸' },
  FR: { name: 'Francia', flag: '🇫🇷' },
  EN: { name: 'Inglaterra', flag: '🏴󰁧󰁢󰁥󰁮󰁧󰁿' },
  IT: { name: 'Italia', flag: '🇮🇹' },
  BR: { name: 'Brasil', flag: '🇧🇷' },
  US: { name: 'Estados Unidos', flag: '🇺🇸' },
  MX: { name: 'México', flag: '🇲🇽' },
};

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
};

export default COUNTRIES;