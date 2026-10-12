---
name: Averga's Club
description: La carta de FIFA casera del grupo — plantel, alineación, votos e historial.
colors:
  amber: "#e7ad4e"
  ultra-gold: "#f1d270"
  lime: "#b8d85a"
  paper: "#f3f1eb"
  muted: "#a6a89e"
  night: "#12130f"
  panel: "#20221c"
  line: "rgba(243, 241, 235, .16)"
  team-a: "#3e75a5"
  team-b: "#a64e48"
  pitch: "#3d7149"
  stat-high: "#7ed081"
  stat-mid: "#e8c94a"
  stat-low: "#e0a35a"
  stat-bad: "#d64c47"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(3.6rem, 12vw, 7.5rem)"
    fontWeight: 700
    lineHeight: 0.82
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(3.2rem, 8vw, 5.2rem)"
    fontWeight: 700
    lineHeight: 0.82
  title:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(1.9rem, 4.6vw, 2.9rem)"
    fontWeight: 700
    lineHeight: 0.95
  number:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    letterSpacing: "0.03em"
rounded:
  sm: "3px"
  md: "6px"
  sheet: "14px"
  full: "50%"
spacing:
  row: "16px 4px"
  gutter: "16px"
  section: "28px"
components:
  row:
    textColor: "{colors.paper}"
    padding: "{spacing.row}"
  rating:
    textColor: "{colors.amber}"
    typography: "{typography.number}"
  nav-link:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  nav-link-active:
    textColor: "{colors.paper}"
  ovr-badge:
    textColor: "{colors.amber}"
    rounded: "{rounded.full}"
    size: "70px"
  token-team-a:
    backgroundColor: "{colors.team-a}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "54px"
  token-team-b:
    backgroundColor: "{colors.team-b}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "54px"
---

# Design System: Averga's Club

## Overview

**Creative North Star: "La carta de FIFA casera"**

La web se ve como un juego de fútbol, con OVR, cartas, barras de stats, cancha y fichas, pero los jugadores son los del grupo, con sus fotos, apodos, frases y audios. Lo profesional está en la forma y la joda en el contenido. Nunca al revés: la interfaz no hace chistes, los chistes los ponen los jugadores.

Es oscura y cálida, como una cancha de noche bajo reflectores ámbar. Los títulos son enormes y condensados, como el dorsal de una camiseta, y los números se leen como en una tabla de posiciones. La densidad es la de una app que se usa con el pulgar después del partido: filas cómodas, un dato importante por fila y el número a la derecha.

**Dirección:** más capas. Hoy las listas son planas, con filetes. Lo nuevo tiene que sumar profundidad tipo carta: brillos, superposiciones, foto detrás del dato y sombras con dirección. Esa profundidad va **en las piezas que son "cartas"** (ficha del jugador, fichas de la cancha, tarjetas de partido y de carrera), no en todas las filas ni en el chrome de navegación.

**Key Characteristics:**
- Fondo nocturno cálido con un halo ámbar arriba a la derecha.
- Barlow Condensed en mayúsculas para títulos, nombres y números. DM Sans para leer.
- Un solo acento: el ámbar. Dorado solo para Ultra y plateado solo para Randoms.
- Filas con filetes en las listas y profundidad en las cartas.
- El movimiento acompaña lo que pasa: entra, se llena, se desliza. Nunca decora.

## Colors

Una paleta nocturna cálida, con un acento ámbar y colores semánticos de juego que siempre significan lo mismo.

