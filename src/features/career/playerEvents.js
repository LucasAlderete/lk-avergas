// ============================================================================
// EVENTOS PERSONALIZADOS POR JUGADOR — Mi carrera
// ============================================================================
// Mismo formato que CAREER_EVENTS (events.js), con un campo extra:
//   players — nombres del grupo a los que les puede tocar (career.name).
// Salen de las cargadas de cada uno (src/data.js → lore.cargadas). Pesan más
// que los eventos generales para que cada amigo se cruce seguido con lo suyo.
// Para sumar uno: copiá un bloque, cambiá `id` (único), `players` y textos.
// ============================================================================

const PERSONAL_WEIGHT = 24;
const SHARED_WEIGHT = 16; // historias que le tocan a varios: pesan menos para no saturar

export const PLAYER_EVENTS = [
  // ---- CHINO -----------------------------------------------------------------
  {
    id: 'chino_inflando_suenos',
    players: ['Chino'],
    title: 'Inflando sueños',
    icon: '🎈',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Te encargaron la decoración del cumpleaños de la hija del presidente del club. Es el mismo día de un partido clave.',
    choices: [
      { id: 'inflar', label: 'Inflar los globos', description: 'El salón quedó impecable y el presidente te debe una. El partido lo viste por el celular.', ovrDelta: [-2, 0], valueDelta: 0.04, pills: [{ label: 'Emprendedor', tone: 'special' }] },
      { id: 'final', label: 'Jugar el partido', description: 'Los globos los infló tu cuñado. Salieron con forma de pelota desinflada.', ovrDelta: [0, 2], pills: [{ label: 'Profesional', tone: 'positive' }] },
    ],
  },
  {
    id: 'chino_lady',
    players: ['Chino'],
    title: 'Lady Chino',
    icon: '😤',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'Te quejaste de cada falta en el entrenamiento. En el vestuario ya te dicen "Lady Chino" y el técnico lo escuchó.',
    choices: [
      { id: 'trampa', label: 'Buscar la ventaja igual', description: 'Simulás un penal en la práctica. Te lo cobran. Nadie te habla en la cena.', ovrDelta: [-1, 3], pills: [{ label: 'Picardía', tone: 'risky' }] },
      { id: 'callarse', label: 'Jugar callado una semana', description: 'Duraste dos días. Igual el técnico lo valoró.', ovrDelta: [0, 1], pills: [{ label: 'Esfuerzo', tone: 'positive' }] },
    ],
  },

  // ---- EMI -------------------------------------------------------------------
  {
    id: 'emi_superador',
    players: ['Emi'],
    title: 'El superador de anécdotas',
    icon: '🗣️',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'Un compañero cuenta que una vez le hizo un gol a un equipo de Primera. Todos te miran: saben lo que viene.',
    choices: [
      { id: 'superar', label: 'Contar algo más impresionante', description: 'Le hiciste tres goles a la selección de Brasil en un torneo de verano. Nadie te cree, todos se ríen.', ovrDelta: [0, 1], valueDelta: 0.01, pills: [{ label: 'Leyenda', tone: 'special' }] },
      { id: 'escuchar', label: 'Dejarlo pasar', description: 'Te mordiste la lengua toda la charla. Se te notó en la cara.', ovrDelta: [-1, 0], pills: [{ label: 'Autocontrol', tone: 'negative' }] },
    ],
  },
  {
    id: 'emi_hermana',
    players: ['Emi'],
    title: 'Tu hermana y Cru',
    icon: '👀',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Cru pasó a buscar a tu hermana "para llevarla al gimnasio". Lo viste por la ventana justo antes del partido.',
    choices: [
      { id: 'hablar', label: 'Hablarlo de frente', description: 'Charla incómoda en el vestuario. Terminaron abrazados y el equipo jugó suelto.', ovrDelta: [0, 2], outcomes: { up: 'quedan abrazados', same: 'queda medio raro' }, pills: [{ label: 'Vestuario', tone: 'positive' }] },
      { id: 'cancha', label: 'Resolverlo en la cancha', description: 'Pelotazo en la práctica. Ganaste la discusión, perdiste la titularidad.', ovrDelta: [-2, 1], outcomes: { up: 'jugás enfurecido', same: 'queda todo tenso', down: 'perdés la titularidad' }, pills: [{ label: 'Calentura', tone: 'risky' }] },
    ],
  },

  {
    id: 'cru_hermana_emi',
    players: ['Cru'],
    title: 'La hermana de Emi',
    icon: '👀',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Pasaste a buscar a la hermana de Emi "para llevarla al gimnasio". Emi te vio por la ventana justo antes del partido.',
    choices: [
      { id: 'hablar', label: 'Hablarlo de frente', description: 'Charla incómoda en el vestuario. Terminaron abrazados y el equipo jugó suelto.', ovrDelta: [0, 2], outcomes: { up: 'quedan abrazados', same: 'queda medio raro' }, pills: [{ label: 'Vestuario', tone: 'positive' }] },
      { id: 'cancha', label: 'Hacerte el distraído', description: 'Emi te tiró un pelotazo en la práctica. Te lo comiste callado.', ovrDelta: [-2, 1], outcomes: { up: 'lo descargás en la cancha', same: 'queda todo tenso', down: 'pelotazo y perdés el puesto' }, pills: [{ label: 'Calentura', tone: 'risky' }] },
    ],
  },

  // ---- MATI ------------------------------------------------------------------
  {
    id: 'mati_real_madrid',
    players: ['Mati'],
    title: 'Clásico a la misma hora',
    icon: '⚪',
    category: 'mental',
    weight: PERSONAL_WEIGHT,
    intro: 'San Lorenzo juega un partido clave a la misma hora que el Real Madrid. Tus compañeros apuestan cuál vas a mirar.',
    choices: [
      { id: 'madrid', label: 'Mirar al Madrid', description: 'Remontada épica en el Bernabéu. Volviste a entrenar inspirado.', ovrDelta: [0, 2], pills: [{ label: 'Inspiración', tone: 'positive' }] },
      { id: 'ciclon', label: 'Mirar a San Lorenzo', description: 'Empate 0 a 0 sin patear al arco. Por lo menos cumpliste con el club.', ovrDelta: [-1, 1], valueDelta: 0.02, pills: [{ label: 'Lealtad', tone: 'special' }] },
    ],
  },

  // ---- RUI -------------------------------------------------------------------
  {
    id: 'rui_audio',
    players: ['Rui'],
    title: 'El audio de la baja',
    icon: '🎙️',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'Antes de un partido clave mandaste un audio de 4 minutos al grupo del plantel explicando por qué "esto ya está perdido".',
    choices: [
      { id: 'otro', label: 'Mandar otro audio', description: 'Ahora de 7 minutos. El técnico te sacó del grupo y de la convocatoria.', ovrDelta: [-3, 0], pills: [{ label: 'La baja', tone: 'negative' }] },
      { id: 'borrar', label: 'Borrarlo y pedir perdón', description: 'Algunos ya lo habían escuchado. Igual jugaste y te creíste la figura.', ovrDelta: [0, 2], pills: [{ label: 'Redención', tone: 'positive' }] },
    ],
  },
  {
    id: 'rui_aires',
    players: ['Rui'],
    title: 'El aire del vestuario',
    icon: '❄️',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Se rompió el aire acondicionado del vestuario y el club te pide presupuesto. Todos saben a qué te dedicás.',
    choices: [
      { id: 'cobrar', label: 'Cobrar precio "de amigo"', description: 'Facturaste como si fuera el aire del Maracaná. Te pagaron, pero te miran raro.', ovrDelta: [-1, 0], valueDelta: 0.06, pills: [{ label: 'Negocio', tone: 'risky' }] },
      { id: 'gratis', label: 'Arreglarlo gratis', description: 'El plantel entrenó fresco toda la temporada. Te ganaste el vestuario.', ovrDelta: [0, 2], pills: [{ label: 'Ídolo', tone: 'positive' }] },
    ],
  },
  {
    id: 'rui_tapia',
    players: ['Rui'],
    title: 'Llamado de la AFA',
    icon: '📞',
    category: 'mercado',
    weight: PERSONAL_WEIGHT,
    minAge: 24,
    intro: 'Te llama alguien que "trabaja con el Chiqui". Ofrece "acomodar" un partido para que tu equipo zafe en la última fecha.',
    choices: [
      { id: 'aceptar', label: 'Escuchar la propuesta', description: 'Zafaron raspando. Desde ese día te dicen "el Chiqui" en el vestuario.', ovrDelta: [-2, 3], valueDelta: 0.03, pills: [{ label: 'Mafia', tone: 'risky' }] },
      { id: 'cortar', label: 'Cortar el teléfono', description: 'Jugaste limpio, sufriste hasta la última fecha. Dormiste tranquilo.', ovrDelta: [0, 1], pills: [{ label: 'Honestidad', tone: 'positive' }] },
    ],
  },

  // ---- GONZI -----------------------------------------------------------------
  {
    id: 'gonzi_los_de_siempre',
    players: ['Gonzi'],
    title: 'Los de siempre, en lo de todos',
    icon: '🌿',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'A las 3 de la mañana mandaste al grupo del plantel: "venite que estamos con los de siempre en lo de todos". Nadie entendió nada.',
    choices: [
      { id: 'explicar', label: 'Explicar el mensaje', description: 'Lo intentaste tres veces. Quedó como frase oficial del club.', ovrDelta: [-1, 1], valueDelta: 0.02, pills: [{ label: 'Leyenda', tone: 'special' }] },
      { id: 'entrenar', label: 'Hacerse el desentendido y entrenar', description: 'Llegaste "fumado" pero metiste dos golazos en la práctica. El crack es el crack.', ovrDelta: [0, 2], pills: [{ label: 'Talento', tone: 'positive' }] },
    ],
  },

  // ---- LK --------------------------------------------------------------------
  {
    id: 'lk_5000',
    players: ['Lk'],
    title: 'Son $5000',
    icon: '💵',
    category: 'mercado',
    weight: PERSONAL_WEIGHT,
    intro: 'El club te ofrece renovar. Vos pedís lo de siempre: $5000. Ni un peso más, ni uno menos.',
    choices: [
      { id: 'firmar', label: 'Firmar por $5000', description: 'Firmaste en cinco minutos. "Winter is here", dijiste al salir. Nadie entendió.', ovrDelta: [0, 1], valueDelta: 0.02, pills: [{ label: 'Coherencia', tone: 'positive' }] },
      { id: 'subir', label: 'Pedir $5001', description: 'Por primera vez en la historia. El presidente se ofendió.', ovrDelta: [-1, 2], valueDelta: -0.02, pills: [{ label: 'Ambición', tone: 'risky' }] },
    ],
  },

  // ---- TIGRE -----------------------------------------------------------------
  {
    id: 'tigre_puntitos',
    players: ['Tigre'],
    title: 'Los puntitos del Tigre',
    icon: '🐯',
    category: 'mental',
    weight: PERSONAL_WEIGHT,
    intro: 'Salió la actualización del juego y no te subieron los puntitos. Estás sensible y el vestuario lo sabe.',
    choices: [
      { id: 'demostrar', label: 'Demostrarlo en la cancha', description: 'Partidazo. Ahora los puntitos los pedís con razón.', ovrDelta: [0, 3], pills: [{ label: 'Orgullo', tone: 'positive' }] },
      { id: 'raya', label: '"¿Qué le hace una raya más al Tigre?"', description: 'Saliste toda la noche. Al otro día no encontrabas ni la cancha.', ovrDelta: [-3, 1], pills: [{ label: 'Descontrol', tone: 'risky' }] },
    ],
  },

  // ---- RULO ------------------------------------------------------------------
  {
    id: 'rulo_kinesiologia',
    players: ['Rulo'],
    title: 'Socio vitalicio del kinesiólogo',
    icon: '🩼',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'Te volvió a doler "algo". El kinesiólogo ya te guarda una camilla con tu nombre.',
    choices: [
      { id: 'reposo', label: 'Hacer reposo completo', description: 'Volviste sano. Hasta la próxima.', ovrDelta: [0, 1], pills: [{ label: 'Prudencia', tone: 'positive' }] },
      { id: 'infiltrar', label: 'Infiltrarse y jugar', description: 'Jugaste el clásico. "Desde la lesión ya no soy el mismo", dijiste después.', ovrDelta: [-3, 2], pills: [{ label: 'Riesgo', tone: 'risky' }] },
    ],
  },
  {
    id: 'rulo_clase_alta',
    players: ['Rulo'],
    title: 'El pibe de country',
    icon: '🎩',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Te pasaste a un club de barrio y en el vestuario hay termo, mate y pan casero. Vos llegaste con agua saborizada importada.',
    choices: [
      { id: 'adaptarse', label: 'Tomar mate con todos', description: 'Te costó, pero ahora te dicen "el Rulo del barrio".', ovrDelta: [0, 2], pills: [{ label: 'Humildad', tone: 'positive' }] },
      { id: 'bardear', label: 'Bardear un poquito', description: 'Comentario sobre las zapatillas de un compañero. Te las devolvieron en la práctica.', ovrDelta: [-2, 0], pills: [{ label: 'Chetez', tone: 'negative' }] },
    ],
  },

  // ---- SAILOR ----------------------------------------------------------------
  {
    id: 'sailor_para_adelante',
    players: ['Sailor'],
    title: 'Siempre para adelante',
    icon: '🐂',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'El técnico te pide que pases la pelota. Vos sentís que el arco está ahí nomás, aunque haya cinco rivales en el medio.',
    choices: [
      { id: 'encarar', label: 'Encarar igual', description: 'Pasaste a dos, chocaste con el tercero. Tribuna dividida.', ovrDelta: [-2, 3], pills: [{ label: 'Rústico', tone: 'risky' }] },
      { id: 'pasar', label: 'Pasarla por primera vez', description: 'Asistencia. Te quedaste mirando como si hubieras visto un fantasma.', ovrDelta: [0, 2], pills: [{ label: 'Evolución', tone: 'positive' }] },
    ],
  },
  {
    id: 'sailor_malviaje',
    players: ['Sailor'],
    title: 'Malviajo, luego existo',
    icon: '🌀',
    category: 'mental',
    weight: PERSONAL_WEIGHT,
    intro: 'Perdieron un amistoso de pretemporada y ya estás convencido de que el club desciende y te quedás sin carrera.',
    choices: [
      { id: 'malviajar', label: 'Malviajar a pleno', description: 'Le contagiaste el malviaje a medio plantel. Récord de intensidad.', ovrDelta: [-2, 0], pills: [{ label: 'Intensidad', tone: 'negative' }] },
      { id: 'respirar', label: 'Respirar y bajar un cambio', description: 'Duró un día, pero fue un gran día.', ovrDelta: [0, 1], pills: [{ label: 'Calma', tone: 'positive' }] },
    ],
  },

  // ---- CRU -------------------------------------------------------------------
  {
    id: 'cru_remera',
    players: ['Cru'],
    title: 'Sin remera',
    icon: '💪',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'Metiste un gol y ya tenés la remera en la mano. El árbitro tiene la amarilla en la otra.',
    choices: [
      { id: 'sacar', label: 'Sacársela igual', description: 'Amarilla y foto viral en las redes del club. Valió la pena.', ovrDelta: [-1, 0], valueDelta: 0.05, pills: [{ label: 'Fachero', tone: 'special' }] },
      { id: 'dejar', label: 'Festejar con la remera puesta', description: 'Sufriste como nunca. Lo compensaste con doble turno de gimnasio.', ovrDelta: [0, 2], pills: [{ label: 'Disciplina', tone: 'positive' }] },
    ],
  },

  // ---- NAHUE -----------------------------------------------------------------
  {
    id: 'nahue_sin_ganas',
    players: ['Nahue'],
    title: 'Hoy no pinta',
    icon: '🛋️',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'Doble turno de pretemporada. Te despertaste, miraste el techo y te preguntaste para qué.',
    choices: [
      { id: 'ir', label: 'Ir igual', description: 'Llegaste tarde y en ojotas, pero llegaste. El técnico casi llora.', ovrDelta: [0, 2], pills: [{ label: 'Milagro', tone: 'positive' }] },
      { id: 'faltar', label: 'Faltar "por fiebre"', description: 'Maratón de series y algo para fumar. Descansado, eso sí.', ovrDelta: [-3, 0], pills: [{ label: 'Pajero', tone: 'negative' }] },
    ],
  },

  // ---- JJ --------------------------------------------------------------------
  {
    id: 'jj_a_que_hora',
    players: ['JJ'],
    title: '¿A qué hora te vas?',
    icon: '😏',
    category: 'barrio',
    weight: PERSONAL_WEIGHT,
    intro: 'Un compañero casado viaja con la selección. Te pregunta, inocente, si podés pasar a ver que su casa esté bien.',
    choices: [
      { id: 'pasar', label: '"Obvio, quedate tranquilo"', description: 'Pasaste. Varias veces. El vestuario ya no te pasa la pelota.', ovrDelta: [-2, 1], valueDelta: 0.02, pills: [{ label: 'Conquistador', tone: 'risky' }] },
      { id: 'nego', label: 'Decir que no', description: 'Por primera vez en tu vida. Nadie lo puede creer.', ovrDelta: [0, 2], pills: [{ label: 'Lealtad', tone: 'positive' }] },
    ],
  },
  {
    id: 'jj_novias',
    players: ['Chino', 'Emi', 'Rui'],
    title: 'La cena de parejas',
    icon: '🍝',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'El club organiza una cena de parejas. JJ confirmó asistencia "solo, para acompañar a las novias de los muchachos".',
    choices: [
      { id: 'ir', label: 'Ir y vigilar', description: 'Pasaste toda la noche cuidando la mesa. No probaste bocado, pero no pasó nada.', ovrDelta: [-1, 1], pills: [{ label: 'Paranoia', tone: 'risky' }] },
      { id: 'faltar', label: 'Inventar una lesión y no ir', description: 'Nunca sabrás qué pasó en esa cena. JJ dice que "nada".', ovrDelta: [0, 1], pills: [{ label: 'Paz', tone: 'positive' }] },
    ],
  },

  {
    id: 'jj_novias_jj',
    players: ['JJ'],
    title: 'La cena de parejas',
    icon: '🍝',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'El club organiza una cena de parejas. Confirmaste asistencia "solo, para acompañar a las novias de los muchachos". Los muchachos ya se enteraron.',
    choices: [
      { id: 'ir', label: 'Ir igual', description: 'Te sentaron en la punta, lejos de todas. Comiste como un rey igual.', ovrDelta: [-1, 1], pills: [{ label: 'Caradura', tone: 'risky' }] },
      { id: 'faltar', label: 'Bajarte a último momento', description: 'Mandaste un "me surgió algo". Nadie te creyó, pero el vestuario respiró.', ovrDelta: [0, 1], pills: [{ label: 'Paz', tone: 'positive' }] },
    ],
  },

  // ---- LUQUITAS ----------------------------------------------------------------
  {
    id: 'luquitas_equilibrio',
    players: ['Luquitas'],
    title: 'Equilibrio total',
    icon: '⚖️',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'El técnico te ofrece especializarte en una posición. Vos sos parejo en todo y te da miedo perder eso.',
    choices: [
      { id: 'especializar', label: 'Especializarse', description: 'Saliste del molde. Puede salir muy bien o muy mal.', ovrDelta: [-2, 4], pills: [{ label: 'Apuesta', tone: 'risky' }] },
      { id: 'parejo', label: 'Seguir siendo parejo', description: 'Ni muy muy, ni tan tan. Como siempre.', ovrDelta: [0, 1], pills: [{ label: 'Equilibrio', tone: 'positive' }] },
    ],
  },

  // ---- KIKE ------------------------------------------------------------------
  {
    id: 'kike_toque_mas',
    players: ['Kike'],
    title: 'Un toque más',
    icon: '🎯',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'Mano a mano con el arquero. Podés patear ya o hacer tu clásico "toque de más".',
    choices: [
      { id: 'patear', label: 'Patear de una', description: 'Gol de los que no te gustan, pero gol.', ovrDelta: [0, 2], pills: [{ label: 'Efectivo', tone: 'positive' }] },
      { id: 'toque', label: 'Un toque más', description: 'Casi siempre sale. Esta vez el arquero la sacó y te lo recuerdan todo el año.', ovrDelta: [-2, 3], pills: [{ label: 'Estilo', tone: 'risky' }] },
    ],
  },

  // ---- ALAN ------------------------------------------------------------------
  {
    id: 'alan_correte',
    players: ['Alan'],
    title: 'Yo la veo, vos correte',
    icon: '🧠',
    category: 'vestuario',
    weight: PERSONAL_WEIGHT,
    intro: 'Le pediste al capitán que se corra para tirar el pase. El capitán no se corrió.',
    choices: [
      { id: 'insistir', label: 'Insistir en la jugada', description: 'Pase de 40 metros, gol. El capitán ahora te pide permiso.', ovrDelta: [-1, 3], pills: [{ label: 'Visión', tone: 'risky' }] },
      { id: 'ceder', label: 'Dejar que juegue él', description: 'La perdió. Vos miraste para otro lado con cara de "te dije".', ovrDelta: [0, 1], pills: [{ label: 'Paciencia', tone: 'positive' }] },
    ],
  },

  // ---- WINI ------------------------------------------------------------------
  {
    id: 'wini_enganche',
    players: ['Wini'],
    title: 'El rey del enganche',
    icon: '🌪️',
    category: 'preparacion',
    weight: PERSONAL_WEIGHT,
    intro: 'Te quedaste solo frente a tres rivales. Ya pasaste a dos enganchando. Te queda uno... y la línea de fondo.',
    choices: [
      { id: 'enganchar', label: 'Enganchar una vez más', description: 'Pasaste al tercero, al arquero y a la línea. Terminaste afuera de la cancha, solo.', ovrDelta: [-2, 4], pills: [{ label: 'Enganche', tone: 'risky' }] },
      { id: 'tocar', label: 'Tocar al compañero', description: 'Asistencia limpia. Igual diste una vuelta sobre vos mismo antes.', ovrDelta: [0, 2], pills: [{ label: 'Averga oficial', tone: 'positive' }] },
    ],
  },

  // ---- HISTORIAS COMPARTIDAS (varias cargadas, un mismo dilema) --------------
  {
    id: 'chori_la_mona',
    players: ['Emi', 'Rui', 'Alan'],
    title: 'La parrilla de la vereda',
    icon: '🌭',
    category: 'barrio',
    weight: SHARED_WEIGHT,
    intro: 'Hoy el club presenta al plantel y tenés que llegar de punta en blanco. Pero en la vereda de siempre está la parrilla de Chicharra, con la Mona y el Guachín dándole a los choris, y el olorcito que te desarma la dieta.',
    choices: [
      { id: 'ir', label: 'Seguir derecho al club', description: 'Pasaste de largo con el estómago protestando y la vista al frente. Llegaste puntual y serio: el DT lo anotó en su libretita.', ovrDelta: [0, 2], pills: [{ label: 'Disciplina', tone: 'positive' }] },
      { id: 'quedarse', label: 'Parar por un sánguche de bondiola', description: '', ovrDelta: [-3, 1], pills: [{ label: 'Sánguche', tone: 'risky' }] },
    ],
  },
  {
    id: 'jj_la_mujer_del_amigo',
    players: ['JJ'],
    friends: ['Rui', 'Chino', 'Emi'],
    title: 'Cruce peligroso',
    icon: '☕',
    category: 'barrio',
    weight: SHARED_WEIGHT,
    intro: 'Hoy el club presenta la camiseta nueva y el presidente quiere a todo el plantel en la foto. Llegando a la puerta te cruzás con la mujer de {friend}, que viene de comprar el pan y te regala una sonrisa que no estaba en el guion.',
    choices: [
      { id: 'ir', label: 'Saludar de lejos y entrar', description: 'Un "hola, qué tal" bien a distancia, manos en los bolsillos y a la foto. Saliste derechito en el centro y el presidente te felicitó por la compostura.', ovrDelta: [0, 2], pills: [{ label: 'Códigos', tone: 'positive' }] },
      { id: 'cafe', label: 'Mirarla de perfil e invitarla a un café', description: '', ovrDelta: [-3, 1], pills: [{ label: 'Peligro', tone: 'negative' }, { label: 'Riesgo', tone: 'risky' }] },
    ],
  },
  {
    id: 'flores_ricardas',
    players: ['Nahue', 'Gonzi', 'Mati', 'Emi', 'Tigre', 'Rulo', 'Sailor'],
    title: 'Flores de las ricardas',
    icon: '🎮',
    category: 'barrio',
    weight: SHARED_WEIGHT,
    intro: 'Hoy hay cena de homenaje a los socios y el presidente quiere al plantel completo en la mesa principal. Justo cuando salís te llaman unos amigos: "pegamos unas flores de las ricas, de las ricardas, venite".',
    choices: [
      { id: 'ir', label: 'Ir a la cena del club', description: 'Dijiste "otro día" con el corazón partido, agarraste el bolso y fuiste. En la mesa te vieron enfocado y el DT te lo agradeció con un brindis.', ovrDelta: [0, 2], pills: [{ label: 'Responsable', tone: 'positive' }] },
      { id: 'play', label: 'Ir a jugar a la play', description: '', ovrDelta: [-3, 1], pills: [{ label: 'Flores', tone: 'risky' }] },
    ],
  },
];
