# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un grupo cerrado de amigos que juega al fútbol (Fútbol 5, 6 o 7) y se llama Averga's Club, más un admin del grupo.

- **Jugadores:** entran casi siempre desde el celular, en general desde el link del grupo, en la cancha o justo después del partido. Arman equipos, votan a sus compañeros, miran resultados y quién fue el MVP, y se cargan entre ellos.
- **Admin:** abre y cierra partidos, carga resultados y ve quién votó a quién (pantalla Votos, solo admin).

## Product Purpose

Es el lugar del grupo para todo lo que rodea al partido: el plantel con un OVR de cada jugador que se mueve con los votos del grupo, la alineación que se arma arrastrando jugadores a la cancha, el historial de partidos con MVP y "peor", y un modo carrera para jugar con tu propio jugador.

Funciona bien si el grupo la abre solo antes y después de cada partido, y si el OVR y el historial dan tema de conversación.

## Positioning

No es una app genérica para armar equipos: es del grupo. Los jugadores son ellos, con sus fotos, apodos, frases y audios propios, y el puntaje lo deciden los mismos compañeros votando partido a partido.

## Operating Context

- Se usa sobre todo en el celular, con una mano, a veces en la cancha.
- Ritual del partido: el admin abre el partido, se arman los equipos en Alineación, se juega, se carga el resultado y cada uno reparte 5 puntos entre quienes jugaron.
- Hay que iniciar sesión con Google para votar. Mirar no requiere sesión.

## Capabilities and Constraints

- **Pantallas:** Inicio, Mi carrera (detrás de una feature flag), Plantel, Alineación, Historial y Votos (solo admin).
- **Alineación:** arrastrar y soltar en la cancha, doble toque, menú con toque largo, marcar lesionados, y modalidades de Fútbol 5, 6 o 7.
- **Grupos de jugadores:** plantel real ("Avergas"), "Randoms Premium Ultra" y "Randoms" (invitados).
- **Votos:** 5 puntos por partido para cada votante, con un tope por jugador.
- **Stack existente:** React + Vite en el frontend, y Express + MongoDB en el backend (`server/`). Deploy por GitHub Actions al pushear a `main`.
- **Modo carrera:** usa un universo cerrado de 296 clubes reales (ver `docs/README-CAREER-CLUBS.md`). No ampliar su alcance sin avisar.

## Brand Commitments

- El nombre es **Averga's Club**.
- **Tono:** joda entre amigos. Humor interno, apodos, cargadas y frases propias de cada jugador. Los textos de la interfaz van en castellano rioplatense (voseo: "Tocá", "Elegí", "Arrastrá").
- Las frases y audios de cada jugador son parte de la identidad. No se reescriben ni se reemplazan sin preguntar.

## Evidence on Hand

- **Fotos de jugadores:** mapeadas en `src/playerPhotos.js`.
- **Audios de jugadores:** mapeados en `src/playerAudio.js`.
- **Escudos de clubes reales:** en `public/career/clubs/`, con su licencia documentada en `docs/LOGO-LICENSE-MANIFEST.md`.
- **Datos reales del grupo:** jugadores, OVR y frases en `src/data.js`, y los partidos en el backend.
- No hay testimonios, métricas de uso ni prensa. No inventarlos.

## Product Principles

1. **Primero el celular y el pulgar:** cada acción se tiene que poder hacer con una mano, y el scroll nunca se tiene que confundir con el arrastre.
2. **El grupo es el contenido:** fotos, apodos, frases y audios mandan sobre la decoración genérica.
3. **El OVR es sagrado:** el número que se ve tiene que ser el mismo en todas las pantallas y explicable a partir de los votos.
4. **Joda, no ruido:** el humor está en el contenido del grupo, no en efectos que estorben el uso rápido después del partido.