### Primary
- **Ámbar Reflector** (#e7ad4e): el acento único. Se usa en OVR y puntajes, en la sección activa, en el barrido del hover y en el subrayado del nav. Nunca como fondo de un bloque grande.

### Secondary
- **Dorado Ultra** (#f1d270): exclusivo de los jugadores "Randoms Premium Ultra" (borde, estrella y etiqueta).
- **Lima** (#b8d85a): un acento secundario, poco usado.

### Neutral
- **Noche de Cancha** (#12130f): fondo base. El body le suma un degradé cálido y un halo ámbar.
- **Panel** (#20221c): superficies elevadas, como hojas y modales.
- **Papel** (#f3f1eb): texto principal.
- **Gris Tribuna** (#a6a89e): texto secundario, descripciones y links de nav inactivos.
- **Filete** (rgba(243, 241, 235, .16)): divisores y bordes finos.

### Semánticos de juego
- **Equipo A** (#3e75a5 a #173a5c) y **Equipo B** (#a64e48 a #5e2424): fichas de cada equipo en la cancha.
- **Césped** (#3d7149 / #376b43): franjas horizontales de la cancha.
- **Stats:** alto #7ed081, medio #e8c94a, bajo #e0a35a, malo #d64c47. Es el color del rango de la barra.

### Named Rules
**La Regla del Ámbar Único.** El ámbar marca lo que importa en la pantalla: el número, lo activo, lo que se toca. Si todo es ámbar, nada lo es.

**La Regla del Color con Significado.** Dorado = Ultra, plateado = Randoms, azul/rojo = equipos, verde→rojo = rango del stat. Estos colores no se usan como decoración.

## Typography

**Display Font:** Barlow Condensed (con sans-serif de respaldo)
**Body Font:** DM Sans (con sans-serif de respaldo)

**Character:** Barlow Condensed en mayúsculas es la voz de camiseta y planilla de DT. DM Sans se usa para explicar y leer, en minúscula y relajado.

### Hierarchy
- **Display** (700, clamp(3.6rem, 12vw, 7.5rem), 0.82): el nombre del club en Inicio.
- **Headline** (700, clamp(3.2rem, 8vw, 5.2rem), 0.82): el título de cada sección.
- **Title** (700, clamp(1.9rem, 4.6vw, 2.9rem), 0.95): destinos de Inicio y encabezados de bloque, como "Disponibles" y "Lesionados".
- **Number** (700, 1.35–2.3rem, tabular): OVR, puntajes y valores de stats. Siempre con `font-variant-numeric: tabular-nums` y alineados a la derecha.
- **Body** (400, 1rem, 1.5): descripciones, ayudas y frases.
- **Label** (700, 1–1.25rem, 0.03em, mayúsculas): nombres de jugadores en filas, nav y etiquetas de stats.

### Named Rules
**La Regla de la Camiseta.** Todo lo que es identidad (nombres, títulos, números) va en Barlow Condensed y en mayúsculas. Todo lo que es explicación va en DM Sans.

**La Regla del Número a la Derecha.** El puntaje va siempre en la última columna y con una columna fija, aunque falten elementos opcionales como el audio o la flecha de estado.

## Layout

- **Contenedor:** `min(100% - 32px, 1120px)`. En Inicio, 880px. Por debajo de 520px, el margen lateral baja a 12px.
- **Listas:** grilla de 2 o 3 columnas en escritorio (Plantel, Disponibles) y 1 columna por debajo de 800px.
- **Encabezado de sección:** el título y el nav a la izquierda, la cuenta a la derecha. Por debajo de 800px se apilan.
- **Prioridad del celular:** todo se tiene que poder hacer con el pulgar. En las listas que también se arrastran, el gesto vertical es scroll (`touch-action: pan-y`) y el arrastre es lateral.

## Elevation & Depth

Es un sistema híbrido con una dirección hacia más capas. Las listas y el chrome son planos y se separan con filetes. Las **cartas** tienen profundidad real: sombra con dirección y blur suave, brillo arriba (`inset 0 1px rgba(255,255,255,.25)`) y foto o degradé detrás del dato.

### Shadow Vocabulary
- **Ficha** (`0 6px 14px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.25)`): fichas de jugador en la cancha.
- **Cancha** (`0 18px 40px rgba(0,0,0,.35)`): el campo de juego sobre el fondo.
- **Hoja / Modal** (`0 20px 60px rgba(0,0,0,.7)` en escritorio, `0 -14px 40px rgba(0,0,0,.6)` como hoja inferior en celular): la ficha del jugador y la hoja de votar.
- **Velo** (fondo rgba(6,8,6,.72) + `backdrop-filter: blur(6px)`): detrás de los modales.

### Named Rules
**La Regla de la Carta.** La profundidad es para lo que se puede "agarrar": fichas, cartas de jugador, tarjetas de partido. Las filas de una lista no flotan.

## Shapes

- **Círculos:** avatares, iniciales, fichas de la cancha, el badge de OVR e íconos de Inicio.
- **Esquinas casi rectas** (3px): botones de acción y campos.
- **Redondeo suave** (6px): cancha y contenedores grandes. **Hoja** (14px arriba): modal inferior en celular.
- **Filetes de 1px:** separan filas y secciones. No se usan bordes gruesos de color en los laterales.

## Components

### Fila (lista de jugadores / destinos)
- **Carácter:** editorial, como un renglón de tabla de posiciones.
- **Estructura:** avatar circular, nombre (Label), extras opcionales (audio, flecha) en columnas fijas y número a la derecha.
- **Hover / Focus:** barrido ámbar desde la izquierda (`clip-path` de 100% a 0, .45s `cubic-bezier(.16,1,.3,1)`) y el nombre pasa a ámbar.
- **Activa:** el barrido queda fijo.

### Navegación de secciones
- **Estilo:** links de texto Label en Gris Tribuna, sin cajas.
- **Hover:** el texto pasa a Papel y un subrayado ámbar crece al 40% desde la izquierda.
- **Activa:** texto Papel con subrayado ámbar completo (2px).

### Ficha del jugador (carta)
- **Carácter:** es la carta de FIFA del grupo y la pieza central del sistema.
- **Estructura:** foto completa arriba con velo inferior, OVR circular y nombre superpuestos sobre la foto (el encabezado va por encima de la foto con `z-index`), filas de stats con barras finas de 6px y medallero.
- **Entrada:** hoja desde abajo en celular y zoom+fundido en escritorio. Las barras se llenan en cascada (60ms entre filas).

### Ficha en la cancha
- **Estructura:** círculo de 54px (44px en celular) con el OVR en Number, etiqueta de nombre debajo con blur y flecha de estado arriba a la derecha.
- **Centrado:** con la propiedad `translate: -50% -50%`, no con `transform`, porque Motion pisa `transform` inline.
- **Presionado:** `scale: .92` por CSS. No usar `whileTap` de Motion en elementos arrastrables.

### Cancha
- **Estilo:** franjas horizontales de césped, luz central, viñeta en los bordes, marco oscuro de 6px y radio de 6px.
- **Overflow:** visible, para que las fichas del borde no se corten.

## Do's and Don'ts

### Do:
- **Do** poner el puntaje siempre en la última columna, con una columna fija y `tabular-nums`.
- **Do** usar Barlow Condensed en mayúsculas para nombres, títulos y números.
- **Do** darle profundidad tipo carta (brillo, sombra con dirección, foto detrás) a las piezas que representan a un jugador o un partido.
- **Do** respetar `prefers-reduced-motion`: toda animación nueva necesita su versión quieta.
- **Do** dejar que la joda la pongan los jugadores (frases, audios, apodos) y no la interfaz.

### Don't:
- **Don't** poner una etiqueta chica arriba de un título (eyebrow). El título se sostiene solo.
- **Don't** usar tarjetas iguales de ícono + título + texto como estructura de una pantalla.
- **Don't** usar el ámbar como fondo de bloques grandes ni como botón lleno en el nav.
- **Don't** usar dorado, plateado, azul o rojo de equipo como decoración.
- **Don't** usar `whileTap`, `whileHover` ni otras animaciones de `transform` de Motion en elementos que también se arrastran a mano.
- **Don't** hacer que un gesto vertical arrastre algo en una lista scrolleable del celular.
