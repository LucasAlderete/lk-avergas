// =============================================================================
// SELECCIÓN NACIONAL — convocatorias, eliminatorias y Mundial
// =============================================================================
// Módulo PURO (sin imports del engine) que simulateSeason llama una vez por
// temporada. Reglas:
//  - La selección es la de `career.nationality` (la que se elige en el setup).
//  - Desde los 18 años, si el OVR alcanza para la selección, puede haber
//    convocatoria. Una vez adentro es más fácil seguir que entrar.
//  - Mundial cada 4 años (2030, 2034, ...). La temporada anterior se juegan las
//    eliminatorias: si la selección no clasifica, no hay Mundial para nadie.
//  - Los partidos y goles con la selección salen de la forma de la temporada de
//    club (misma producción por partido), así que todo queda coherente.
//  - Usa su PROPIO rng derivado de (carrera, temporada): no consume números del
//    rng de la temporada y no altera los resultados que ya existían.
// =============================================================================

export const WORLD_CUP_FIRST_SEASON = 2030;
export const WORLD_CUP_EVERY = 4;
export const NATIONAL_MIN_AGE = 18;

/** Fuerza de cada selección (0..1). Define el OVR de corte y las chances. */
export const NATIONAL_TEAMS = {
  AR: { name: 'Argentina', strength: 0.9 },
  FR: { name: 'Francia', strength: 0.9 },
  BR: { name: 'Brasil', strength: 0.88 },
  ES: { name: 'España', strength: 0.88 },
  EN: { name: 'Inglaterra', strength: 0.86 },
  PT: { name: 'Portugal', strength: 0.84 },
  DE: { name: 'Alemania', strength: 0.84 },
  IT: { name: 'Italia', strength: 0.8 },
  MX: { name: 'México', strength: 0.68 },
  US: { name: 'Estados Unidos', strength: 0.64 },
};

export const WORLD_CUP_TROPHY = { type: 'worldcup', trophyId: 'worldcup', label: 'Copa del Mundo', icon: '🌎' };

/** Etapa alcanzada en el Mundial (de peor a mejor). */
export const WORLD_CUP_STAGES = [
  { id: 'group', label: 'Fase de grupos' },
  { id: 'r16', label: 'Octavos de final' },
  { id: 'qf', label: 'Cuartos de final' },
  { id: 'sf', label: 'Semifinal' },
  { id: 'final', label: 'Subcampeón' },
  { id: 'champion', label: 'Campeón del Mundo' },
];

export const stageLabel = (id) => (WORLD_CUP_STAGES.find((s) => s.id === id) || {}).label || '';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

function teamOf(code) {
  return NATIONAL_TEAMS[code] || { name: code || 'Selección', strength: 0.7 };
}

/** OVR mínimo para pelear un lugar en la selección. */
export function callUpThreshold(nationality) {
  return Math.round(60 + teamOf(nationality).strength * 20);
}

/** Año de Mundial si `season` lo es; si no, null. */
export function worldCupSeason(season) {
  if (!Number.isFinite(season) || season < WORLD_CUP_FIRST_SEASON) return null;
  return (season - WORLD_CUP_FIRST_SEASON) % WORLD_CUP_EVERY === 0 ? season : null;
}

/** Mundial que se clasifica en `season` (las eliminatorias van un año antes). */
export function qualifierTargetSeason(season) {
  return worldCupSeason(season + 1);
}

export function emptyNationalTeam(nationality) {
  return {
    team: nationality || 'AR',
    called: false,
    debutSeason: null,
    caps: 0,
    goals: 0,
    seasons: [],
    qualifiers: [],
    worldCups: [],
  };
}

/** Normaliza lo guardado (saves viejos no traen nada de esto). */
export function readNationalTeam(career) {
  const base = emptyNationalTeam(career && career.nationality);
  const raw = career && career.nationalTeam;
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    seasons: Array.isArray(raw.seasons) ? raw.seasons : [],
    qualifiers: Array.isArray(raw.qualifiers) ? raw.qualifiers : [],
    worldCups: Array.isArray(raw.worldCups) ? raw.worldCups : [],
  };
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let s = seed >>> 0;
  return {
    next() {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return Math.floor(min + this.next() * (max - min + 1));
    },
  };
}

function sampleCount(rate, rng) {
  if (rate <= 0) return 0;
  const whole = Math.floor(rate);
  return whole + (rng.next() < rate - whole ? 1 : 0);
}

/**
 * Temporada con la selección.
 *
 * input: { career, ovr, clubStats: { pj, gls }, season }
 * Devuelve { nationalTeam, report, events, trophies } sin mutar nada.
 *   report: null si no hubo actividad ni novedades; si no
 *     { team, called, firstCall, caps, goals, qualifier, worldCup }.
 */
