// ============================================================================
// AJUSTES DEL CATÁLOGO DE EVENTOS — relatos según resultado + reglas extra
// ============================================================================
// events.js mezcla esto sobre el catálogo base (ver applyEventTweaks).
//
// NARRATIVES: 'eventId.choiceId' → { same, up, down }
//   same → texto cuando el OVR no cambia (reemplaza `description`).
//   up   → texto cuando el OVR sube.
//   down → texto cuando el OVR baja.
// Solo las decisiones con rango mixto (pueden subir Y bajar) los necesitan: el
// relato tiene que coincidir con lo que realmente pasó, no con el azar.
//
// RULES: eventId → campos extra de elegibilidad (los lee eventEligible).
//   excludeGK       — el evento no tiene sentido para un arquero.
//   requiresNoTitle — la última temporada jugada no ganó ningún título.
//   requiresMoved   — el jugador ya pasó por más de un club.
//   divisions       — divisiones válidas del club actual.
//   rivalScope      — 'history' = solo clubes donde ya jugó.
// ============================================================================

export const NARRATIVES = {
  'chino_lady.trampa': {
    same: 'Simulás un penal en la práctica. Te lo cobran y nadie te habla en la cena.',
    up: 'Te sale redondo: el penal es real y el técnico hasta te aplaude la viveza.',
    down: 'El DT te ve la simulación y te baja de la formación una semana. Nadie te defiende.',
  },
  'emi_hermana.cancha': {
    same: 'Pelotazo en la práctica. Queda todo tenso y nadie dice nada.',
    up: 'Ganás la discusión a puro fútbol: jugaste enfurecido y la rompiste.',
    down: 'Pelotazo en la práctica. Ganaste la discusión, perdiste la titularidad.',
  },
  'cru_hermana_emi.cancha': {
    same: 'Emi te tiró un pelotazo en la práctica. Te lo comiste callado y quedó todo tenso.',
    up: 'Te hiciste el distraído y lo descargaste en la cancha: la rompiste.',
    down: 'Emi te tiró un pelotazo en la práctica y te dejó rengo. Perdiste la titularidad.',
  },
  'jj_novias_jj.ir': {
    same: 'Te sentaron en la punta, lejos de todas. Comiste como un rey igual.',
    up: 'Noche redonda: buena comida, buena charla y ningún muchacho te miró feo. Llegás en paz.',
    down: 'Te pasaste toda la cena esquivando miradas. Salís con dolor de cabeza y rendís poco.',
  },
  'mati_real_madrid.ciclon': {
    same: 'Empate 0 a 0 sin patear al arco. Por lo menos cumpliste con el club.',
    up: 'El Ciclón gana sobre la hora y salís a festejar: volvés a entrenar con una sonrisa.',
    down: 'El Ciclón pierde y el Madrid golea: la doble amargura se te nota en la práctica.',
  },
  'rui_tapia.aceptar': {
    same: 'Zafaron raspando. Desde ese día te dicen "el Chiqui" en el vestuario.',
    up: 'Zafaron y todos callan: en el club te creen un genio y jugás con espalda.',
    down: 'Se filtra el chat y el club te abre un sumario. Te dicen "el Chiqui", y no es un cumplido.',
  },
  'gonzi_los_de_siempre.explicar': {
    same: 'Lo intentaste tres veces. Quedó como frase oficial del club.',
    up: 'De tanto insistir terminan entendiendo: el vestuario te adopta y se te nota la confianza.',
    down: 'No entendió nadie y el vestuario te mira como a un alienígena.',
  },
  'lk_5000.subir': {
    same: 'Pediste $5001. Por primera vez en la historia. El presidente se ofendió.',
    up: 'El presidente lo acepta y se te sube la moral: jugás con ganas de merecerlo.',
    down: 'El presidente se ofende y el club te baja el perfil. Jugás con el ego herido.',
  },
  'tigre_puntitos.raya': {
    same: 'Saliste toda la noche. Al otro día, a medias.',
    up: 'Por milagro, la noche te despejó la cabeza: jugás liviano.',
    down: 'Saliste toda la noche y al otro día no encontrabas ni la cancha. Rendís la mitad.',
  },
  'rulo_kinesiologia.infiltrar': {
    same: 'Jugaste el clásico a medias. "Desde la lesión ya no soy el mismo", dijiste.',
    up: 'Jugás el clásico infiltrado y estás bárbaro: el dolor no aparece.',
    down: 'Jugás el clásico infiltrado y a los diez minutos el dolor vuelve. "Desde la lesión ya no soy el mismo", decís.',
  },
  'sailor_para_adelante.encarar': {
    same: 'Encarás y la pelota se pierde. Tribuna dividida.',
    up: 'Pasás a dos, a tres y se la cruzás al arquero: la tribuna explota.',
    down: 'Pasaste a dos, chocaste con el tercero y te la sacan. Contra, gol, y el DT te mira.',
  },
  'jj_a_que_hora.pasar': {
    same: 'Pasaste. Varias veces. El vestuario ya no te pasa la pelota.',
    up: 'El compañero te lo agradece con una invitación a la quinta: llegás relajado.',
    down: 'El vestuario se entera y te hace el vacío. Nadie te pasa la pelota.',
  },
  'jj_novias.ir': {
    same: 'Pasaste toda la noche cuidando la mesa. No probaste bocado, pero no pasó nada.',
    up: 'Una noche tranquila y bien comida: llegás en paz.',
    down: 'La cena se pone espesa y salís con dolor de cabeza. Rendís poco.',
  },
  'luquitas_equilibrio.especializar': {
    same: 'Te especializás: ni mejor ni peor, solo distinto.',
    up: 'Saliste del molde y te sale redondo: ahora sos el mejor en lo tuyo.',
    down: 'Perdiste la versatilidad y todavía no te sale lo nuevo: te sentís incompleto.',
  },
  'kike_toque_mas.toque': {
    same: 'Hacés tu clásico toque de más. La tribuna aguanta la respiración.',
    up: 'El toque sale redondo y el gol es de los que se repiten en las redes.',
    down: 'El arquero la saca y te lo recuerdan todo el año.',
  },
  'alan_correte.insistir': {
    same: 'Insistís otra vez. El capitán se hace el distraído.',
    up: 'Pase de 40 metros, gol. El capitán ahora te pide permiso.',
    down: 'El pase se va a la tribuna y el capitán te hace un gesto que no vas a olvidar.',
  },
  'wini_enganche.enganchar': {
    same: 'Enganchás una vez más. La tribuna se frota las manos.',
    up: 'Pasás al tercero, al arquero y la metés: golazo de los que no se olvidan.',
    down: 'Pasaste al tercero, al arquero y a la línea. Terminaste afuera de la cancha, solo.',
  },
};

