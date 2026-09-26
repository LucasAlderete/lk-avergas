// ============================================================================
// EVENTOS INTERACTIVOS DE CARRERA â€” catÃ¡logo + helpers puros (Paso 1)
// ============================================================================
// CatÃ¡logo de eventos del universo Avergas para los checkpoints del modo
// carrera. JavaScript puro: sin React, sin localStorage, sin DOM y sin efectos
// secundarios. RNG inyectable con la misma filosofÃ­a que engine.js:
//   options.rng -> options.seed (createSeededRng determinista) -> RNG default.
//
// MecÃ¡nicas inspiradas en el anÃ¡lisis del copero-clone (eventos con
// decisiones en checkpoints, efectos de OVR/valor y oportunidades de
// traspaso), pero con catÃ¡logo, textos y decisiones 100% propios: humor y
// lore del grupo Avergas (data.js). Nada fue copiado del referente.
//
// Contratos con el resto del sistema:
// - Los textos usan placeholders ({club}, {rival}, {barrio}, {player},
//   {division}) que rollCareerEvent resuelve contra el mundo (careerWorld) al
//   rodar el evento: la UI recibe textos finales listos para mostrar.
// - Los eventos de traspaso NO ejecutan la transferencia: devuelven metadata
//   (career.pendingTransfer + lastDecision.transfer) para que engine.js la
//   procese despuÃ©s (p. ej. armando una oferta y llamando a acceptTransfer).
//   AcÃ¡ no se duplica lÃ³gica de acceptTransfer ni se toca career.club.
// - valueDelta es una FRACCIÃ“N del valor vigente (0.05 = +5%). Piso absoluto:
//   MARKET_VALUE.MIN; redondeo: MARKET_VALUE.ROUND_TO (ambos de config.js).
//   El motor re-normaliza el valor vÃ­a recomputeCareer en la prÃ³xima temporada.
// - Este archivo NO importa engine.js (el motor importarÃ¡ events.js en un
//   paso futuro): por eso replica en local el RNG y el clon profundo con el
//   mismo algoritmo y la misma filosofÃ­a, sin duplicar lÃ³gica de negocio.
// ============================================================================

import {
  AGE,
  MARKET_VALUE,
  clampOvr,
  marketValue,
  roleBucket,
  roleMargin,
} from './config.js';

import {
  clubs,
  divisions,
  clubKey,
  clubBaseline,
} from '../../data/careerWorld.js';

// -----------------------------------------------------------------------------
// 0) RNG + utilidades puras (espejo de engine.js, para no crear dependencia)
// -----------------------------------------------------------------------------

const defaultRng = {
  next: () => Math.random(),
  int: (min, max) => {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  },
};

// Mismo algoritmo que engine.createSeededRng (determinismo por seed).
function createSeededRng(seed) {
  let s = seed >>> 0;
  return {
    next() {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      const lo = Math.max(0, Math.min(min, max));
      const hi = Math.max(lo, max);
      return Math.floor(lo + this.next() * (hi - lo + 1));
    },
  };
}

/** options.rng -> options.seed -> default (misma cadena de decisiÃ³n del motor). */
function resolveRng(options = {}) {
  if (options.rng && typeof options.rng.next === 'function') return options.rng;
  if (options.seed != null) return createSeededRng(options.seed);
  return defaultRng;
}

/** SelecciÃ³n ponderada sobre una lista no vacÃ­a de { weight, ... }. */
function weightedPick(list, rng) {
  const total = list.reduce((acc, item) => acc + item.weight, 0);
  const r = rng.next() * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (r < acc) return item;
  }
  return list[list.length - 1];
}

