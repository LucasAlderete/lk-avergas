// ============================================================================
// EVENTOS INTERACTIVOS DE CARRERA — catálogo + helpers puros (Paso 1)
// ============================================================================
// Catálogo de eventos del universo Avergas para los checkpoints del modo
// carrera. JavaScript puro: sin React, sin localStorage, sin DOM y sin efectos
// secundarios. RNG inyectable con la misma filosofía que engine.js:
//   options.rng -> options.seed (createSeededRng determinista) -> RNG default.
//
// Mecánicas inspiradas en el análisis del copero-clone (eventos con
// decisiones en checkpoints, efectos de OVR/valor y oportunidades de
// traspaso), pero con catálogo, textos y decisiones 100% propios: humor y
// lore del grupo Avergas (data.js). Nada fue copiado del referente.
//
// Contratos con el resto del sistema:
// - Los textos usan placeholders ({club}, {rival}, {barrio}, {player},
//   {division}) que rollCareerEvent resuelve contra el mundo (careerWorld) al
//   rodar el evento: la UI recibe textos finales listos para mostrar.
// - Los eventos de traspaso NO ejecutan la transferencia: devuelven metadata
//   (career.pendingTransfer + lastDecision.transfer) para que engine.js la
//   procese después (p. ej. armando una oferta y llamando a acceptTransfer).
//   Acá no se duplica lógica de acceptTransfer ni se toca career.club.
// - valueDelta es una FRACCIÓN del valor vigente (0.05 = +5%). Piso absoluto:
//   MARKET_VALUE.MIN; redondeo: MARKET_VALUE.ROUND_TO (ambos de config.js).
//   El motor re-normaliza el valor vía recomputeCareer en la próxima temporada.
// - Este archivo NO importa engine.js (el motor importará events.js en un
//   paso futuro): por eso replica en local el RNG y el clon profundo con el
//   mismo algoritmo y la misma filosofía, sin duplicar lógica de negocio.
// ============================================================================

import { PLAYER_EVENTS } from './playerEvents.js';
import { applyEventTweaks } from './eventTweaks.js';
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

/** options.rng -> options.seed -> default (misma cadena de decisión del motor). */
function resolveRng(options = {}) {
  if (options.rng && typeof options.rng.next === 'function') return options.rng;
  if (options.seed != null) return createSeededRng(options.seed);
  return defaultRng;
}

/** Selección ponderada sobre una lista no vacía de { weight, ... }. */
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

/** Rango de OVR de una opción ya escalado por EVENT_STAKES. */
function stakedRange(choice) {
  const range = Array.isArray(choice && choice.ovrDelta) ? choice.ovrDelta : [0, 0];
  return [Number(range[0]) * EVENT_STAKES, Number(range[1]) * EVENT_STAKES];
}

/**
 * Valores posibles de OVR de una opción (ya escalados y recortados a
 * EVENT_LIMITS). Si el rango cruza el cero, el 0 no está: la opción arriesgada
 * sale bien o mal, nunca "no pasa nada".
 */