NARRATIVES['chori_la_mona.quedarse'] = {
  same: 'Un sánguche de bondiola, un chimichurri de más y media hora de charla con la Mona sobre su temporada en el penal de Olmos, mientras Chicharra da vuelta los choris. Llegás al club con la camiseta manchada y la conciencia tranquila.',
  up: 'La Mona te cuenta sus años en el penal de Olmos con lujo de detalles, Chicharra te invita el sánguche y el Guachín te despide con un consejo: "nunca te pongas nervioso". Llegás al club tranquilo y jugás suelto.',
  down: 'La Mona se explaya con las anécdotas de Olmos, Chicharra te clava un sánguche doble y el Guachín te lo cobra triple: cae como un ladrillo y llegás tarde y pesado. El DT te mira el chimichurri de la remera y no dice nada, que es peor.',
};
NARRATIVES['jj_la_mujer_del_amigo.cafe'] = {
  same: 'Café frío, charla incómoda y una despedida de lejos. Llegás al club con cara de culpa. Nadie sabe nada... todavía.',
  up: 'Ella te frena en seco con una carcajada y un "JJ, por favor". Te hace reír tanto que llegás al club con la autoestima alta, y {friend} nunca se entera.',
  down: 'Ella le cuenta todo a {friend} esa misma noche. En el grupo te sacan de los asados y en el vestuario nadie te pasa la pelota. Jugás con la cabeza en otro lado.',
};
NARRATIVES['flores_ricardas.play'] = {
  same: 'Tres horas de FIFA, risa floja y goles de chilena que en la tele eran hermosos. Ni ganaste ni perdiste: solo te perdiste la tarde.',
  up: 'Entre risas y goles de chilena virtuales se te ocurre una jugada nueva. Al día siguiente la probás en la cancha y sale: "re loco", pero inspirado.',
  down: 'Se hizo de día, no fuiste al club y el DT se enteró por una historia de Instagram. Llegás destruido: no encontrás ni la pelota ni el arco.',
};