export function playNationalSeason({ career, ovr, clubStats, season }) {
  const nt = readNationalTeam(career);
  const events = [];
  const trophies = [];
  const nationality = nt.team || career.nationality || 'AR';
  const team = teamOf(nationality);
  const age = career.age;
  const rng = makeRng(
    hashString(`${career.playerId || career.name || 'carrera'}|${nationality}|${season}`) ^ (ovr * 2654435761),
  );

  if (!Number.isFinite(age) || age < NATIONAL_MIN_AGE || !career.club) {
    return { nationalTeam: nt, report: null, events, trophies };
  }

  // 1) Convocatoria de la temporada.
  const gap = ovr - callUpThreshold(nationality);
  const chance = nt.called
    ? clamp(0.8 + gap * 0.05, 0.12, 0.97)
    : (gap < -3 ? 0 : clamp(0.38 + gap * 0.08, 0.05, 0.95));
  const called = rng.next() < chance;
  const firstCall = called && !nt.called;

  const worldCup = worldCupSeason(season);
  const qualifierFor = qualifierTargetSeason(season);
  const next = {
    ...nt,
    team: nationality,
    called,
    debutSeason: nt.debutSeason == null && called ? season : nt.debutSeason,
  };

  if (!called) {
    let lostPlace = false;
    if (nt.called) {
      lostPlace = true;
      events.push({
        season,
        type: 'national',
        message: `Quedó afuera de la Selección de ${team.name}.`,
      });
    }
    // Sin lista no hay torneo: igual se informa el Mundial del que quedó afuera.
    if (worldCup && gap >= -2 && !lostPlace) {
      events.push({
        season,
        type: 'national',
        message: `No lo convocaron al Mundial ${worldCup} con ${team.name}.`,
      });
    }
    return { nationalTeam: next, report: null, events, trophies };
  }

  if (firstCall) {
    events.push({
      season,
      type: 'national',
      message: `Primera convocatoria a la Selección de ${team.name}.`,
    });
  }

  // 2) Partidos y goles de la temporada con la selección.
  const starter = gap >= 3;
  let caps = starter ? rng.int(7, 11) : rng.int(2, 6);
  const clubMatches = Math.max(1, (clubStats && clubStats.pj) || 0);
  const perMatch = clamp((((clubStats && clubStats.gls) || 0) / clubMatches) * 0.8, 0, 1.2);
  const isGK = career.position === 'ARQ';
  let goals = 0;
  for (let i = 0; i < caps; i += 1) goals += isGK ? 0 : sampleCount(perMatch, rng);

  // 3) Eliminatorias (año previo al Mundial).
  let qualifier = null;
  if (qualifierFor) {
    const qualified = rng.next() < clamp(0.55 + team.strength * 0.43, 0.5, 0.97);
    qualifier = { season: qualifierFor, qualified, caps, goals };
    next.qualifiers = [...nt.qualifiers.filter((q) => q.season !== qualifierFor), qualifier];
    events.push({
      season,
      type: 'national',
      message: qualified
        ? `Eliminatorias: ${team.name} clasificó al Mundial ${qualifierFor} (${caps} partidos, ${goals} goles).`
        : `Eliminatorias: ${team.name} se quedó afuera del Mundial ${qualifierFor}.`,
    });
  }

  // 4) Mundial (si la selección había clasificado en las eliminatorias).
  let cup = null;
  if (worldCup) {
    const qual = nt.qualifiers.find((q) => q.season === worldCup);
    // Sin eliminatorias registradas (carrera que arrancó tarde): clasifica por fuerza.
    const qualified = qual ? qual.qualified : rng.next() < clamp(0.55 + team.strength * 0.43, 0.5, 0.97);
    if (qualified) {
      const power = team.strength + clamp((ovr - 80) / 200, -0.05, 0.08);
      const winP = clamp(0.1 + power * 0.6, 0.2, 0.8);
      const groupP = clamp(0.5 + power * 0.45, 0.4, 0.95);
      let matches = 3;
      let stage = 'group';
      if (rng.next() < groupP) {
        stage = 'r16';
        const order = ['r16', 'qf', 'sf', 'final'];
        for (let i = 0; i < order.length; i += 1) {
          matches += 1;
          if (rng.next() < winP) stage = i === order.length - 1 ? 'champion' : order[i + 1];
          else { stage = order[i]; break; }
        }
      }
      // "Etapa alcanzada": caer en octavos = Octavos; perder la final = Subcampeón.
      let cupGoals = 0;
      for (let i = 0; i < matches; i += 1) {
        const plays = starter || rng.next() < 0.6;
        if (!plays) continue;
        caps += 1;
        if (!isGK) cupGoals += sampleCount(perMatch, rng);
      }
      goals += cupGoals;
      cup = { season: worldCup, stage, matches, goals: cupGoals, champion: stage === 'champion' };
      next.worldCups = [...nt.worldCups.filter((c) => c.season !== worldCup), cup];
      events.push({
        season,
        type: 'national',
        message: stage === 'champion'
          ? `🌎 ¡Campeón del Mundo ${worldCup} con ${team.name}!`
          : `Mundial ${worldCup} con ${team.name}: ${stageLabel(stage)}${cupGoals ? ` (${cupGoals} goles)` : ''}.`,
      });
      if (stage === 'champion') trophies.push({ ...WORLD_CUP_TROPHY, season, clubKey: null, clubName: team.name });
    } else {
      events.push({
        season,
        type: 'national',
        message: `${team.name} no clasificó al Mundial ${worldCup}.`,
      });
    }
  }

  next.caps = nt.caps + caps;
  next.goals = nt.goals + goals;
  next.seasons = [...nt.seasons, { season, caps, goals }];

  return {
    nationalTeam: next,
    report: { team: nationality, teamName: team.name, called: true, firstCall, caps, goals, qualifier, worldCup: cup },
    events,
    trophies,
  };
}