function eventOvrValues(choice) {
  const range = stakedRange(choice);
  const min = Math.ceil(Number(range[0]));
  const max = Math.floor(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [0];
  const [lo, hi] = EVENT_LIMITS.ovrDelta;
  const values = [];
  for (let v = min; v <= max; v += 1) {
    if (v === 0 && min < 0 && max > 0) continue;
    values.push(Math.max(lo, Math.min(hi, v)));
  }
  return values;
}

/** Clon profundo barato (misma estrategia que cloneCareer del motor). */
const deepClone = (value) => JSON.parse(JSON.stringify(value));

// -----------------------------------------------------------------------------
// 0.1) Contrato de balance y categorías (lo verifica el smoke test)
// -----------------------------------------------------------------------------

/**
 * Límites razonables de los efectos del catálogo. El catálogo completo debe
 * cumplirlos y el smoke test lo comprueba en cada ejecución.
 */
// Tamaño de las apuestas: cada rango `ovrDelta` del catálogo se multiplica por
// esto (como Copero, donde una decisión puede mover +4 / -3 OVR). Un solo
// número para balancear todos los eventos; los rangos [0, 0] siguen seguros.
export const EVENT_STAKES = 2;

export const EVENT_LIMITS = {
  weight: [1, 50],
  ovrDelta: [-6, 6],         // rango [min, max] por decisión (ya multiplicado)
  valueDelta: [-0.08, 0.08], // fracción del valor de mercado
  minAge: [AGE.START, AGE.RETIRE],
  maxPillsPerChoice: 4,
};

export const PILL_TONES = ['positive', 'negative', 'risky', 'special'];

export const RIVAL_SCOPES = ['same', 'higher', 'same_or_higher', 'any', 'history'];

// Cuántos eventos recientes no se repiten (si el pool queda vacío, se ignora).
export const EVENT_COOLDOWN = 8;

/** Categorías de eventos (labels para la UI). */
export const EVENT_CATEGORIES = {
  mercado: 'Mercado de pases',
  vestuario: 'Vestuario',
  preparacion: 'Preparación',
  barrio: 'Barrio',
  mental: 'Mentalidad',
  retiro: 'Final del camino',
};
// -----------------------------------------------------------------------------
// 1) CATÁLOGO — "Las vueltas de la vida avergas"
// -----------------------------------------------------------------------------
// Contrato de cada evento:
//   id                 — estable (se persiste en saves, NUNCA renombrar).
//   title / icon       — para la UI.
//   category           — clave de EVENT_CATEGORIES.
//   weight             — peso de aparición (positivo; se elige ponderado).
//   minAge / maxAge    — ventana de edad (opcional).
//   requiresRole       — roles válidos del jugador (opcional).
//   requiresPosition   — posiciones ARQ/DEF/MED/DEL (opcional).
//   excludeGK          — excluye arqueros (opcional).
//   requiresGK         — solo arqueros (opcional).
//   minClubReputation  — reputación doméstica mínima 1-5 (opcional).
//   divisions          — divisiones válidas del club actual (opcional).
//   requiresRivalClub  — exige resolver un club rival al rodar (opcional).
//   rivalScope         — 'same' | 'higher' | 'same_or_higher' (default) | 'any'.
//   intro              — texto de escenario (placeholders permitidos).
//   choices[]          — decisiones:
//     id / label / description
//     ovrDelta         — [min, max] de delta OVR (opcional; default [0, 0]).
//     valueDelta       — fracción del valor de mercado (opcional; default 0).
//     isTransfer       — genera metadata de traspaso (opcional).
//     transferReason   — motivo del traspaso (si isTransfer).
//     pills[]          — { label, tone } para la UI (tone: PILL_TONES).
//
// Los pesos son "frecuencia narrativa", no balance de mundo: los efectos
// quedan acotados por EVENT_LIMITS, así ningún evento domina la carrera.
// ============================================================================

// Nombres del grupo para el placeholder {friend} (se sortea uno distinto del
// jugador, ver rollCareerEvent). Solo se usa en eventos con `friends`.
const FRIENDS = [
  'Chino', 'Emi', 'Mati', 'Rui', 'Gonzi', 'Lk', 'Tigre', 'Rulo',
  'Sailor', 'Cru', 'Nahue', 'JJ', 'Luquitas', 'Kike', 'Alan', 'Wini',
];

// Convención de textos de cada decisión:
//   description         — qué pasa si el OVR no cambia (o el único relato).
//   narratives.up/down  — relato cuando el OVR sube / baja (rangos mixtos).
const BASE_EVENTS = [
  // ---- MERCADO DE PASES ----------------------------------------------------
  {
    id: 'oferta_de_madrugada',
    title: 'Audio de las 4 AM',
    icon: '📞',
    category: 'mercado',
    weight: 8,
    requiresRivalClub: true,
    rivalScope: 'higher',
    intro: `Son las cuatro de la mañana y te llega un audio de seis minutos de un tipo que dice ser "manager". Se escucha música, hielo en un vaso y una mujer riéndose de fondo. Habla de {rival}: "Te quieren, hermano, te quieren. Pero no me creas a mí, preguntale a mi primo".`,
    choices: [
      {
        id: 'atender',
        label: 'Contestarle y creerle',
        description: `Quedaron en un bar a las once. Firmaste en una servilleta. Resultó que el tipo sí tenía contactos en {rival}, aunque no hacía falta que te hiciera pagar el café.`,
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'rival_offer',
        pills: [{ label: 'Traspaso a {rival}', tone: 'special' }],
      },
      {
        id: 'colgar',
        label: 'Bloquearlo y volver a dormir',
        description: `Lo bloqueás, apagás el celular y soñás con tu mejor gol. Al otro día en el club nadie sabe de qué hablás, pero igual dormís mejor.`,
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Cordura', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'representante_trucho',
    title: 'Mi representante es mi primo',
    icon: '📇',
    category: 'mercado',
    weight: 7,
    minAge: 19,
    intro: `Tu representante es el primo del kiosquero, tiene un mail @hotmail y firma "Atentamente, Cacho". Dice que hay un club interesado, que es "un secreto a voces, no se lo digas a nadie, ya se lo conté a todos".`,
    choices: [
      {
        id: 'dejarlo',
        label: 'Dejar que cierre el pase',
        description: `Cacho cierra todo por WhatsApp, con tres emojis de aplausos y un audio de "tranquilo, está todo hablado". Nadie lo desmiente.`,
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'fresh_start',
        pills: [{ label: 'Oportunidad de traspaso', tone: 'special' }],
      },
      {
        id: 'despedirlo',
        label: 'Echarlo y negociar vos',
        description: `Llevás las cosas vos: algo menos de lío, algo más de dolor de cabeza.`,
        ovrDelta: [-1, 1],
        valueDelta: 0.03,
        narratives: {
          up: `Negociás vos mismo y sale mucho mejor de lo esperado. Cacho igual te sigue fiando en el kiosco.`,
          down: `Negociar sale tan mal que terminás pidiendo perdón por mail. Cacho se hace el ofendido y encima te sube el precio de los puchos.`,
        },
        pills: [{ label: 'Independiente', tone: 'risky' }],
      },
      {
        id: 'hacer_ruido',
        label: 'Seguirle el juego sin firmar nada',
        description: `Dejás que Cacho haga ruido: el valor sube y vos seguís en lo tuyo, con un ojo en el celular.`,
        ovrDelta: [0, 1],
        valueDelta: 0.04,
        pills: [{ label: 'Valor al alza', tone: 'special' }],
      },
    ],
  },
  {
    id: 'volve_a_casa',
    title: 'Te extrañan en {rival}',
    icon: '🏘️',
    category: 'mercado',
    weight: 6,
    requiresRivalClub: true,
    rivalScope: 'history',
    intro: `Llamó el presidente de {rival}: "Volvé, tu foto sigue colgada en la cantina. Al lado de la de uno que ahora es político, pero la tuya es más linda".`,
    choices: [
      {
        id: 'volver',
        label: 'Volver a {rival}',
        description: `Volvés a la cantina de siempre y el mozo ya te trae el café sin preguntar. Es como no haberte ido nunca, pero con las rodillas más gastadas.`,
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'return_home',
        pills: [{ label: 'Traspaso a {rival}', tone: 'special' }],
      },
      {
        id: 'quedarte',
        label: 'Decirle que no con cariño',
        description: `"Se me pasó el tren, viejo": el presidente se emociona, te cuelga una foto nueva y te manda un lechón. En tu club lo agradecen.`,
        ovrDelta: [0, 1],
        valueDelta: 0.02,
        pills: [{ label: 'Lealtad', tone: 'positive' }],
      },
    ],
  },
  // ---- VESTUARIO ------------------------------------------------------------
  {
    id: 'el_banco_te_conoce',
    title: 'Cuatro fechas sentado',
    icon: '🧱',
    category: 'vestuario',
    weight: 9,
    requiresRole: ['substitute', 'low_rotation', 'third_keeper'],
    intro: `Llevás cuatro fechas sin entrar. Ya sabés cuántos tornillos tiene el banco, el DT te saluda con "¿vos quién eras?" y el utilero te pidió que le cuides las camperas.`,
    choices: [
      {
        id: 'reclamar',
        label: 'Ir a encarar al DT',
        description: `Le dijiste de todo, el DT escuchó y no cambió nada. Seguís en el banco, pero con la conciencia limpia.`,
        ovrDelta: [-1, 1],
        valueDelta: -0.01,
        narratives: {
          up: `El DT se asusta de tu cara colorada y te pone de titular. Metés una asistencia y te sentís el Rey de Roma.`,
          down: `El DT te manda a la tribuna dos fechas con la bolsa de pelotas en la mano. Aprendiste que reclamar sale caro.`,
        },
        pills: [{ label: 'Todo o nada', tone: 'risky' }],
      },
      {
        id: 'entrenar',
        label: 'Matarte en los entrenamientos',
        description: `Doble turno, cero quejas y birra recién los domingos. El DT te dice "seguí así" por décima vez; a la undécima te mete.`,
        ovrDelta: [0, 2],
        pills: [{ label: 'Esfuerzo', tone: 'positive' }],
      },
      {
        id: 'utilero',
        label: 'Hacerte amigo del utilero',
        description: `Con el utilero de tu lado, te enterás de todo lo que piensa el DT de vos. Alguna vez vas a entrar, aunque sea por lesión de otro.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Diplomacia', tone: 'special' }],
      },
    ],
  },
  {
    id: 'tercer_tiempo_infinito',
    title: 'El tercer tiempo que no termina',
    icon: '🍺',
    category: 'vestuario',
    weight: 9,
    minAge: 20,
    intro: `Ganaron, el asado está en llamas y ya van por la cuarta ronda de fernet. Alguien puso cumbia y alguien más puso a Los Redondos. Son las tres de la mañana y mañana hay entrenamiento a las nueve.`,
    choices: [
      {
        id: 'irse_temprano',
        label: 'Irte a las doce con una excusa',
        description: `Dijiste "me duele la rodilla". Todos te creyeron, porque a todos les duele alguna. Llegás al entrenamiento como un reloj.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Cordura', tone: 'positive' }],
      },
      {
        id: 'hasta_el_final',
        label: 'Aguantar hasta que apaguen la luz',
        description: `Te acostaste a las seis, entrenaste a las nueve y nadie te dijo nada. Todo bien, salvo el sabor a asado en la garganta.`,
        ovrDelta: [-3, 2],
        valueDelta: 0.01,
        narratives: {
          up: `Dormiste tres horas, pero estabas tan alegre que metiste dos goles. Hay algo en el fernet que te hace jugar mejor, o te mintieron los de al lado.`,
          down: `Entrenás con los ojos achinados y devolvés el asado atrás del arco. El DT te manda a casa con un "andá, pibe, cuidate". Cuidate vos.`,
        },
        pills: [{ label: 'Resaca', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'la_noche_de_thelma',
    title: 'La noche de Thelma',
    icon: '🪩',
    category: 'vestuario',
    weight: 6,
    minAge: 21,
    intro: `Cena de fin de año del plantel que termina en un boliche. Se suma Thelma, una chica trans de cuarenta que se hizo amiga de todo el mundo con el primer fernet y sabe más de fútbol que tu DT. En la mesa, los más machos ya están callados, con la espalda dura.`,
    choices: [
      {
        id: 'bailar',
        label: 'Bailar toda la noche con ella',
        description: `Bailás cuatro temas y el DJ pone cumbia. Salís del boliche con la camisa abierta y la dignidad intacta.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Thelma te enseña pasos que no conocías y te reís como no te reías desde el secundario. El lunes entrás a la cancha sin un solo nervio.`,
          down: `Bailás tanto que al otro día no sentís los tobillos y te agarrás un esguince de ego. Igual lo volverías a hacer.`,
        },
        pills: [{ label: 'Soltura', tone: 'special' }],
      },
      {
        id: 'consejos',
        label: 'Pedirle opinión sobre tu juego',
        description: `Resulta que Thelma tiene observaciones sobre tu juego que nadie se había animado a decirte. Tiene razón en casi todas.`,
        ovrDelta: [0, 2],
        valueDelta: 0.01,
        pills: [{ label: 'Humildad', tone: 'positive' }],
      },
      {
        id: 'barra',
        label: 'Quedarte en la barra con cara de nada',
        description: `Mirás todo desde la barra con la misma cara que tenés en el banco. Thelma te pasa por al lado y te dice "bajá un cambio, campeón". Te quedás pensando.`,
        ovrDelta: [-1, 0],
        pills: [{ label: 'Duro', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'el_pibe_de_19',
    title: 'El pibe de 19',
    icon: '👶',
    category: 'vestuario',
    weight: 8,
    minAge: 29,
    intro: `Subió un pibe de 19 de la reserva. Corre el doble que vos, no toma fernet, no sabe qué es el aguinaldo y te dijo "señor" en la primera práctica. Delante de todos.`,
    choices: [
      {
        id: 'mostrar',
        label: 'Mostrarle quién manda en la cancha',
        description: `Le hacés un sombrero y te vuelve a ganar la espalda. Empate técnico, empate moral.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Le tirás un caño y se lo recordás en cada descanso. El pibe aprende, el plantel se ríe y vos volvés a sentirte jugador.`,
          down: `Corrés tras él en una contra y te cargás el cuádriceps. El pibe te mira desde lejos y te grita "¡señor, cuídese!".`,
        },
        pills: [{ label: 'Orgullo', tone: 'risky' }],
      },
      {
        id: 'padrino',
        label: 'Hacerte su padrino y enseñarle todo',
        description: `Le enseñás cuándo cortar y cuándo hacerse el boludo. En un mes ya te copia hasta el gesto de sacarte el pelo de la cara.`,
        ovrDelta: [0, 2],
        valueDelta: 0.02,
        pills: [{ label: 'Legado', tone: 'positive' }],
      },
      {
        id: 'hielo',
        label: 'Mandarlo a buscar hielo a cuatro cuadras',
        description: `Volvió con cara de nada y el hielo derretido. El plantel te aplaude; el DT, no.`,
        ovrDelta: [-1, 0],
        pills: [{ label: 'Novatada', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'el_malviajero_oficial',
    title: 'El malviajero oficial',
    icon: '🌀',
    category: 'mental',
    weight: 9,
    friends: FRIENDS,
    intro: `{friend} te manda un audio de seis minutos antes del partido: "Te lo digo como amigo: el DT te tiene entre ojos, el club está en quiebra, el árbitro es primo del rival y yo escuché que van a cambiar el sistema". Vos no habías pensado en nada de eso hasta este momento.`,
    choices: [
      {
        id: 'escuchar',
        label: 'Escuchar los seis minutos enteros',
        description: `Terminás el audio con la cabeza como una lavadora. Salís a la cancha pensando en el árbitro, el DT y el primo del árbitro.`,
        ovrDelta: [-2, 0],
        pills: [{ label: 'Malviaje', tone: 'negative' }],
      },
      {
        id: 'contraatacar',
        label: 'Contraatacar con un malviaje peor',
        description: `Le mandás un audio de ocho minutos. Quedan los dos tan hundidos que el partido empieza con retraso.`,
        ovrDelta: [-2, 3],
        narratives: {
          up: `Le ganás el round con un malviaje tan elaborado que {friend} se queda callado. En la cancha jugás con la tranquilidad del que ganó la discusión.`,
          down: `Terminás malviajándote vos mismo y entrás con el aire de un tipo que acaba de leer su propio testamento.`,
        },
        pills: [{ label: 'Todo o nada', tone: 'risky' }],
      },
      {
        id: 'silenciar',
        label: 'Silenciarlo y tomarte un mate',
        description: `Silenciás el chat, te tomás un mate y salís a la cancha sin culpa. El malviajero queda hablando solo, como siempre.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Paz', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'sala_de_espera_de_traumatologia',
    title: 'Sala de espera de traumatología',
    icon: '🩻',
    category: 'vestuario',
    weight: 8,
    minAge: 28,
    intro: `Hacés un conteo en el vestuario y hay más rodillas operadas que titulares. Cada uno tiene su cicatriz y su doctor de cabecera. Alguien propone armar un grupo de WhatsApp, "Los Crujidos", para compartir rodilleras, kinesiólogos y llantos.`,
    choices: [
      {
        id: 'sumarse',
        label: 'Sumarte y compartir kinesiólogo',
        description: `Entrás al grupo y en dos semanas tenés tres rodilleras, cuatro contactos de traumatólogos y un meme por día. Las rodillas siguen igual, pero la moral está por las nubes.`,
        ovrDelta: [0, 1],
        valueDelta: 0.01,
        pills: [{ label: 'Comunidad', tone: 'positive' }],
      },
      {
        id: 'cicatriz',
        label: 'Mostrar tu cicatriz y ganar el concurso',
        description: `Mostrás la cicatriz y todos aplauden. Hay un ganador, aunque a nadie le importa el premio.`,
        ovrDelta: [-1, 2],
        narratives: {
          up: `Tu cicatriz es la más larga y te ganás el respeto de todos. Jugás con el pecho inflado.`,
          down: `Mostrás la cicatriz con tanto orgullo que en la próxima jugada la rodilla protesta. Se ríen, pero con compasión.`,
        },
        pills: [{ label: 'Orgullo', tone: 'risky' }],
      },
      {
        id: 'negar',
        label: 'Decir que vos no tenés nada',
        description: `Decís que estás perfecto con tanta convicción que lo creés vos mismo. Por ahora.`,
        ovrDelta: [-2, 1],
        narratives: {
          up: `La negación funciona como placebo: jugás liviano y con el cuerpo lleno de confianza.`,
          down: `Al segundo cambio de frente la rodilla te llama por tu nombre completo. Te toca el kinesiólogo de siempre.`,
        },
        pills: [{ label: 'Negación', tone: 'risky' }],
      },
    ],
  },
  // ---- PREPARACIÓN -----------------------------------------------------------
  {
    id: 'lunes_9_de_la_manana',
    title: 'Lunes, 9 de la mañana',
    icon: '🥴',
    category: 'preparacion',
    weight: 9,
    minAge: 21,
    intro: `Domingo de asado, partido de truco y "una sola" que fueron siete. Hoy es lunes, el entrenamiento arranca a las nueve y vos todavía sentís el sabor del vacío en la garganta.`,
    choices: [
      {
        id: 'hacerse_el_fuerte',
        label: 'Entrenar y hacerte el tranquilo',
        description: `Aguantás con cara de póker y sin tomar agua. El DT no sospecha, pero te mira raro cuando preguntás "¿ya terminamos?".`,
        ovrDelta: [-3, 1],
        narratives: {
          up: `Por alguna razón biológica jugás mejor con resaca: pensás menos y corrés más. El DT te lo agradece sin saber por qué.`,
          down: `En el segundo ejercicio te escapás atrás del arco y devolvés el asado. Te gritan "¡vamos, campeón!" mientras te limpiás la boca.`,
        },
        pills: [{ label: 'Resaca', tone: 'risky' }],
      },
      {
        id: 'faltar',
        label: 'Inventar un aductor y faltar',
        description: `Mandás un audio con voz de moribundo. El DT te cree, o finge creerte: lo importante es que dormiste. Tu aductor está perfecto; lo que tenés es hígado.`,
        ovrDelta: [-1, 0],
        pills: [{ label: 'Faltazo', tone: 'negative' }],
      },
      {
        id: 'arroz',
        label: 'Ir con agua con limón y arroz hervido',
        description: `Cara de monje, mate lavado y la mitad del entrenamiento. Pero la hacés bien.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Redención', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_pronostico_de_la_rodilla',
    title: 'El pronóstico de la rodilla',
    icon: '🌧️',
    category: 'preparacion',
    weight: 8,
    minAge: 26,
    intro: `Tu rodilla operada predice la lluvia con más precisión que el Servicio Meteorológico. Hoy sentís el crujido desde la cama y afuera hay un cielo azul. Dentro de dos horas, un tormentón.`,
    choices: [
      {
        id: 'entrenar',
        label: 'Ir igual, con rodillera hasta el pecho',
        description: `Hacés el entrenamiento con la rodilla envuelta como una momia. Llueve a baldazos y terminás empapado, pero entero.`,
        ovrDelta: [-2, 1],
        narratives: {
          up: `La rodillera funciona y la lluvia te inspira: hacés tu mejor práctica del mes bajo el agua.`,
          down: `El campo se encharca y en una frenada la rodilla se queja en idioma de quirófano. Te vas rengo con un "yo ya sabía".`,
        },
        pills: [{ label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'quedarse',
        label: 'Quedarte en casa con la manta y el mate',
        description: `Te quedás en el sillón escuchando la tormenta. Perdés el entrenamiento, pero ganás una siesta de campeonato.`,
        ovrDelta: [-1, 0],
        pills: [{ label: 'Siesta', tone: 'special' }],
      },
      {
        id: 'excusa',
        label: 'Usarla de excusa para todo el mes',
        description: `Desde hoy, cualquier "no puedo" viene con "la rodilla". Resulta increíblemente efectivo y todo el plantel te envidia.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Cara de piedra', tone: 'special' }],
      },
    ],
  },
  {
    id: 'un_clack_que_conoces',
    title: 'Un clack que conocés bien',
    icon: '🦵',
    category: 'preparacion',
    weight: 7,
    minAge: 25,
    intro: `Se escucha un "clack" en medio del partido y, antes de que el árbitro pite, vos ya sabés cuál es. El traumatólogo te mira la resonancia y dice con tono de tango: "Es como la anterior, pero con más onda".`,
    choices: [
      {
        id: 'rehabilitar',
        label: 'Parar y rehabilitar en serio',
        description: `Cinco meses de kinesiología y videollamadas con el kine. Volvés más flaco, más sabio y con otra cicatriz para la colección.`,
        ovrDelta: [-2, 1],
        narratives: {
          up: `La rehabilitación sale de manual y volvés más fuerte que antes. El kinesiólogo pide un aplauso.`,
          down: `Volvés demasiado pronto y demasiado confiado, y la rodilla te manda un recuerdo. Perdés ritmo y paciencia.`,
        },
        pills: [{ label: 'Paciencia', tone: 'positive' }],
      },
      {
        id: 'apretar',
        label: 'Apretar los dientes y jugar',
        description: `Jugás con la rodilla vendada hasta el tobillo. Hay partidos buenos y partidos malos; en todos cojeás.`,
        ovrDelta: [-3, 2],
        valueDelta: -0.02,
        narratives: {
          up: `La adrenalina te anestesia y hacés dos goles. Después, en el vestuario, te desmayás con una sonrisa.`,
          down: `A los quince minutos la rodilla dice basta y te vas en camilla, con la cara de quien sabía lo que iba a pasar.`,
        },
        pills: [{ label: 'Riesgo alto', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'los_analisis_de_sangre',
    title: 'Los análisis de sangre',
    icon: '🩸',
    category: 'preparacion',
    weight: 7,
    minAge: 27,
    intro: `El médico del club mira los resultados y deja la hoja arriba del escritorio con cuidado, como si fuera una prueba judicial. "Con este colesterol hacemos una morcilla. Y con el hígado, paté".`,
    choices: [
      {
        id: 'prometer',
        label: 'Prometerle verduras y cumplir una semana',
        description: `Una semana de ensalada y agua mineral. Al octavo día volvés a la milanesa, pero al menos el médico anotó "intentó".`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Intento', tone: 'positive' }],
      },
      {
        id: 'mentir',
        label: 'Mentirle en la cara',
        description: `Le jurás que tomás una copa de vino por semana. Te mira por encima de los anteojos y te manda a hacerte otro estudio.`,
        ovrDelta: [-2, 1],
        narratives: {
          up: `El médico te cree y te deja ir tranquilo; el cuerpo, por pura costumbre, aguanta otro semestre.`,
          down: `Te caen todos los resultados juntos y te dan una dieta que sólo permite agua y cosas que no existen.`,
        },
        pills: [{ label: 'Mentira piadosa', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'pretemporada_en_gesell',
    title: 'Pretemporada en Gesell, en julio',
    icon: '🥶',
    category: 'preparacion',
    weight: 8,
    intro: `La comisión consiguió una pretemporada barata en Villa Gesell, en pleno invierno: catorce tipos en un departamento de dos ambientes, un solo baño y la heladera con una milanesa vieja como inventario.`,
    choices: [
      {
        id: 'correr',
        label: 'Correr en la playa de madrugada',
        description: `Corrés con viento en contra y una gaviota que te mira mal. Volvés con las piernas de acero y el hígado agradecido.`,
        ovrDelta: [0, 2],
        pills: [{ label: 'Esfuerzo', tone: 'positive' }],
      },
      {
        id: 'casino',
        label: 'Pasarte la pretemporada en el casino',
        description: `Entre el casino y la pizzería, el entrenamiento cayó en el olvido. Volvés sin cambios... ni ganas.`,
        ovrDelta: [-3, 1],
        narratives: {
          up: `La ruleta te trata bien: ganás lo suficiente para pagar la cena de todos y volvés con la moral en alto.`,
          down: `Perdés el viático de la semana en rojo y negro, y volvés sin ritmo, sin plata y con un "yo sabía" del DT.`,
        },
        pills: [{ label: 'Ruleta', tone: 'risky' }],
      },
    ],
  },
  {
    id: 'control_antidoping',
    title: 'Control antidoping sorpresa',
    icon: '🧪',
    category: 'preparacion',
    weight: 6,
    minAge: 22,
    intro: `Llegan dos tipos de la federación con una carpeta y un frasquito. "Control antidoping aleatorio". Vos mirás el calendario, contás los días desde el fin de semana y empezás a rezar en idiomas que no hablás.`,
    choices: [
      {
        id: 'agua',
        label: 'Tomar tres litros de agua y rezar',
        description: `Meás tres veces, tomás más agua y la federación se va con las manos vacías. Todo bien, o eso dice la carpeta.`,
        ovrDelta: [-3, 2],
        narratives: {
          up: `Salís limpio, con la sonrisa y la sangre fría: el DT te mira como a un modelo de conducta. Te sentís intocable.`,
          down: `Positivo. "Era un jarabe para la tos", juraste. La federación no te creyó: suspendido.`,
        },
        suspension: [1, 2],
        outcomes: { up: 'salís limpio', down: 'positivo: suspendido 1-2 temporadas' },
        pills: [{ label: 'A la suerte', tone: 'risky' }],
      },
      {
        id: 'pastillas',
        label: 'Mostrarles todos los frascos que tomás',
        description: `Les mostrás un frasco de ibuprofeno, uno de relajante muscular y uno de "no sé qué es". Te anotan la lista y se van meneando la cabeza.`,
        ovrDelta: [-1, 0],
        pills: [{ label: 'Farmacia', tone: 'negative' }],
      },
    ],
  },
  {
    id: 'apuestas_del_primo',
    title: 'Las apuestas del primo',
    icon: '🎰',
    category: 'vestuario',
    weight: 6,
    minAge: 20,
    intro: `Tu primo descubrió las apuestas deportivas y tiene "un sistema". Te pide que te hagas amonestar antes de los veinte minutos el domingo: "Paga 14 a 1, primo. Nadie se entera".`,
    choices: [
      {
        id: 'apostar',
        label: 'Hacerte amonestar',
        description: `Te hiciste amonestar a los doce minutos.`,
        ovrDelta: [-3, 2],
        valueDelta: 0.02,
        narratives: {
          up: `Amarilla a los doce minutos, tu primo cobró y te regaló unos botines nuevos. Nadie sospechó nada y jugaste suelto el resto del torneo.`,
          down: `La casa de apuestas detectó el movimiento raro y la AFA abrió un sumario. Tu primo borró el WhatsApp; vos no. Suspendido.`,
        },
        suspension: [1, 2],
        outcomes: { up: 'tu primo cobra y nadie se entera', down: 'te descubren: suspendido 1-2 temporadas' },
        pills: [{ label: 'Apuesta', tone: 'risky' }],
      },
      {
        id: 'rechazar',
        label: 'Decirle que no',
        description: `Le dijiste que no. Tu primo te dejó de hablar hasta el asado de fin de año.`,
        ovrDelta: [0, 0],
        pills: [{ label: 'Limpio', tone: 'positive' }],
      },
    ],
  },
  // ---- BARRIO ---------------------------------------------------------------
  {
    id: 'la_ronda_del_fondo',
    title: 'La ronda del fondo',
    icon: '🌿',
    category: 'barrio',
    weight: 7,
    minAge: 21,
    intro: `En el asado de fin de mes, un ex compañero del club te pasa un porro "del bueno, de un amigo que lo cultiva en el balcón". La ronda del fondo se hace sola, como todos los años.`,
    choices: [
      {
        id: 'pitar',
        label: 'Tirarte una pitada',
        description: `Fumás, te reís de todo y volvés a casa a las tres con un hambre de caballo. Al otro día todo sigue igual.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Entrás en una calma total y esa noche te salen todos los pases en el picadito. Hay una cosa que se llama "flow", dicen.`,
          down: `Entrás en un bucle donde no sabés si estás jugando o soñando que jugás. Al otro día la cancha te parece más grande.`,
        },
        pills: [{ label: 'Flow', tone: 'risky' }],
      },
      {
        id: 'birra',
        label: 'Pasarla y tomar una birra',
        description: `Tomás una birra, mirás desde afuera y te reís igual. Nadie te lo recrimina: todos saben que el fútbol necesita un capitán sobrio.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Capitán', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_picadito_de_padres',
    title: 'El picadito de padres',
    icon: '🎂',
    category: 'barrio',
    weight: 7,
    minAge: 26,
    intro: `En el cumpleaños de tu sobrino armaron un picadito padres contra tíos, con arcos hechos con camperas y un árbitro de nueve años. Dos tipos de 45 ya se miran como si fuera la final de un Mundial.`,
    choices: [
      {
        id: 'con_todo',
        label: 'Ir con todo por el honor familiar',
        description: `Ganás, perdés, ni te acordás. Tu cuñado se enojó y tu sobrino te pidió la camiseta.`,
        ovrDelta: [-3, 2],
        narratives: {
          up: `Hacés tres goles y un caño al cuñado. Tu sobrino te mira como a un dios por primera vez en su vida.`,
          down: `En una pelota dividida te cae encima tu cuñado de 110 kilos. Salís rengo del cumpleaños con un pedazo de torta en la mano.`,
        },
        pills: [{ label: 'Riesgo', tone: 'risky' }],
      },
      {
        id: 'arquero',
        label: 'Atajar con la campera de guante',
        description: `Te ponés de arquero con la campera de guante y la remera de capa. Atajás penales a pibes de seis años y volvés a la mesa con la gloria a cuestas.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Seguro', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'velorio_con_camiseta',
    title: 'Velorio con camiseta',
    icon: '⚰️',
    category: 'barrio',
    weight: 5,
    intro: `Murió Don Ramón, el hincha más viejo del club, el que traía el sándwich de milanesa al entretiempo. Pidió ser velado con la camiseta, con los botines puestos y "con un 2 a 0 de regalo". El velorio es el mismo día del partido.`,
    choices: [
      {
        id: 'ir_al_velorio',
        label: 'Ir al velorio con la camiseta puesta',
        description: `Llorás con la camiseta del club en la mano, la familia te abraza y alguien te da un sándwich. Esa noche jugás por Don Ramón, con una fuerza que no sabías que tenías.`,
        ovrDelta: [0, 2],
        pills: [{ label: 'Corazón', tone: 'positive' }],
      },
      {
        id: 'dedicar',
        label: 'Dedicarle el partido y jugar',
        description: `Le dedicás el partido, metés el 2 a 0 y mirás al cielo. Alguien juró haber visto el cajón moverse.`,
        ovrDelta: [0, 2],
        valueDelta: 0.01,
        pills: [{ label: 'Homenaje', tone: 'positive' }],
      },
      {
        id: 'corona',
        label: 'Mandar una corona y entrenar',
        description: `Mandás una corona que decía "Hasta siempre, Don Ramón" y el corrector la imprimió como "Don Ramen". Nadie dijo nada, por respeto y por risa contenida.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Distancia', tone: 'special' }],
      },
    ],
  },
  {
    id: 'o_el_futbol_o_yo',
    title: 'O el fútbol o yo',
    icon: '💍',
    category: 'barrio',
    weight: 7,
    minAge: 24,
    intro: `La patrona te dice a la mañana, con el mate en la mano y los ojos clavados: "O los domingos son míos o los domingos son del fútbol". Sabés lo que tenés que contestar, pero también sabés lo que te espera si contestás.`,
    choices: [
      {
        id: 'futbol',
        label: 'Elegir el fútbol sin dudar',
        description: `Te vas con el bolso al hombro y una pizza de regalo para ablandar. Volvés a las diez y la cena está fría, igual que ella.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Te vas con la frente alta, jugás con una paz mental que nunca tuviste y volvés con flores. Te perdonan, aunque sea por cansancio.`,
          down: `Jugás con la cabeza en casa y volvés a una cena fría y un sillón armado con almohadas. El cuerpo te pasa factura.`,
        },
        pills: [{ label: 'Fútbol', tone: 'risky' }],
      },
      {
        id: 'guiso',
        label: 'Quedarte y cocinar un guiso',
        description: `Cocinás un guiso, mirás una peli subtitulada y a las diez ya estás roncando. Perdiste el partido, pero ganaste una semana de paz.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Paz', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'la_cuenta_de_la_cantina',
    title: 'La cuenta de la cantina',
    icon: '🧾',
    category: 'barrio',
    weight: 6,
    intro: `La cantina del club te pasó una cuenta: $187.000 en choripanes, birras, cafés y "una vuelta para todos". Tu cuenta es más larga que la lista de goleadores de los últimos diez años.`,
    choices: [
      {
        id: 'pagar',
        label: 'Pagar todo con el bono',
        description: `Pagás con el bono y te quedás en cero. Sentís que te sacaron la camiseta, pero el cantinero te regala un café y un abrazo.`,
        ovrDelta: [0, 1],
        valueDelta: -0.03,
        pills: [{ label: 'Honor', tone: 'positive' }],
      },
      {
        id: 'cuotas',
        label: 'Hacerte el boludo y pagar en cuotas',
        description: `Decís que "en estos días lo arreglamos". La cuenta sigue creciendo y el cantinero te mira desde la barra, sin hablar.`,
        ovrDelta: [-2, 1],
        narratives: {
          up: `El cantinero te la perdona a cambio de que juegues el torneo de la cantina. Ganás el torneo y la deuda se esfuma.`,
          down: `El cantinero se lo cuenta a todo el plantel y en cada práctica alguien te mira con cara de acreedor. Se te nota en la cancha.`,
        },
        pills: [{ label: 'Deuda', tone: 'risky' }],
      },
    ],
  },
  // ---- MENTALIDAD -------------------------------------------------------------
  {
    id: 'domingo_a_la_noche',
    title: 'Domingo a la noche',
    icon: '🌑',
    category: 'mental',
    weight: 8,
    minAge: 30,
    intro: `Domingo, 22:30. Mañana arranca la semana, el aguinaldo ya se esfumó y el dólar subió otra vez. En la tele pasan un documental de leones. Te preguntás para qué seguís corriendo detrás de una pelota a los treinta y pico.`,
    choices: [
      {
        id: 'juntarse',
        label: 'Llamar a los pibes y juntarse',
        description: `Llamás a tres amigos, pedís una pizza y a las dos de la mañana ya estaban discutiendo quién fue el mejor jugador de la historia. El bajón se fue sin avisar.`,
        ovrDelta: [0, 2],
        pills: [{ label: 'Amigos', tone: 'positive' }],
      },
      {
        id: 'compu',
        label: 'Quedarte con la compu y la birra',
        description: `Pasás tres horas mirando videos de lo que pudiste ser. La birra se calentó, el sueño se perdió y el lunes parece más largo.`,
        ovrDelta: [-2, 0],
        pills: [{ label: 'Bajón', tone: 'negative' }],
      },
      {
        id: 'goles',
        label: 'Ver tus mejores goles en YouTube',
        description: `Mirás tus tres goles buenos en bucle con la música del Rocky de fondo. El cuarto es de otro y lo salteás. Dormís como un campeón.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Nostalgia', tone: 'special' }],
      },
    ],
  },
  {
    id: 'penal_en_el_noventa',
    title: 'Penal en el 90',
    icon: '⚽',
    category: 'mental',
    weight: 8,
    excludeGK: true,
    intro: `Penal en el último minuto, partido 2 a 2. La hinchada, el DT, el árbitro y hasta el que vende choripanes en la tribuna te miran fijo. Nadie quiere patear. Alguien dice "andá vos, que tenés cara de que la metés".`,
    choices: [
      {
        id: 'patear',
        label: 'Pedirla y patear vos',
        description: `Corrés, pateás y todo se vuelve silencio. Pasa un segundo, o dos, o seis años. Después, alguien grita.`,
        ovrDelta: [-3, 3],
        narratives: {
          up: `La clavás en el ángulo y salís corriendo con la camiseta en la mano. Hay una foto tuya con cara de tipo que acaba de descubrir que está vivo.`,
          down: `La mandás a la tribuna. El que vende choripanes aplaude por piedad. Dormís mal por tres semanas.`,
        },
        pills: [{ label: 'Todo o nada', tone: 'risky' }],
      },
      {
        id: 'dejarsela',
        label: 'Dejársela al pibe',
        description: `El pibe de 19 la agarra con la inocencia del que no sabe lo que pasa. La mete. En el vestuario te palmean por "formar a las nuevas generaciones".`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Mentor', tone: 'positive' }],
      },
    ],
  },
  // ---- ARQUERO (específicos) ---------------------------------------------------
  {
    id: 'guantes_de_segunda',
    title: 'Los guantes del anterior',
    icon: '🧤',
    category: 'preparacion',
    weight: 8,
    requiresGK: true,
    intro: `El utilero te trajo unos guantes "casi nuevos" que eran del arquero anterior. Huelen a alcohol en gel, a derrota y a algo que preferís no identificar. Pero te quedan como un guante, y eso es lo único que importa.`,
    choices: [
      {
        id: 'usarlos',
        label: 'Usarlos y confiar en la magia',
        description: `Los usás y funcionan, sin magia ni nada raro. Por lo menos no se rompieron.`,
        ovrDelta: [-1, 2],
        narratives: {
          up: `Con los guantes de otro, atajás como el otro: dos penales y una mano imposible. Empezás a creer en las reencarnaciones.`,
          down: `Se despega un dedo en medio de un tiro libre y la pelota entra por el agujero. Es el gol más humillante de tu carrera.`,
        },
        pills: [{ label: 'Fe', tone: 'risky' }],
      },
      {
        id: 'comprar',
        label: 'Comprarte unos nuevos con el aguinaldo',
        description: `Gastás medio aguinaldo en guantes nuevos que prometen "agarre turbo". Funcionan, aunque la patrona no se enteró del precio.`,
        ovrDelta: [0, 1],
        valueDelta: -0.01,
        pills: [{ label: 'Inversión', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'el_arquero_se_cree_nueve',
    title: 'El arquero que se cree nueve',
    icon: '🥅',
    category: 'vestuario',
    weight: 6,
    requiresGK: true,
    minAge: 20,
    intro: `Te cansaste de atajar y querés jugar con los pies. En los entrenamientos pedís que te tiren centros para "probar algo". El DT duda entre la gracia y la locura; el preparador de arqueros se agarra la cabeza.`,
    choices: [
      {
        id: 'salir_jugando',
        label: 'Salir jugando con los pies',
        description: `Salís jugando y la pelota va a parar al lateral. El DT dice "bien", sin ganas.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Gambeteás a un delantero, la tocás al medio y la hinchada te aplaude como si fueras Messi. Estás mareado de felicidad.`,
          down: `Querés lucirte, la pelota se te escapa y el rival la manda a guardar. La hinchada te hace un gesto con la mano que no es un saludo.`,
        },
        pills: [{ label: 'Show', tone: 'risky' }],
      },
      {
        id: 'pelotazo',
        label: 'Mandar pelotazo y rezar',
        description: `Pelotazo al aire, rezás y esperás que alguien la agarre. El DT te agradece la sobriedad.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Sobriedad', tone: 'positive' }],
      },
    ],
  },
  {
    id: 'arquero_del_banco_de_atras',
    title: 'Tercer arquero, primera esperanza',
    icon: '🪑',
    category: 'vestuario',
    weight: 8,
    requiresGK: true,
    requiresRole: ['third_keeper', 'substitute'],
    intro: `Sos tan suplente que el utilero te usa de percha en las prácticas. El DT te asegura que "hay proyecto" y que "todo se mueve". Es lo mismo que dijo el año pasado, y el anterior, y el otro.`,
    choices: [
      {
        id: 'pedir_prestamo',
        label: 'Pedir un préstamo',
        description: `Te vas a un club donde el arco es tuyo: rodaje real, viajes en combi y un asado de bienvenida con tu nombre mal escrito en la torta.`,
        ovrDelta: [0, 0],
        isTransfer: true,
        transferReason: 'loan_move',
        pills: [{ label: 'Préstamo', tone: 'special' }],
      },
      {
        id: 'esperar',
        label: 'Quedarte esperando',
        description: `Entrenás al palo y escribís en tu libreta "mi momento llegará". Cuando el titular se lesiona, estás listo. La libreta era una servilleta.`,
        ovrDelta: [0, 2],
        pills: [{ label: 'Paciencia', tone: 'positive' }],
      },
    ],
  },
  // ---- FINAL DEL CAMINO --------------------------------------------------------
  {
    id: 'el_ultimo_baile',
    title: 'El último baile',
    icon: '🌅',
    category: 'retiro',
    weight: 4,
    minAge: 34,
    intro: `Sos el más veterano del plantel. Los pibes te miran como a una enciclopedia y los médicos como a una póliza de seguro con cuotas. La rodilla, el hombro y la espalda te mandan saludos todas las mañanas.`,
    choices: [
      {
        id: 'una_mas',
        label: 'Ir por una temporada más',
        description: `Pretemporada doble, dieta de monje y asado solo los domingos: llegás justo, ni mejor ni peor.`,
        ovrDelta: [-2, 2],
        narratives: {
          up: `Un último año de oro: el físico responde, el DT te adora y volvés a sentirte de veinte. Los pibes te piden consejos y fernet.`,
          down: `El cuerpo cobra la factura de golpe: una rotura, dos kinesiólogos y una tarde en la guardia. Te preguntan "¿vale la pena?" y vos sonreís.`,
        },
        pills: [{ label: 'Último baile', tone: 'risky' }],
      },
      {
        id: 'mentor',
        label: 'Hacerte mentor de los pibes',
        description: `Les pasás lo que sabés y la cancha te extraña un poco menos.`,
        ovrDelta: [-1, 1],
        valueDelta: 0.02,
        narratives: {
          up: `Enseñar te refresca: terminás jugando mejor que ellos.`,
          down: `De tanto ocuparte de los demás te descuidás el cuerpo: bajás un cambio.`,
        },
        pills: [{ label: 'Legado', tone: 'positive' }],
      },
      {
        id: 'retiro',
        label: 'Ir pensando en el retiro',
        description: `Empezás a mirar la rodilla con otros ojos, a imaginar una despedida con asado y un puesto de entrenador de infantiles.`,
        ovrDelta: [-1, 0],
        valueDelta: -0.02,
        pills: [{ label: 'Retiro en vista', tone: 'special' }],
      },
    ],
  },
  {
    id: 'la_camiseta_enmarcada',
    title: 'La camiseta enmarcada',
    icon: '🗿',
    category: 'retiro',
    weight: 3,
    minAge: 30,
    minClubReputation: 3,
    intro: `En el club hablan de vos en pasado por costumbre, pero en el barrio te siguen pidiendo fotos y consejos de tiro libre en la panadería. El presidente quiere hacerte un homenaje con torta, discurso y una placa que pide ser colgada en el baño.`,
    choices: [
      {
        id: 'homenaje',
        label: 'Aceptar el homenaje y llorar en cámara',
        description: `Camiseta enmarcada, aplausos y un discurso del presidente más largo que tu mejor temporada. Lloraste sin vergüenza y las fotos salieron en el diario del barrio.`,
        ovrDelta: [0, 1],
        pills: [{ label: 'Honor', tone: 'positive' }],
      },
      {
        id: 'escuelita',
        label: 'Abrir una escuelita de fútbol',
        description: `Tu nombre en la camiseta de veinte pibes que copian tu golpeo: la leyenda se vuelve institución.`,
        ovrDelta: [-1, 1],
        valueDelta: 0.04,
        narratives: {
          up: `Ver a los pibes te contagia: volvés al entrenamiento con pilas.`,
          down: `Entre clases y entrenos no te alcanza el tiempo: las piernas lo sienten.`,
        },
        pills: [{ label: 'Legado', tone: 'positive' }, { label: 'Valor al alza', tone: 'positive' }],
      },
    ],
  },
  // Eventos personalizados por jugador (playerEvents.js): solo le tocan a
  // quien figura en su campo `players`.
  ...PLAYER_EVENTS,
];

export const CAREER_EVENTS = applyEventTweaks(BASE_EVENTS);

// -----------------------------------------------------------------------------
// 2) HELPERS PUROS — elegibilidad, rivales, textos y aplicación de decisiones
// -----------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Rellena {placeholders} del texto con el diccionario dado (puro). */
function fillTemplate(text, values) {
  return String(text).replace(PLACEHOLDER_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/** División del club actual de la carrera (fallback 3 si el dato falta). */
function currentDivisionOf(career) {
  const nivel = career?.club?.division;
  return divisions.find((d) => d.nivel === nivel) || divisions[divisions.length - 1];
}

/** Nombre legible de la división ("Primera Avergas", etc.). */
const divisionName = (division) => division?.name || 'Liga del Barrio';

/**
 * Clubes rivales candidatos según el alcance pedido:
 *   'same'            → misma división (excluye el club actual).
 *   'higher'          → división superior estricta (el club actual excluido).
 *   'same_or_higher'  → misma división o superior (default).
 *   'any'             → todo el mundo (excluye el club actual).
 *   'history'         → solo clubes donde el jugador ya jugó (excluye el actual).
 */
function rivalCandidates(career, scope) {
  const current = career?.club;
  const division = currentDivisionOf(career);
  const sameDivision = (club) => club.division === division.nivel;
  const higherDivision = (club) => club.division < division.nivel; // 1 es la más alta
  const notCurrent = (club) => !current || club.slug !== current.slug;

  const played = new Set((Array.isArray(career?.clubHistory) ? career.clubHistory : [])
    .map((entry) => entry?.club?.slug).filter(Boolean));

  const level = {
    history: (club) => played.has(club.slug),
    same: sameDivision,
    higher: higherDivision,
    same_or_higher: (club) => sameDivision(club) || higherDivision(club),
    any: () => true,
  }[scope] || ((club) => sameDivision(club) || higherDivision(club));

  return clubs.filter((club) => notCurrent(club) && level(club));
}

/**
 * Elige un club rival con el RNG inyectado, ponderado por cercanía de
 * baseline al jugador (los rivales "creíbles" son los de su nivel). Devuelve
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
 * ¿El evento aplica a esta carrera? Puro: solo lee, nunca muta.
 * Efectivo: no retirado · edad dentro de la ventana · rol permitido ·
 * posición (ARQ/DEF/MED/DEL, excludeGK/requiresGK) · reputación doméstica
 * mínima · división del club permitida. La disponibilidad de un club rival
 * se evalúa aparte en rollCareerEvent (usa RNG).
 */
/**
 * Probabilidades de OVR de una opción, para mostrarlas ANTES de elegir (como
 * Copero: "+4 OVR 65% / -3 OVR 35%"). Son exactas: applyEventChoice sortea un
 * entero uniforme en `ovrDelta` (acotado por EVENT_LIMITS), así que cada valor
 * del rango tiene la misma chance. Devuelve filas { tone, from, to, pct } con
 * tone 'up' | 'same' | 'down', ordenadas de mejor a peor y sumando 100.
 */
export function choiceOdds(choice) {
  // Mismos valores que sortea applyEventChoice (eventOvrValues), así las
  // proporciones son las reales.
  const values = eventOvrValues(choice);
  const groups = [
    { tone: 'up', list: values.filter((v) => v > 0) },
    { tone: 'same', list: values.filter((v) => v === 0) },
    { tone: 'down', list: values.filter((v) => v < 0) },
  ].filter((g) => g.list.length > 0);
  const rows = groups.map((g) => ({
    tone: g.tone,
    from: Math.min(...g.list),
    to: Math.max(...g.list),
    pct: Math.round((g.list.length / values.length) * 100),
  }));
  // El redondeo puede dejar 99/101: se corrige en la fila más probable.
  const diff = 100 - rows.reduce((sum, r) => sum + r.pct, 0);
  if (diff !== 0) rows.reduce((a, b) => (b.pct > a.pct ? b : a)).pct += diff;
  return rows;
}

export function eventEligible(event, career) {
  if (!event || !career || typeof event !== 'object' || typeof career !== 'object') return false;
  if (career.retired) return false;
  if (Array.isArray(event.choices) && event.choices.length === 0) return false;

  // Evento personalizado: solo para los jugadores que nombra.
  if (Array.isArray(event.players) && event.players.length > 0) {
    if (!event.players.includes(career.name)) return false;
  }

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

  // Contexto de carrera: la temporada anterior sin título / más de un club.
  if (event.requiresNoTitle) {
    const history = Array.isArray(career.seasonHistory) ? career.seasonHistory : [];
    const last = history[history.length - 1];
    if (last && Array.isArray(last.trophies) && last.trophies.length > 0) return false;
  }
  if (event.requiresMoved) {
    if (!Array.isArray(career.clubHistory) || career.clubHistory.length < 2) return false;
  }

  return true;
}

/**
 * Todos los eventos elegibles del catálogo (array nuevo, orden del catálogo).
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
    friend: 'un amigo',
  };
}

/**
 * Rueda un evento de carrera para el checkpoint: elige entre los elegibles
 * con pesos, resuelve el club rival (si hace falta) y rellena los textos.
 *
 * Devuelve { event, context, weightTotal } o null si no hay nada que rodar:
 *   event       — evento del catálogo con intro/choices/pills ya interpolados.
 *   context     — { rival } con la ref estable del club rival resuelto (si el
 *                 evento lo requería). Guardar junto a la decisión para que
 *                 applyEventChoice reconstruya exactamente el mismo traspaso.
 *   weightTotal — suma de pesos de los elegibles (info de telemetría/UI).
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

  // Sin repetir lo que acaba de pasar (salvo que no quede nada más).
  const recent = new Set((Array.isArray(career.events) ? career.events : [])
    .filter((entry) => entry && entry.type === 'career_event' && entry.eventId)
    .slice(-EVENT_COOLDOWN)
    .map((entry) => entry.eventId));
  const fresh = pool.filter((event) => !recent.has(event.id));
  const candidates = fresh.length > 0 ? fresh : pool;

  const chosen = weightedPick(candidates, rng);
  const scope = chosen.rivalScope || 'same_or_higher';
  const rival = chosen.requiresRivalClub ? pickRivalClub(career, scope, rng) : null;

  // Eventos con un amigo del grupo en el relato ({friend}): se sortea uno
  // distinto del jugador. Sin `friends` el RNG no se consume.
  const friendPool = Array.isArray(chosen.friends)
    ? chosen.friends.filter((name) => name !== career.name) : [];
  const friend = friendPool.length > 0
    ? friendPool[Math.min(friendPool.length - 1, Math.floor(rng.next() * friendPool.length))]
    : null;

  const values = { ...contextValues(career, rival), ...(friend ? { friend } : {}) };
  const event = {
    ...chosen,
    intro: fillTemplate(chosen.intro, values),
    choices: (chosen.choices || []).map((choice) => ({
      ...choice,
      label: fillTemplate(choice.label, values),
      description: fillTemplate(choice.description, values),
      narratives: choice.narratives ? {
        up: choice.narratives.up ? fillTemplate(choice.narratives.up, values) : undefined,
        down: choice.narratives.down ? fillTemplate(choice.narratives.down, values) : undefined,
      } : undefined,
      pills: (choice.pills || []).map((pill) => ({
        ...pill,
        label: fillTemplate(pill.label, values),
      })),
    })),
  };

  return {
    event,
    context: rival ? { rival: rival.ref } : { rival: null },
    weightTotal: candidates.reduce((acc, item) => acc + item.weight, 0),
  };
}

/**
 * Aplica la decisión elegida y devuelve una NUEVA carrera (no muta ninguna).
 *
 * @param {object} career Carrera vigente (no se muta).
 * @param {object} event  Evento devuelto por rollCareerEvent (o del catálogo).
 * @param {object|string} choice Decisión elegida (objeto, id, o null/inválido).
 * @param {{ seed?: number, rng?: object, context?: { rival?: object } }} [options]
 *   context.rival — ref del club rival guardada junto al evento rodado; si no
 *   viene y el evento lo requiere, se re-resuelve con el RNG/seed dado.
 * @returns {{ career: object, outcome: object }} Carrera nueva + outcome
 *   (ovrDelta, valueDelta, transfer, logEvent, pills). Entrada inválida →
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

  // 1) Delta de OVR: entero muestreado del rango de la decisión, acotado a
  //    EVENT_LIMITS.ovrDelta y al techo/piso absolutos del juego (clampOvr).
  const outcomes = eventOvrValues(sourceChoice);
  const ovrDelta = outcomes[Math.min(outcomes.length - 1, Math.floor(rng.next() * outcomes.length))];
  if (ovrDelta !== 0) {
    clean.ovr = clampOvr(clean.ovr + ovrDelta);
    clean.overallPeak = Math.max(clean.overallPeak ?? clean.ovr, clean.ovr);
    // Estado derivado dependiente del OVR (misma fórmula que el motor usa en
    // recalcCareerState): rol y comparación contra el baseline del club. La
    // reputación, el club y el valor "canónico" los re-normaliza el motor.
    if (clean.club && Number.isFinite(clean.ovr)) {
      const base = clubBaseline(clean.club);
      clean.clubBaseline = base;
      clean.overallVsBaseline = clean.ovr - base + roleMargin(clean.attrs);
      clean.role = roleBucket(clean.ovr - base, clean.position === 'ARQ');
    }
  }
  outcome.ovrDelta = ovrDelta;
  outcome.newOvr = clean.ovr;

  // 1b) Suspensión (doping, apuestas): si la opción sale mal y trae
  //     `suspension: [min, max]`, el jugador no juega esas temporadas (el
  //     motor las cuenta en simulateSeason con career.suspendedSeasons).
  let suspension = 0;
  if (ovrDelta < 0 && Array.isArray(sourceChoice.suspension)) {
    const [lo, hi] = sourceChoice.suspension;
    suspension = lo + Math.floor(rng.next() * (hi - lo + 1));
    clean.suspendedSeasons = (clean.suspendedSeasons || 0) + suspension;
  }
  outcome.suspension = suspension;

  // 2) Delta de valor: fracción del valor vigente, con piso absoluto
  //    MARKET_VALUE.MIN y redondeo MARKET_VALUE.ROUND_TO (config.js). El
  //    motor re-normaliza el valor vía recomputeCareer en la próxima temporada.
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
  //    lógica de acceptTransfer: engine.js procesará esta señal después.
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

  // 4) Log del evento con la convención del motor (season/type/message),
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
    message: `${event?.icon || '📌'} ${event?.title || 'Evento'}: ${sourceChoice.label}`,
    eventId: event?.id || null,
    choiceId: sourceChoice.id,
    ovrDelta,
    valueDelta: valueFraction,
    isTransfer: Boolean(transfer),
  };
  clean.events = [...(clean.events || []), logEvent];
  // Relato según lo que de verdad pasó (sube / baja / igual).
  const narratives = sourceChoice.narratives || {};
  const narrative = fillTemplate(
    (ovrDelta > 0 ? narratives.up : ovrDelta < 0 ? narratives.down : null)
      || sourceChoice.description || '',
    values,
  );
  clean.lastDecision = {
    eventId: event?.id || null,
    narrative,
    eventTitle: event?.title || null,
    choiceId: sourceChoice.id,
    choiceLabel: sourceChoice.label,
    season: clean.season,
    age: clean.age,
    ovrDelta,
    valueDelta: valueFraction,
    transfer,
    suspension,
    pills,
  };
  outcome.logEvent = logEvent;
  outcome.pills = pills;

  return { career: clean, outcome };
}