export const RULES = {
  // El relato menciona cosas de arquero ausente / goles / pases: sin sentido en el arco.
  kike_toque_mas: { excludeGK: true },
  sailor_para_adelante: { excludeGK: true },
  wini_enganche: { excludeGK: true },
  alan_correte: { excludeGK: true },
  cru_remera: { excludeGK: true },
  emi_superador: { excludeGK: true },
  luquitas_equilibrio: { excludeGK: true },
  // Dependen de que la temporada anterior no haya terminado en título.
  sailor_malviaje: { requiresNoTitle: true },
  rui_tapia: { requiresNoTitle: true },
  // "Te pasaste a un club de barrio": solo si cambió de club y está en Segunda.
  rulo_clase_alta: { requiresMoved: true, divisions: [2] },
};

/** Devuelve un catálogo nuevo con relatos por resultado y reglas extra. */
// -----------------------------------------------------------------------------
// DOS CAMINOS: cada evento ofrece exactamente 2 opciones.
//   - La arriesgada: su OVR sale bien o mal (rango que cruza el cero; el motor
//     nunca sortea el 0 en ese caso), con relato para cada lado.
//   - La segura: no pasa nada (OVR [0, 0], sin cambio de valor).
// Los traspasos (isTransfer) son su propio camino: van con la segura al lado.
// Si el evento ya trae una opción arriesgada con relatos se detecta sola; si no
// (o hay que elegir), TWO_WAY dice cuál es cuál y completa rango y relatos.
// -----------------------------------------------------------------------------

export const TWO_WAY = {
  velorio_con_camiseta: {
    risky: 'dedicar', safe: 'ir_al_velorio', ovrDelta: [-1, 2],
    up: 'Le dedicás el partido, metés el 2 a 0 y mirás al cielo. Alguien juró haber visto el cajón moverse.',
    down: 'Le dedicaste el partido y te pesó: erraste uno abajo del arco y te fuiste mirando el piso.',
    safeText: 'Llorás con la camiseta puesta, la familia te abraza y alguien te da un sándwich. Te perdiste el partido, pero Don Ramón te hubiera entendido.',
  },
  domingo_a_la_noche: {
    risky: 'juntarse', safe: 'goles', ovrDelta: [-1, 2],
    up: 'Llamás a tres amigos, pedís una pizza y a las dos de la mañana ya discutían quién fue el mejor de la historia. El bajón se fue sin avisar.',
    down: 'La juntada terminó a las seis de la mañana y el lunes llegaste al entrenamiento sin voz y sin piernas.',
  },
  chino_inflando_suenos: {
    risky: 'final', safe: 'inflar', ovrDelta: [-1, 2],
    up: 'Jugaste el partido y la rompiste. Los globos los infló tu cuñado: salieron con forma de pelota desinflada.',
    down: 'Jugaste con la cabeza en los globos y no tocaste una. Encima tu cuñado los infló con forma de pelota desinflada.',
  },
  emi_superador: {
    risky: 'superar', safe: 'escuchar', ovrDelta: [-1, 2],
    up: 'Les contaste que le hiciste tres goles a Brasil. Nadie te cree, pero te agrandaste y jugaste como si fuera cierto.',
    down: 'Les contaste que le hiciste tres goles a Brasil. Todos se ríen y el apodo te dura toda la temporada.',
  },
  rui_audio: {
    risky: 'otro', safe: 'borrar', ovrDelta: [-2, 1],
    up: 'Mandaste otro de 7 minutos. El plantel salió a la cancha a desmentirte y ganaron por goleada.',
    down: 'Ahora de 7 minutos. El técnico te sacó del grupo y de la convocatoria.',
  },
  rui_aires: {
    risky: 'cobrar', safe: 'gratis', ovrDelta: [-1, 1],
    up: 'Facturaste como el aire del Maracaná y con la plata te compraste unos botines que te quedan pintados.',
    down: 'Facturaste como el aire del Maracaná. Te pagaron, pero en el vestuario nadie te pasa la pelota.',
    safeText: 'Lo arreglaste gratis. El plantel entrena fresco y vos te guardás un favor para cobrar algún día.',
  },
  rulo_clase_alta: {
    risky: 'bardear', safe: 'adaptarse', ovrDelta: [-2, 1],
    up: 'Comentario sobre las zapatillas de un compañero. Le cayó en gracia al vestuario y ahora te respetan.',
    down: 'Comentario sobre las zapatillas de un compañero. Te las devolvieron en la práctica.',
  },
  sailor_malviaje: {
    risky: 'malviajar', safe: 'respirar', ovrDelta: [-2, 1],
    up: 'Malviajaste tan fuerte que el plantel se asustó y entrenó el doble. Ganaron el partido siguiente.',
    down: 'Le contagiaste el malviaje a medio plantel. Récord de intensidad, cero puntos.',
  },
  cru_remera: {
    risky: 'sacar', safe: 'dejar', ovrDelta: [-1, 2],
    up: 'Amarilla y foto viral en las redes del club. Valió la pena: te subió la confianza.',
    down: 'Amarilla, la quinta del torneo y una fecha afuera. La foto viral no la juega.',
    safeText: 'Festejaste con la remera puesta. Sufriste como nunca, pero el árbitro guardó la tarjeta.',
  },
  nahue_sin_ganas: {
    risky: 'faltar', safe: 'ir', ovrDelta: [-2, 1],
    up: 'Maratón de series y algo para fumar. Volviste descansado como nunca y la rompiste.',
    down: 'Maratón de series y algo para fumar. El técnico se dio cuenta de la fiebre trucha y te mandó al banco.',
  },
};