/** Entero uniforme en [min, max] (inclusive) usando SOLO rng.next(). */
function sampleIntIn(rng, range) {
  const min = Math.ceil(Number(range[0]));
  const max = Math.floor(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return 0;
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** Clon profundo barato (misma estrategia que cloneCareer del motor). */
const deepClone = (value) => JSON.parse(JSON.stringify(value));

// -----------------------------------------------------------------------------
// 0.1) Contrato de balance y categorÃ­as (lo verifica el smoke test)
// -----------------------------------------------------------------------------

/**
 * LÃ­mites razonables de los efectos del catÃ¡logo. El catÃ¡logo completo debe
 * cumplirlos y el smoke test lo comprueba en cada ejecuciÃ³n.
 */
export const EVENT_LIMITS = {
  weight: [1, 50],
  ovrDelta: [-3, 3],         // rango [min, max] por decisiÃ³n
  valueDelta: [-0.08, 0.08], // fracciÃ³n del valor de mercado
  minAge: [AGE.START, AGE.RETIRE],
  maxPillsPerChoice: 4,
};

export const PILL_TONES = ['positive', 'negative', 'risky', 'special'];

export const RIVAL_SCOPES = ['same', 'higher', 'same_or_higher', 'any'];

/** CategorÃ­as de eventos (labels para la UI). */
export const EVENT_CATEGORIES = {
  mercado: 'Mercado de pases',
  vestuario: 'Vestuario',
  preparacion: 'PreparaciÃ³n',
  barrio: 'Barrio',
  mental: 'Mentalidad',
  retiro: 'Final del camino',
};
// -----------------------------------------------------------------------------
// 1) CATÃLOGO â€” "Las vueltas de la vida avergas"
// -----------------------------------------------------------------------------
// Contrato de cada evento:
//   id                 â€” estable (se persiste en saves, NUNCA renombrar).
//   title / icon       â€” para la UI.
//   category           â€” clave de EVENT_CATEGORIES.
//   weight             â€” peso de apariciÃ³n (positivo; se elige ponderado).
//   minAge / maxAge    â€” ventana de edad (opcional).
//   requiresRole       â€” roles vÃ¡lidos del jugador (opcional).
//   requiresPosition   â€” posiciones ARQ/DEF/MED/DEL (opcional).
//   excludeGK          â€” excluye arqueros (opcional).
//   requiresGK         â€” solo arqueros (opcional).
//   minClubReputation  â€” reputaciÃ³n domÃ©stica mÃ­nima 1-5 (opcional).
//   divisions          â€” divisiones vÃ¡lidas del club actual (opcional).
//   requiresRivalClub  â€” exige resolver un club rival al rodar (opcional).
//   rivalScope         â€” 'same' | 'higher' | 'same_or_higher' (default) | 'any'.
//   intro              â€” texto de escenario (placeholders permitidos).
//   choices[]          â€” decisiones:
//     id / label / description
//     ovrDelta         â€” [min, max] de delta OVR (opcional; default [0, 0]).
//     valueDelta       â€” fracciÃ³n del valor de mercado (opcional; default 0).
//     isTransfer       â€” genera metadata de traspaso (opcional).
//     transferReason   â€” motivo del traspaso (si isTransfer).
//     pills[]          â€” { label, tone } para la UI (tone: PILL_TONES).
//
// Los pesos son "frecuencia narrativa", no balance de mundo: los efectos
// quedan acotados por EVENT_LIMITS, asÃ­ ningÃºn evento domina la carrera.
// ============================================================================

export const CAREER_EVENTS = [
  // ---- MERCADO DE PASES ----------------------------------------------------
  {
    id: 'la_llamada_del_rival',
    title: 'El telÃ©fono del malviaje',
    icon: 'ðŸ“ž',
    category: 'mercado',
    weight: 9,
    requiresRivalClub: true,
    rivalScope: 'higher',
    intro: 'Un nÃºmero desconocido te dejÃ³ tres mensajes de voz. Es {rival}: dicen que sos el refuerzo que les falta... y tambiÃ©n el Ãºnico del plantel que contesta el telÃ©fono.',
    choices: [
      {
        id: 'atender',
        label: 'Atender el llamado',
        description: 'FirmÃ¡s a la vista: en {rival} prometen rodaje, auto propio y viandas los jueves.',
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'rival_offer',
        pills: [{ label: 'Traspaso a {rival}', tone: 'special' }],
      },
      {
        id: 'colgar',
        label: 'Colgar y quedarte',
        description: 'CortÃ¡s con estilo: "acÃ¡ estoy bien". El cuerpo tÃ©cnico lo toma como actitud de capitÃ¡n.',
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Lealtad', tone: 'positive' }, { label: '+0 a +1 OVR', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_rumor',
    title: 'El rumor del grupo',
    icon: 'ðŸ—žï¸',
    category: 'mercado',
    weight: 8,
    minAge: 19,
    intro: 'Un foro del barrio asegura que {club} te vende. Nadie sabe quiÃ©n lo publicÃ³, pero en el asado ya lo comentan con seriedad.',
    choices: [
      {
        id: 'desmentir',
        label: 'Desmentirlo en el grupo',
        description: 'Audio de dos minutos diciendo "acÃ¡ me quedo". El club lo agradece; el foro, no.',
        ovrDelta: [0, 1],
        valueDelta: 0.03,
        pills: [{ label: 'Mismo club', tone: 'positive' }],
      },
      {
        id: 'avivar',
        label: 'Avivar el rumor',
        description: 'No lo confirmÃ¡s ni lo negÃ¡s: el interÃ©s sube... y tu concentraciÃ³n baja un poco.',
        ovrDelta: [-1, 1],
        valueDelta: 0.08,
        pills: [{ label: 'Valor al alza', tone: 'special' }, { label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'escuchar_ofertas',
        label: 'Escuchar ofertas',
        description: 'DejÃ¡s entrever que estarÃ­as "abierto a proyectos". El mercado hace el resto.',
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'fresh_start',
        pills: [{ label: 'Oportunidad de traspaso', tone: 'special' }],
      },
    ],
  },
  {
    id: 'la_vuelta_al_barrio',
    title: 'Volver al barrio',
    icon: 'ðŸ˜ï¸',
    category: 'mercado',
    weight: 7,
    requiresRivalClub: true,
    rivalScope: 'any',
    intro: 'Desde {rival} te llaman: "volvÃ©, acÃ¡ sos Ã­dolo y el asado de los jueves corre por nuestra cuenta".',
    choices: [
      {
        id: 'volver',
        label: 'Volver a casa',
        description: 'DejÃ¡s todo por el barrio. El corazÃ³n te lo agradece; el plan de carrera, no tanto.',
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'return_home',
        pills: [{ label: 'Traspaso a {rival}', tone: 'special' }],
      },
      {
        id: 'quedarte',
        label: 'Quedarte donde estÃ¡s',
        description: '"Ya pasÃ© esa etapa": el club lo celebra como actitud de capataz.',
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Lealtad', tone: 'positive' }],
      },
    ],
  },
  // ---- VESTUARIO ------------------------------------------------------------
  {
    id: 'el_banquillo',
    title: 'Banquillo de proyectiles',
    icon: 'ðŸ§±',
    category: 'vestuario',
    weight: 9,
    requiresRole: ['substitute', 'low_rotation', 'third_keeper'],
    intro: 'Tres partidos seguidos sin entrar. El banco ya conoce tu colecciÃ³n completa de gestos y hasta te guarda lugar.',
    choices: [
      {
        id: 'reclamar',
        label: 'Reclamar fuerte',
        description: 'Gritos con el DT incluidos: o te mandan a la cancha o te mandan a la tribuna.',
        ovrDelta: [-1, 1],
        valueDelta: -0.01,
        pills: [{ label: 'Todo o nada', tone: 'risky' }],
      },
      {
        id: 'entrenar',
        label: 'Entrenar como crack',
        description: 'Dobles turnos y silencio. El DT dice "sigue asÃ­" por dÃ©cima vez. A veces la dÃ©cima primera llega.',
        ovrDelta: [0, 2],
        pills: [{ label: 'Esfuerzo', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_malviaje_colectivo',
    title: 'Malviaje colectivo',
    icon: 'ðŸŒ€',
    category: 'vestuario',
    weight: 11,
    intro: 'Media tabla abajo y el vestuario se dio por vencido: alguien pidiÃ³ silencio para escuchar "una idea buena de verdad".',
    choices: [
      {
        id: 'arenga',
        label: 'Arenga Ã©pica',
        description: 'Dos minutos de pelÃ­cula. El plantel sale espejado... hasta el primer cÃ³rner en contra.',
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Liderazgo', tone: 'positive' }],
      },
      {
        id: 'rendirse',
        label: 'Rendirse al malviaje',
        description: '"Total ya estamos Ãºltimos": el plantel te abraza. El tÃ©cnico no.',
        ovrDelta: [-2, 0],
        valueDelta: -0.02,
        pills: [{ label: 'Baja de nivel', tone: 'negative' }, { label: '-2 a 0 OVR', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'la_gala',
    title: 'La gala de la Avergas',
    icon: 'ðŸŽ©',
    category: 'vestuario',
    weight: 5,
    minClubReputation: 4,
    divisions: [1, 2],
    intro: 'El club te invita a la gala anual de la liga. Hay alfombra roja, trofeos y un buffet con panadera generosa.',
    choices: [
      {
        id: 'ir_con_todo',
        label: 'Ir con todo',
        description: 'Traje, champÃ¡n y fotos hasta las cuatro de la maÃ±ana. La fama sube; el entrenamiento del sÃ¡bado, no.',
        ovrDelta: [-1, 1],
        valueDelta: 0.03,
        pills: [{ label: 'Fama', tone: 'special' }, { label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'evitar',
        label: 'Evitar la gala',
        description: '"Prefiero la cancha": humildad de cartel. El entrenador te quiere un poco mÃ¡s.',
        ovrDelta: [0, 1],
        pills: [{ label: 'ConcentraciÃ³n', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_arbitro_de_verdad',
    title: 'Ãrbitro federado',
    icon: 'ðŸ§‘â€âš–ï¸',
    category: 'vestuario',
    weight: 10,
    intro: 'Por una vez viene un Ã¡rbitro federado con silbato de verdad y todo. El vestuario entra en pÃ¡nico protocolar.',
    choices: [
      {
        id: 'reglamento',
        label: 'Estudiar el reglamento',
        description: 'Sos el Ãºnico que sabe que la nueva regla del saque existe. Ventaja tÃ¡ctica y moral.',
        ovrDelta: [0, 1],
        pills: [{ label: 'Ventaja tÃ¡ctica', tone: 'positive' }],
      },
      {
        id: 'tonto',
        label: 'Hacerte el tonto',
        description: '"Â¿Eso era falta?": la carita de inocente te salva una. Casi.',
        ovrDelta: [-1, 1],
        valueDelta: 0.01,
        pills: [{ label: 'Teatro', tone: 'risky' }],
      },
    ],
  },
  // ---- PREPARACIÃ“N -----------------------------------------------------------
  {
    id: 'la_dieta_milagrosa',
    title: 'La dieta milagrosa',
    icon: 'ðŸ¥—',
    category: 'preparacion',
    weight: 8,
    minAge: 22,
    intro: 'Un video viral te asegura que con solo jugos detox y caminatas vas a volver al OVR de tus 20. El grupo opina que no.',
    choices: [
      {
        id: 'probar',
        label: 'Probar la dieta',
        description: 'Diez dÃ­as a lechuga. BajÃ¡s de peso, subÃ­s de humor... y perdÃ©s el fÃ­sico del futsal.',
        ovrDelta: [-2, 0],
        pills: [{ label: 'Riesgo fÃ­sico', tone: 'negative' }],
      },
      {
        id: 'desoÃ­r',
        label: 'Seguir con la fÃºtbol-comida',
        description: 'Asado, futsal y a otra cosa. El equilibrio de siempre gana otra vez.',
        ovrDelta: [0, 1],
        pills: [{ label: 'Estabilidad', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_entrenador_nuevo',
    title: 'El tÃ©cnico nuevo',
    icon: 'ðŸ“‹',
    category: 'preparacion',
    weight: 9,
    intro: 'Llega un tÃ©cnico nuevo con carpeta y pizarra. Dice que va a "revolucionar el sistema" y que "el futsal es geometrÃ­a".',
    choices: [
      {
        id: 'apoyarlo',
        label: 'Hacerte alumno modelo',
        description: 'Te aprendÃ©s la geometrÃ­a y el plan entero. En dos semanas el sistema funciona casi por accidente.',
        ovrDelta: [0, 2],
        valueDelta: 0.02,
        pills: [{ label: 'ProgresiÃ³n', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
      {
        id: 'boicotear',
        label: 'Seguir jugando a lo que sale',
        description: 'Ojos en blanco colectivo: el plantel te agradece. El tÃ©cnico te arma planilla.',
        ovrDelta: [-2, 1],
        valueDelta: -0.01,
        pills: [{ label: 'Riesgo', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'la_lesion_puerta',
    title: 'El crujido sospechoso',
    icon: 'ðŸ¦µ',
    category: 'preparacion',
    weight: 7,
    minAge: 28,
    excludeGK: true,
    intro: 'En el calentamiento sentÃ­s un crujido en el isquio. Los kinesiÃ³logos del barrio ya te conocen por tu nÃºmero de celular.',
    choices: [
      {
        id: 'jugar',
        label: 'Jugar igual',
        description: '"Con hielo se pasa": pones tu historial mÃ©dico para una ruleta.',
        ovrDelta: [-3, 1],
        pills: [{ label: 'Riesgo alto', tone: 'risky' }, { label: '-3 a +1 OVR', tone: 'risky' }],
      },
      {
        id: 'cuidarse',
        label: 'Cuidarse dos semanas',
        description: 'Te perdÃ©s partidos, pero ganÃ¡s cuerpo: el isquio te da una segunda oportunidad.',
        ovrDelta: [-1, 1],
        pills: [{ label: 'PrevenciÃ³n', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'la_gimnasia_mental',
    title: 'La gimnasia mental',
    icon: 'ðŸ§˜',
    category: 'preparacion',
    weight: 6,
    intro: 'El club contratÃ³ un coach mental. "VisualizÃ¡ la pelota entrando" te dice. El plantel, dividido entre creyentes y burlones.',
    choices: [
      {
        id: 'visualizar',
        label: 'Visualizar',
        description: 'Tres semanas de respiraciÃ³n y planchas. Curiosamente, ya no te tiembla el piÃ© en el mano a mano.',
        ovrDelta: [0, 2],
        pills: [{ label: 'Enfoque', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
      {
        id: 'burlarse',
        label: 'Burlarte del coach',
        description: 'ImitaciÃ³n del "visualizÃ¡ la pelota" en cada descanso. Risas en el banco, rigidez en la cancha.',
        ovrDelta: [-1, 0],
        valueDelta: -0.01,
        pills: [{ label: 'DistracciÃ³n', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'el_torneo_de_verano',
    title: 'El torneo de verano',
    icon: 'ðŸ–ï¸',
    category: 'preparacion',
    weight: 8,
    intro: 'Torneo relÃ¡mpago en la arena: premios en efectivo, speaker improvisado y cero rehabilitaciÃ³n fÃ­sica.',
    choices: [
      {
        id: 'participar',
        label: 'Jugar el torneo',
        description: 'Doble jornada en la arena: aflojÃ¡s el futsal y afinÃ¡s la jogada de la ruleta del verano.',
        ovrDelta: [-1, 2],
        valueDelta: 0.01,
        pills: [{ label: 'Esfuerzo extra', tone: 'risky' }, { label: 'Rodaje', tone: 'positive' }],
      },
      {
        id: 'descansar',
        label: 'Descansar',
        description: 'Sombrilla y mate: llegÃ¡s fresco, aunque el speaker te mienta en la radio del barrio.',
        ovrDelta: [0, 1],
        pills: [{ label: 'RecuperaciÃ³n', tone: 'positive' }],
      },
    ],
  },
  // ---- BARRIO ---------------------------------------------------------------
  {
    id: 'el_asado_del_club',
    title: 'El asado oficial del club',
    icon: 'ðŸ¥©',
    category: 'barrio',
    weight: 9,
    minClubReputation: 2,
    intro: 'El club organiza el asado de recaudaciÃ³n. Hay vacÃ­o, achuras y una rifa con premios que nadie quiere confesar.',
    choices: [
      {
        id: 'parrillero',
        label: 'Ofrecerte de parrillero',
        description: 'Diez horas de fuego y charla con la comisiÃ³n: te ven como "uno de los nuestros".',
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Carisma', tone: 'positive' }],
      },
      {
        id: 'invitado',
        label: 'Ir solo de invitado',
        description: 'ComÃ©s, brindÃ¡s y te vas temprano. Los engranajes del club lo notan.',
        ovrDelta: [0, 0],
        pills: [{ label: 'Neutral', tone: 'special' }],
      },
    ],
  },
  {
    id: 'el_partido_caritativo',
    title: 'El partido a beneficio',
    icon: 'â¤ï¸',
    category: 'barrio',
    weight: 7,
    excludeGK: true,
    intro: 'Un partido benÃ©fico con invitados: un ex crack de {division}, un influencer del barrio y el cajero del kiosco de la esquina.',
    choices: [
      {
        id: 'participar',
        label: 'Jugar y hacer el show',
        description: 'Sombrerero al influencer y gol de chilena al cajero: la platea se rinde al espectÃ¡culo.',
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'EspectÃ¡culo', tone: 'positive' }],
      },
      {
        id: 'protagonista',
        label: 'Jugar en serio',
        description: 'PisÃ¡s el acelerador como si fuera una final: ganÃ¡s el partido y el respeto, no las risas.',
        ovrDelta: [0, 1],
        valueDelta: 0.01,
        pills: [{ label: 'Respeto', tone: 'positive' }],
      },
      {
        id: 'no_ir',
        label: 'No ir',
        description: '"Ese dÃ­a tenÃ­a cosas": el barrio te perdona... y lo anota.',
        ovrDelta: [-1, 0],
        pills: [{ label: 'AntipatÃ­a', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'el_negocio_del_cuÃ±ado',
    title: 'El negocio del cuÃ±ado',
    icon: 'ðŸ’¼',
    category: 'barrio',
    weight: 6,
    minAge: 24,
    intro: 'El cuÃ±ado de un amigo propone invertir tus bonos de fichaje en un emprendimiento de protÃ©sicos de fÃºtbol 5. Promete retornos extraordinarios.',
    choices: [
      {
        id: 'invertir',
        label: 'Invertir todo',
        description: 'Seis meses de silencio, luego una jubilaciÃ³n extraordinaria: el emprendimiento despega (milagro incluido).',
        ovrDelta: [-1, 1],
        valueDelta: 0.05,
        pills: [{ label: 'Fortuna', tone: 'special' }, { label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'rechazar',
        label: 'Rechazar con diplomacia',
        description: '"Te consulto cuando cobre el prÃ³ximo bono": crisis diplomÃ¡tica evitada y amistad intacta.',
        ovrDelta: [0, 0],
        pills: [{ label: 'Neutral', tone: 'special' }],
      },
    ],
  },
  // ---- MENTALIDAD -------------------------------------------------------------
  {
    id: 'la_presion_social',
    title: 'La presiÃ³n del grupo',
    icon: 'ðŸ˜…',
    category: 'mental',
    weight: 8,
    intro: 'El grupo de WhatsApp del club te tagea en cada video de goles de la liga. "Este es el aÃ±o", dicen. Todos los aÃ±os dicen.',
    choices: [
      {
        id: 'abrazar',
        label: 'Abrazar la presiÃ³n',
        description: 'ContestÃ¡s todos los mensajes con "vamos que se puede": el grupo se inflama contigo.',
        ovrDelta: [0, 1],
        valueDelta: 0.01,
        pills: [{ label: 'Carisma', tone: 'positive' }],
      },
      {
        id: 'silenciar',
        label: 'Silenciar el grupo',
        description: 'Modo no molestar: sos libre, pero los "te vimos mirar el grupo" tampoco se perdonan.',
        ovrDelta: [-1, 0],
        pills: [{ label: 'Aislamiento', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'el_comparador',
    title: 'El comparador de carreras',
    icon: 'ðŸ“Š',
    category: 'mental',
    weight: 7,
    minAge: 20,
    intro: 'Un ex compaÃ±ero de cantera brillÃ³ en {club} y ahora es "la promesa del barrio". Todos lo comparan contigo. Todos los domingos.',
    choices: [
      {
        id: 'inspirarse',
        label: 'Usarlo como gasolina',
        description: 'Dobles turnos con bronca productiva: la comparaciÃ³n se convierte en gasolina.',
        ovrDelta: [0, 2],
        pills: [{ label: 'MotivaciÃ³n', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
      {
        id: 'obsesionarse',
        label: 'Obsesionarte',
        description: 'MirÃ¡s los videos del otro hasta las 3 AM: el entreno del lunes se resiente.',
        ovrDelta: [-2, 0],
        pills: [{ label: 'DistracciÃ³n', tone: 'negative' }],
      },
      {
        id: 'ignorar',
        label: 'Ignorar el tema',
        description: '"Cada carrera es distinta": zen absoluto, cero drama, cero brillo extra.',
        ovrDelta: [0, 0],
        pills: [{ label: 'Neutral', tone: 'special' }],
      },
    ],
  },
  // ---- ARQUERO (especÃ­ficos) ---------------------------------------------------
  {
    id: 'los_guantes_nuevos',
    title: 'Guantes nuevos, suerte nueva',
    icon: 'ðŸ§¤',
    category: 'preparacion',
    weight: 8,
    requiresGK: true,
    intro: 'Llegaron tus guantes nuevos al club. La etiqueta dice "agarre turbo" y el vendedor jurÃ³ que "son los que usa la Primera".',
    choices: [
      {
        id: 'estrenar',
        label: 'Estrenarlos de inmediato',
        description: 'Primer entrenamiento: tres atajadas imposibles. Coincidencia o magia de guantes, el arco se siente tuyo.',
        ovrDelta: [0, 2],
        pills: [{ label: 'Confianza', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
      {
        id: 'guardar',
        label: 'Guardarlos para la final',
        description: 'Los dejÃ¡s impecables en el ropero: cuando salen, el club ya estÃ¡ descendido. Misterios del futsal.',
        ovrDelta: [-1, 0],
        pills: [{ label: 'SupersticiÃ³n', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'el_arquero_goleador',
    title: 'El arquero que quiere ser goleador',
    icon: 'ðŸ¥…',
    category: 'vestuario',
    weight: 6,
    requiresGK: true,
    minAge: 20,
    intro: 'En los entrenamientos te pides a puntero y pedÃ­s que te tiren pelotas para "probar algo nuevo". El tÃ©cnico duda entre la gracia y el furor.',
    choices: [
      {
        id: 'subir_al_area',
        label: 'Subir al Ã¡rea en los cÃ³rners',
        description: 'Gol de cabeza en la fecha 5. Y en la 12. Y en la 27: sos el arquero mÃ¡s temido del aire del metro.',
        ovrDelta: [-1, 2],
        valueDelta: 0.02,
        pills: [{ label: 'EspectÃ¡culo', tone: 'special' }, { label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'cuidar_el_arco',
        label: 'Quedarte bajo los tres palos',
        description: 'Vallas invictas y silencio: aburrido para la tribuna, ideal para la tabla.',
        ovrDelta: [0, 1],
        pills: [{ label: 'Confiabilidad', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_tercer_arquero',
    title: 'Tercer arquero, primera esperanza',
    icon: 'ðŸª‘',
    category: 'vestuario',
    weight: 8,
    requiresGK: true,
    requiresRole: ['third_keeper', 'substitute'],
    intro: 'El entrenador te confirma lo que el mundo ya sabÃ­a: sos el tercer arquero. Pero promete que "hay proyecto" y que "todo se mueve".',
    choices: [
      {
        id: 'pedir_prestamo',
        label: 'Pedir prÃ©stamo',
        description: 'Cedido a un club donde el arco es tuyo: rodaje real y cansancio real.',
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'loan_move',
        pills: [{ label: 'PrÃ©stamo', tone: 'special' }],
      },
      {
        id: 'quedarse_esperando',
        label: 'Esperar tu chance',
        description: 'Entrenamientos al lÃ­mite: cuando el titular se lastima, ya estÃ¡s a punto. La paciencia paga.',
        ovrDelta: [0, 2],
        pills: [{ label: 'Paciencia', tone: 'positive' }, { label: '+0 a +2 OVR', tone: 'positive' }],
      },
    ],
  },
  // ---- FINAL DEL CAMINO --------------------------------------------------------
  {
    id: 'el_ultimo_verano',
    title: 'El Ãºltimo verano',
    icon: 'ðŸŒ…',
    category: 'retiro',
    weight: 4,
    minAge: 34,
    intro: 'Sos de los mÃ¡s veteranos del plantel. Los jÃ³venes te miran como a una enciclopedia andante y los mÃ©dicos te miran como a un seguro con cuotas.',
    choices: [
      {
        id: 'mentor',
        label: 'Volverte mentor',
        description: 'PasÃ¡s lo que sabÃ©s a los pibes: la cancha te empieza a extraÃ±ar menos. O eso decÃ­s.',
        ovrDelta: [-1, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Legado', tone: 'positive' }],
      },
      {
        id: 'a_gasto',
        label: 'Ir con todo una temporada mÃ¡s',
        description: 'Pretemporada doble, dieta estricta: la Ãºltima gran pata de la carrera (o la primera lesiÃ³n seria).',
        ovrDelta: [-2, 2],
        pills: [{ label: 'Ãšltimo baile', tone: 'risky' }, { label: '-2 a +2 OVR', tone: 'risky' }],
      },
      {
        id: 'colgar',
        label: 'Pensar en colgar los botines',
        description: 'Le das vueltas a la idea del retiro: el cuerpo te lo agradece, la cancha no se entera.',
        ovrDelta: [-1, 0],
        valueDelta: -0.02,
        pills: [{ label: 'Retiro en vista', tone: 'special' }],
      },
    ],
  },
  {
    id: 'la_leyenda_del_barrio',
    title: 'La leyenda del barrio',
    icon: 'ðŸ—¿',
    category: 'retiro',
    weight: 3,
    minAge: 30,
    minClubReputation: 3,
    intro: 'En el club ya hablan de vos en pasado por costumbre, pero en el barrio te siguen pidiendo fotos y consejos de tiro libre.',
    choices: [
      {
        id: 'academia',
        label: 'Abrir una academia de fÃºtbol',
        description: 'Tu nombre en la colchoneta y veinte pibes aprendiendo tu golpeo: la leyenda se vuelve instituciÃ³n.',
        ovrDelta: [-1, 1],
        valueDelta: 0.04,
        pills: [{ label: 'Legado', tone: 'positive' }, { label: 'Valor al alza', tone: 'positive' }],
      },
      {
        id: 'recibir_homenaje',
        label: 'Recibir el homenaje del club',
        description: 'Camiseta enmarcada, aplausos y un discurso del presidente que dura mÃ¡s que tu mejor temporada.',
        ovrDelta: [0, 1],
        pills: [{ label: 'Honor', tone: 'positive' }],
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// 2) HELPERS PUROS â€” elegibilidad, rivales, textos y aplicaciÃ³n de decisiones
// -----------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Rellena {placeholders} del texto con el diccionario dado (puro). */
function fillTemplate(text, values) {
  return String(text).replace(PLACEHOLDER_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/** DivisiÃ³n del club actual de la carrera (fallback 3 si el dato falta). */
function currentDivisionOf(career) {
  const nivel = career?.club?.division;
  return divisions.find((d) => d.nivel === nivel) || divisions[divisions.length - 1];
}

/** Nombre legible de la divisiÃ³n ("Primera Avergas", etc.). */
const divisionName = (division) => division?.name || 'Liga del Barrio';

/**
 * Clubes rivales candidatos segÃºn el alcance pedido:
 *   'same'            â†’ misma divisiÃ³n (excluye el club actual).
 *   'higher'          â†’ divisiÃ³n superior estricta (el club actual excluido).
 *   'same_or_higher'  â†’ misma divisiÃ³n o superior (default).
 *   'any'             â†’ todo el mundo (excluye el club actual).
 */
function rivalCandidates(career, scope) {
  const current = career?.club;
  const division = currentDivisionOf(career);
  const sameDivision = (club) => club.division === division.nivel;
  const higherDivision = (club) => club.division < division.nivel; // 1 es la mÃ¡s alta
  const notCurrent = (club) => !current || club.slug !== current.slug;

  const level = {
    same: sameDivision,
    higher: higherDivision,
    same_or_higher: (club) => sameDivision(club) || higherDivision(club),
    any: () => true,
  }[scope] || ((club) => sameDivision(club) || higherDivision(club));

  return clubs.filter((club) => notCurrent(club) && level(club));
}

/**
 * Elige un club rival con el RNG inyectado, ponderado por cercanÃ­a de
 * baseline al jugador (los rivales "creÃ­bles" son los de su nivel). Devuelve
 * { club, ref } o null si no hay candidatos (p. ej. D1 pidiendo 'higher').
 */
function pickRivalClub(career, scope, rng) {
  const candidates = rivalCandidates(career, scope);
  if (candidates.length === 0) return null;
  const ovr = Number.isFinite(career?.ovr) ? career.ovr : clubBaseline(candidates[0]);
  const weighted = candidates.map((club) => ({
    club,
    weight: 1 + 1 / (1 + Math.abs(ovr - clubBaseline(club))),
  }));
  const chosen = weightedPick(weighted, rng).club;
  return {
    club: chosen,
    ref: {
      key: clubKey(chosen),
      slug: chosen.slug,
      name: chosen.name,
      short: chosen.short,
      barrio: chosen.barrio,
      division: chosen.division,
      colors: { ...chosen.colors },
    },
  };
}

/**
 * Â¿El evento aplica a esta carrera? Puro: solo lee, nunca muta.
 * Efectivo: no retirado Â· edad dentro de la ventana Â· rol permitido Â·
 * posiciÃ³n (ARQ/DEF/MED/DEL, excludeGK/requiresGK) Â· reputaciÃ³n domÃ©stica
 * mÃ­nima Â· divisiÃ³n del club permitida. La disponibilidad de un club rival
 * se evalÃºa aparte en rollCareerEvent (usa RNG).
 */
export function eventEligible(event, career) {
  if (!event || !career || typeof event !== 'object' || typeof career !== 'object') return false;
  if (career.retired) return false;
  if (Array.isArray(event.choices) && event.choices.length === 0) return false;

  const age = career.age;
  if (Number.isFinite(event.minAge) && age < event.minAge) return false;
  if (Number.isFinite(event.maxAge) && age > event.maxAge) return false;

  if (Array.isArray(event.requiresRole) && event.requiresRole.length > 0) {
    if (!event.requiresRole.includes(career.role)) return false;
  }

  const isGK = career.position === 'ARQ';
  if (event.excludeGK && isGK) return false;
  if (event.requiresGK && !isGK) return false;
  if (Array.isArray(event.requiresPosition) && event.requiresPosition.length > 0) {
    if (!event.requiresPosition.includes(career.position)) return false;
  }

  if (Number.isFinite(event.minClubReputation)) {
    const rep = Number.isFinite(career.domesticRep) ? career.domesticRep : 0;
    if (rep < event.minClubReputation) return false;
  }

  if (Array.isArray(event.divisions) && event.divisions.length > 0) {
    if (!event.divisions.includes(career?.club?.division)) return false;
  }

  return true;
}

/**
 * Todos los eventos elegibles del catÃ¡logo (array nuevo, orden del catÃ¡logo).
 */
export function eligibleCareerEvents(career) {
  return CAREER_EVENTS.filter((event) => eventEligible(event, career));
}

/** Metadatos de club + barrio para los placeholders de texto. */
function contextValues(career, rival) {
  const division = currentDivisionOf(career);
  return {
    player: career?.name || 'El crack',
    club: career?.club?.name || 'el club',
    barrio: career?.club?.barrio || 'el barrio',
    division: divisionName(division),
    rival: rival?.club?.name || 'un club del interior',
  };
}

/**
 * Rueda un evento de carrera para el checkpoint: elige entre los elegibles
 * con pesos, resuelve el club rival (si hace falta) y rellena los textos.
 *
 * Devuelve { event, context, weightTotal } o null si no hay nada que rodar:
 *   event       â€” evento del catÃ¡logo con intro/choices/pills ya interpolados.
 *   context     â€” { rival } con la ref estable del club rival resuelto (si el
 *                 evento lo requerÃ­a). Guardar junto a la decisiÃ³n para que
 *                 applyEventChoice reconstruya exactamente el mismo traspaso.
 *   weightTotal â€” suma de pesos de los elegibles (info de telemetrÃ­a/UI).
 *
 * Puro: no muta career. rng/seed inyectables; sin seed usa el default.
 */
export function rollCareerEvent(career, options = {}) {
  if (!career || typeof career !== 'object' || career.retired) return null;

  const rng = resolveRng(options);
  const pool = eligibleCareerEvents(career)
    // Con rival requerido: solo si el mundo tiene candidatos para el alcance.
    .filter((event) => !event.requiresRivalClub
      || rivalCandidates(career, event.rivalScope || 'same_or_higher').length > 0);
  if (pool.length === 0) return null;

  const chosen = weightedPick(pool, rng);
  const scope = chosen.rivalScope || 'same_or_higher';
  const rival = chosen.requiresRivalClub ? pickRivalClub(career, scope, rng) : null;

  const values = contextValues(career, rival);
  const event = {
    ...chosen,
    intro: fillTemplate(chosen.intro, values),
    choices: (chosen.choices || []).map((choice) => ({
      ...choice,
      label: fillTemplate(choice.label, values),
      description: fillTemplate(choice.description, values),
      pills: (choice.pills || []).map((pill) => ({
        ...pill,
        label: fillTemplate(pill.label, values),
      })),
    })),
  };

  return {
    event,
    context: rival ? { rival: rival.ref } : { rival: null },
    weightTotal: pool.reduce((acc, item) => acc + item.weight, 0),
  };
}

/**
 * Aplica la decisiÃ³n elegida y devuelve una NUEVA carrera (no muta ninguna).
 *
 * @param {object} career Carrera vigente (no se muta).
 * @param {object} event  Evento devuelto por rollCareerEvent (o del catÃ¡logo).
 * @param {object|string} choice DecisiÃ³n elegida (objeto, id, o null/invÃ¡lido).
 * @param {{ seed?: number, rng?: object, context?: { rival?: object } }} [options]
 *   context.rival â€” ref del club rival guardada junto al evento rodado; si no
 *   viene y el evento lo requiere, se re-resuelve con el RNG/seed dado.
 * @returns {{ career: object, outcome: object }} Carrera nueva + outcome
 *   (ovrDelta, valueDelta, transfer, logEvent, pills). Entrada invÃ¡lida â†’
 *   { career: clon sin cambios, outcome.applied: false } (nunca lanza).
 */
export function applyEventChoice(career, event, choice, options = {}) {
  const clean = deepClone(career ?? {});
  const outcome = {
    eventId: event?.id || null,
    choiceId: null,
    applied: false,
    reason: null,
    ovrDelta: 0,
    valueDelta: 0,
    newOvr: clean.ovr,
    newValue: clean.marketValue,
    transfer: null,
    logEvent: null,
    pills: [],
  };

  // 0) Guardas de entrada (sin lanzar: son casos normales de UI).
  if (!career || typeof career !== 'object') {
    outcome.reason = 'invalid_career';
    return { career: clean, outcome };
  }
  // Sin evento no hay decisión aplicable: el choice debe venir de un evento
  // (rodado o del catálogo). Nunca se acepta un objeto crudo suelto.
  if (!event || typeof event !== 'object') {
    outcome.reason = 'invalid_choice';
    return { career: clean, outcome };
  }
  const sourceChoice = Array.isArray(event.choices)
    ? (typeof choice === 'string'
      ? event.choices.find((c) => c?.id === choice) || null
      : event.choices.find((c) => c?.id === choice?.id) || null)
    : null;
  if (!sourceChoice) {
    outcome.reason = 'invalid_choice';
    return { career: clean, outcome };
  }
  if (clean.retired) {
    outcome.reason = 'retired';
    return { career: clean, outcome };
  }

  const rng = resolveRng(options);
  outcome.choiceId = sourceChoice.id;
  outcome.applied = true;

  // 1) Delta de OVR: entero muestreado del rango de la decisiÃ³n, acotado a
  //    EVENT_LIMITS.ovrDelta y al techo/piso absolutos del juego (clampOvr).
  const range = Array.isArray(sourceChoice.ovrDelta) ? sourceChoice.ovrDelta : [0, 0];
  let ovrDelta = sampleIntIn(rng, range);
  ovrDelta = Math.max(EVENT_LIMITS.ovrDelta[0], Math.min(EVENT_LIMITS.ovrDelta[1], ovrDelta));
  if (ovrDelta !== 0) {
    clean.ovr = clampOvr(clean.ovr + ovrDelta);
    clean.overallPeak = Math.max(clean.overallPeak ?? clean.ovr, clean.ovr);
    // Estado derivado dependiente del OVR (misma fÃ³rmula que el motor usa en
    // recalcCareerState): rol y comparaciÃ³n contra el baseline del club. La
    // reputaciÃ³n, el club y el valor "canÃ³nico" los re-normaliza el motor.
    if (clean.club && Number.isFinite(clean.ovr)) {
      const base = clubBaseline(clean.club);
      clean.clubBaseline = base;
      clean.overallVsBaseline = clean.ovr - base + roleMargin(clean.attrs);
      clean.role = roleBucket(clean.ovr - base, clean.position === 'ARQ');
    }
  }
  outcome.ovrDelta = ovrDelta;
  outcome.newOvr = clean.ovr;

  // 2) Delta de valor: fracciÃ³n del valor vigente, con piso absoluto
  //    MARKET_VALUE.MIN y redondeo MARKET_VALUE.ROUND_TO (config.js). El
  //    motor re-normaliza el valor vÃ­a recomputeCareer en la prÃ³xima temporada.
  const valueFraction = Number.isFinite(sourceChoice.valueDelta)
    ? Math.max(EVENT_LIMITS.valueDelta[0], Math.min(EVENT_LIMITS.valueDelta[1], sourceChoice.valueDelta))
    : 0;
  if (valueFraction !== 0) {
    const base = Number.isFinite(clean.marketValue) && clean.marketValue > 0
      ? clean.marketValue
      : marketValue({ ovr: clean.ovr, age: clean.age, reputation: clean.domesticRep });
    const adjusted = base * (1 + valueFraction);
    clean.marketValue = Math.max(
      MARKET_VALUE.MIN,
      Math.round(adjusted / MARKET_VALUE.ROUND_TO) * MARKET_VALUE.ROUND_TO,
    );
  }
  outcome.valueDelta = valueFraction;
  outcome.newValue = clean.marketValue;

  // 3) Traspaso: SOLO metadata. No se toca career.club ni se duplica la
  //    lÃ³gica de acceptTransfer: engine.js procesarÃ¡ esta seÃ±al despuÃ©s.
  let transfer = null;
  if (sourceChoice.isTransfer) {
    let rivalRef = options?.context?.rival || null;
    if (event?.requiresRivalClub && !rivalRef) {
      const rolled = pickRivalClub(clean, event.rivalScope || 'same_or_higher', rng);
      rivalRef = rolled?.ref || null;
    }
    transfer = {
      via: 'career_event',
      reason: sourceChoice.transferReason || 'event_transfer',
      eventId: event?.id || null,
      choiceId: sourceChoice.id,
      season: clean.season,
      age: clean.age,
      playerOvr: clean.ovr,
      targetClub: rivalRef, // ref estable del mundo, o null (el motor decide)
    };
    clean.pendingTransfer = transfer;
    outcome.transfer = transfer;
  }

  // 4) Log del evento con la convenciÃ³n del motor (season/type/message),
  //    lastDecision para la UI y pills interpoladas.
  const rivalForText = (options?.context?.rival || transfer?.targetClub)
    ? { club: { name: (options?.context?.rival || transfer?.targetClub).name } }
    : (event?.requiresRivalClub ? { club: { name: 'un club del interior' } } : null);
  const values = contextValues(clean, rivalForText);
  const pills = (sourceChoice.pills || []).map((pill) => ({
    ...pill,
    label: fillTemplate(pill.label, values),
  }));
  const logEvent = {
    season: clean.season,
    type: 'career_event',
    message: `${event?.icon || 'ðŸ“Œ'} ${event?.title || 'Evento'}: ${sourceChoice.label}`,
    eventId: event?.id || null,
    choiceId: sourceChoice.id,
    ovrDelta,
    valueDelta: valueFraction,
    isTransfer: Boolean(transfer),
  };
  clean.events = [...(clean.events || []), logEvent];
  clean.lastDecision = {
    eventId: event?.id || null,
    eventTitle: event?.title || null,
    choiceId: sourceChoice.id,
    choiceLabel: sourceChoice.label,
    season: clean.season,
    age: clean.age,
    ovrDelta,
    valueDelta: valueFraction,
    transfer,
    pills,
  };
  outcome.logEvent = logEvent;
  outcome.pills = pills;

  return { career: clean, outcome };
}