const spansZero = (choice) => Array.isArray(choice.ovrDelta) && choice.ovrDelta[0] < 0 && choice.ovrDelta[1] > 0;
const width = (choice) => (Array.isArray(choice.ovrDelta) ? choice.ovrDelta[1] - choice.ovrDelta[0] : 0);

/** Deja el evento con 2 opciones: arriesgada (bien/mal) y segura (nada). */
function twoWay(event) {
  const choices = event.choices || [];
  const plan = TWO_WAY[event.id];
  const byId = (id) => choices.find((c) => c.id === id) || null;
  let risky = plan ? byId(plan.risky) : null;
  if (!risky) {
    risky = choices.find((c) => c.isTransfer)
      || choices.filter((c) => spansZero(c) && c.narratives && c.narratives.up && c.narratives.down)
        .sort((a, b) => width(b) - width(a) || b.ovrDelta[1] - a.ovrDelta[1])[0]
      || null;
  }
  if (!risky) return event; // sin plan ni arriesgada: se deja como está (lo marca el smoke)
  let safe = plan ? byId(plan.safe) : null;
  if (!safe) {
    const rest = choices.filter((c) => c !== risky && !c.isTransfer);
    safe = rest.filter((c) => c.ovrDelta && c.ovrDelta[0] >= 0).sort((a, b) => b.ovrDelta[1] - a.ovrDelta[1])[0] || rest[0] || null;
  }
  const riskyOut = risky.isTransfer ? risky : {
    ...risky,
    ...(plan && plan.ovrDelta ? { ovrDelta: plan.ovrDelta } : {}),
    ...(plan && plan.up ? { narratives: { up: plan.up, down: plan.down } } : {}),
  };
  const safeOut = safe ? (() => {
    const { valueDelta, narratives, ...rest } = safe;
    return { ...rest, ovrDelta: [0, 0], ...(plan && plan.safeText ? { description: plan.safeText } : {}) };
  })() : null;
  // Se respeta el orden original de las opciones.
  const kept = choices.filter((c) => c === risky || c === safe)
    .map((c) => (c === risky ? riskyOut : safeOut));
  return { ...event, choices: kept };
}

export function applyEventTweaks(events) {
  return events.map((event) => twoWay(applyTweaks(event)));
}

function applyTweaks(event) {
  const rules = RULES[event.id] || {};
  return {
    ...event,
    ...rules,
    choices: (event.choices || []).map((choice) => {
      const tweak = NARRATIVES[`${event.id}.${choice.id}`];
      if (!tweak) return choice;
      return {
        ...choice,
        description: tweak.same || choice.description,
        narratives: { up: tweak.up, down: tweak.down },
      };
    }),
  };
}
