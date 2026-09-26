# Catálogo de clubes reales — modo carrera (fase 1)

El **modo carrera** (`career2` / `CareerScreen`) usa un mundo de clubes
reales. El **modo Copero** no se toca: vive en su propio sistema y no
comparte ninguno de estos datos.

## 0. Universo cerrado (296 clubes)

**No modificar el alcance sin avisar.** El Career World contiene EXCLUSIVAMENTE:

| País | Competiciones | Clubes |
| --- | --- | --- |
| Argentina | Primera División (30) · Primera Nacional (36) | 66 |
| España | LaLiga (20) · Segunda División (22) | 42 |
| Francia | Ligue 1 (18) · Ligue 2 (18) | 36 |
| Inglaterra | Premier League (20) · Championship (24) | 44 |
| Italia | Serie A (20) · Serie B (20) | 40 |
| Brasil | Série A (20) | 20 |
| Estados Unidos | MLS (30) | 30 |
| México | Liga MX (18) | 18 |
| **Total** | **13 competiciones · 8 países** | **296** |

Rosters de las temporadas 2025-26 / 2026 (verificados en Wikipedia). Sin
Alemania, Países Bajos, Portugal, Bélgica, Uruguay ni otras ligas. El smoke
`scripts/smoke-career-clubs.mjs` valida el universo exacto (país por país y
competición por competición).

## 1. Estructura

```
src/data/careerWorld.js            ADAPTER: API que consume el engine (contrato estable)
src/data/careerWorld/clubs.js      DATOS CRUDOS curados (RAW: 1 línea por club)
src/data/careerWorld/countries.js  Países + ligas reales + notas de curación
scripts/smoke-career-clubs.mjs     Validador del catálogo + integración con el engine
scripts/smoke-career-all-clubs.mjs Flujo de carrera completo por CADA uno de los 296 clubes
                                   (debut → temporadas → evento → decisión → mercado → retiro
                                    + visual/crest por club + round-trip de persistencia)
scripts/smoke-career-ui.mjs        Render REAL (SSR) de la UI en cada fase + reglas de CSS
scripts/ssr/career-ui-entry.jsx    Entry SSR que usa el smoke de UI (lo compila él mismo)
scripts/smoke-all.mjs              Runner de todos los smokes (`npm run smoke`)
```

Separación de responsabilidades (nada se mezcla):

| Capa | Archivo | Contenido |
| --- | --- | --- |
| Datos de origen | `careerWorld/clubs.js` | hechos públicos + valores curados |
| Datos de ligas/países | `careerWorld/countries.js` | país, bandera, liga real, nivel real |
| Valores derivados | `careerWorld.js` | `slug`, `key`, `division`, `crest`, alias |
| API para el engine | `careerWorld.js` | `allClubs`, `clubsByDivision`, `findClub`, ... |

El engine (`features/career/engine.js`), `events.js`, `flow.js`, `persistence.js`
y la UI **no saben de dónde vienen los datos**: siguen consumiendo la misma API
que consumían con el mundo Avergas.

## 2. Modelo de club

```js
{
  id, slug, key, name, short, shortName, country, countryCode, countryFlag, city,
  league, leagueId, leagueLevel, division, ovr, overall, baseline,
  domesticReputation, continentalReputation, internationalReputation,
  colors: { primary, secondary }, crest: { type, shape, primary, secondary, symbol },
  barrio, stadium, founded, refTier
}
```

- `slug` = `id` (clave estable de los saves y de las ofertas).
- `key` = `"<division>/<slug>"` (fallback de resolución en saves viejos).
- `short` / `shortName` y `ovr` / `overall`: alias del mismo dato. El engine
  consume `short` y `ovr`; el modelo documentado usa `shortName` y `overall`.
- `baseline` = OVR del plantel (lo que el engine espera para calcular el rol).
- `barrio`: compatibilidad con el engine/eventos, que lo usan como "zona local".
  En el mundo real **es la ciudad** del club.
- `refTier` (1-5): tier curado de referencia, **informativo**; no lo usa el engine.

## 3. D1 / D2: división interna ≠ división real (sin Tercera División)

Son dos conceptos distintos y **no se mezclan**:

- **`league` / `leagueLevel`**: la competición REAL del club y su nivel
  deportivo real (ej. `Premier League` = 1, `EFL Championship` = 2).
- **`division` (1/2)**: el nivel **INTERNO** del career engine. No representa
  una liga universal ficticia: es un nivel relativo de club/carrera que el
  engine ya usaba (`startingDivisionsForOvr`, `clubsByDivision`,
  `clampTargetDivision`, `divisionForTier`).

| División interna | Significado de carrera | OVR |
| --- | --- | --- |
| `D1` | club de primera línea / primera división fuerte (Primera) | ≥ 76 |
| `D2` | club profesional de nivel medio y clubes chicos (Segunda) | < 76 |

**La jerarquía jugable del modo carrera tiene DOS categorías: Primera y
Segunda. La Tercera División NO existe como categoría del career world** (ni
como banda de OVR, ni como destino de oferta, ni como fallback): todo club por
debajo de la banda de Primera es `D2`. La jerarquía conceptual por país es:

```
Argentina: Primera División → Primera Nacional
España: LaLiga → Segunda · Francia: Ligue 1 → Ligue 2
Inglaterra: Premier League → Championship · Italia: Serie A → Serie B
Brasil (Série A) · MLS · Liga MX: su única categoría real, dentro de D1/D2
```

La división interna **se DERIVA del OVR** por esas bandas globales
(`DIVISION_THRESHOLDS` en `careerWorld.js`): un club del Championship con OVR
alto puede ser `D2` interno, y un club de Primera División con OVR bajo también
puede ser `D2`. Eso mantiene la jerarquía del mercado de pases coherente con el
catálogo, sin depender del nombre de la liga real.

## 3b. Progresión de carrera: debut y Segunda → Primera

- **Debut aleatorio Primera/Segunda.** `createCareer()` nace con `club = null`;
  `generateYouthOffers()` (engine) elige con el RNG del motor UNA división entre
  las elegibles (`startingDivisionsForOvr`): `[1, 2]` si el OVR del jugador
  llega a 76, `[2]` si no. El sorteo es uniforme y determinista por seed (mismo
  seed → misma división; distintos seeds → puede cambiar), y las 3 ofertas
  salen de ESA división, con clubes SIEMPRE argentinos y peso cuadrático hacia
  los clubes más modestos del pool. Nunca se inventa una categoría inferior
  para OVR bajo: el jugador arranca en Segunda.
- **Segunda → Primera temprano.** En `generateTransferOffers()` el nivel natural
  de la oferta sale del tier del jugador (`divisionForTier`), pero además se tira
  una vez por oferta `firstDivisionOfferChance`
  (`FIRST_DIVISION_PUSH` en `config.js`): la probabilidad de que el mercado de
  Primera aparezca depende del OVR sobre `firstDivisionMinOvr` (74) y del
  rendimiento del jugador (`overallVsBaseline` + rol ganado), **no** de las
  temporadas que lleva en el club. Con OVR y rendimiento buenos Primera puede
  aparecer en la 1ª ventana; con rendimiento flojo la chance cae casi a cero; con
  OVR por debajo del umbral la chance es 0 y la regla vigente se mantiene.
- **Primera → Primera.** Un jugador ya en Primera sigue recibiendo ofertas de
  Primera (tier alto o chance de Primera en la misma jugada), además de los
  movimientos laterales/hacia abajo permitidos por `OFFER_RULES`.

## 4. OVR: cómo se asigna

**Decisión de la fase 1: OVR CURADO POR TIERS, no una fórmula estadística.**
Motivo: no tenemos una fuente objetiva y citable (puntos de liga, coeficientes
UEFA/CONMEBOL, valor de plantel) cargada en el repo, y una fórmula "seria"
inventada con datos que no tenemos sería igual de arbitraria pero más difícil de
auditar. Se optó por lo explícito y reproducible: **un tier por banda de OVR**.

| Tier (`refTier`) | Rango de OVR | Qué representa |
| --- | --- | --- |
| 5 | 79-88 | élite mundial (City, Liverpool, Flamengo, Boca/River) |
| 4 | 73-78 | club fuerte de primera (Vélez, Racing, Estudiantes, Grêmio) |
| 3 | 68-72 | club medio de primera / ascendente (Lanús, Huracán, Bragantino) |
| 2 | 61-67 | club chico de primera o de segunda fuerte (Almagro, Temperley) |
| 1 | 56-60 | club de división inferior / regional (Nueva Chicago, Acassuso) |

Reglas aplicadas a la curación:

1. El OVR es **entero** y vive dentro de `OVR.MIN`..`OVR.MAX` del juego (35-95).
2. La jerarquía relativa entre países se mantiene: un grande de liga top no
   queda por debajo de un club medio de una liga menor sin motivo de peso.
3. Un mismo club tiene **un solo** OVR (`ovr` = `overall` = `baseline`), lo que
   garantiza que el rol del jugador (`roleBucket(ovr - baseline)`) y el valor de
   mercado se comporten igual que con el mundo anterior.
4. El cálculo es **reproducible**: el OVR es un dato del RAW, y la división
   interna se deriva de él de forma determinista.

## 5. Reputaciones (0-5)

Las tres reputaciones que el engine ya consumía se mantienen, con criterio propio:

- **`domesticReputation` (`k`)**: peso del club **dentro de su país**.
  `5` = máximo histórico/actual del país; `4` = grande; `3` = importante;
  `2` = relevante en su liga; `1` = conocido; `0` = club chico/anónimo nacional.
- **`continentalReputation` (`i`)**: presencia real en su confederación
  (CONMEBOL/UEFA): `5` = candidato continental permanente; `0` = sin presencia
  continental relevante.
- **`internationalReputation`**: reconocimiento fuera de su continente.
  **En esta fase es un proxy de la continental** (`international = continental`,
  derivado en el adapter) para no inventar un dato que todavía no curamos
  aparte. La regla queda escrita como invariante (`international <= continental`)
  y validada por el smoke test.

`domesticReputation` es la que el engine usa para valor de mercado y trofeos, así
que la escala es la que ya estaba en uso: **no se cambió la semántica**, solo los
valores (ahora propios, club por club).

## 6. Colores y escudos procedurales

- `colors` = par `{ primary, secondary }` con los colores **tradicionalmente
  asociados** al club. No se reproduce ningún logo oficial.
- `crest` es un **descriptor de datos** que la UI convierte en un escudo CSS:

```js
crest: { type: 'procedural', shape: 'shield', primary: '#003b95', secondary: '#d4af37', symbol: 'BOC' }
```

- `symbol` = sigla del club (3 letras) del catálogo.
- No hay imágenes externas, logos oficiales ni dependencias nuevas.
- La UI (`careerFormat.js → clubVisual()` / `clubCountryLabel()`) es el único
  punto que traduce club → escudo/país, así que cualquier cambio de estilo se
  hace ahí una sola vez. Para referencias livianas (ofertas, historial) resuelve
  el club canónico por `key` o `slug`, sin inventar datos si no está.

## 7. Fuentes y qué es curado por nosotros

| Dato | Origen |
| --- | --- |
| Nombre, ciudad, estadio, fundación, colores tradicionales | hechos públicos (Wikipedia / sitios oficiales del club) |
| País, liga real y su nivel | conocimiento público de las competiciones |
| **OVR, `refTier` y las tres reputaciones** | **curación propia** (tablas de este documento) |
| `slug`, `key`, `division`, `crest` | **derivados por nosotros** en el adapter |

**Por qué NO usamos los datasets de Copero / `carrera-cli`**: el código de
`carrera-cli` tiene licencia MIT, pero sus datasets derivan de datos públicos de
Copero y esa licencia **no cubre esos datos**. En vez de asumir una cobertura que
no podemos verificar, el catálogo es propio: los hechos son públicos (no son
propiedad de nadie) y todos los valores de juego (OVR/reputaciones) son nuestros.
La misma razón aplica a los textos y a los logos: nada se copia de Copero.

## 8. Cómo agregar un país, una liga o un club

**Universo cerrado (§0): no agregar ni quitar nada sin avisar primero.** Si el
cambio está aprobado, **no se toca el engine.** Solo datos:

1. **País nuevo** → agregar la entrada en `COUNTRIES` (`careerWorld/countries.js`):
   `XX: { name: 'País', flag: '🇽🇽' }` y su bloque en `LEAGUES`.
2. **Liga nueva** → agregar la liga dentro de `LEAGUES[XX]` con su `level` real:
   `xx_n: { name: 'Nombre real', level: N }`.
3. **Club nuevo** → una línea en el RAW de `careerWorld/clubs.js`, respetando el
   orden país → liga → nivel y el formato compacto:

```js
{c:'XX',l:'xx_n',city:'Ciudad',n:'Nombre',s:'SIG',p:'#rrggbb',q:'#rrggbb',
 o:70,d:3,k:2,i:1,y:1900,st:'Estadio'},
//  c país · l liga · n nombre · s sigla · p/q colores · o OVR curado
//  d tier de referencia · k/i reputaciones 0-5 · y fundación · st estadio
```

4. **Verificar** con `node scripts/smoke-career-clubs.mjs` (valida modelo,
   unicidad, rangos, colores, escudo y la integración con el engine).

`slug`, `key`, `division`, `crest`, `overall` y `shortName` se derivan solos en
`careerWorld.js`: no se escriben a mano en el RAW.

## 9. Versionado y persistencia

- `CAREER_WORLD_VERSION = 3`: los cambios estructurales del mundo invalidan los
  saves viejos (v2: reemplazo del mundo Avergas por clubes reales · v3: la
  Tercera División deja de existir y las divisiones internas pasan a ser
  Primera/Segunda). `persistence.js` compara `envelope.worldVersion` y rechaza el
  save con `reason: 'world_version'`; `useCareer` arranca sin carrera y el
  jugador empieza una nueva. **No se borra ninguna otra preferencia** de la app
  (las claves del modo viejo/Copero siguen intactas).
- Catálogo cerrado: `persistence.js` además valida que el club del save exista
  en el mundo (`reason: 'unknown_club'`) y que su división siga coherente
  (`'club_division_mismatch'`). Un save de un club que salió del universo se
  descarta limpio (nueva carrera); los saves con clubes vigentes y misma
  división siguen funcionando sin migración.
- El `schemaVersion` del save (`CAREER_SAVE_SCHEMA_VERSION`) no cambió: la forma
  del estado es la misma; lo que cambió es el contenido del mundo.
- Una carrera nueva guarda el club canónico completo (país, liga, `crest`), así
  que la UI puede mostrar país/liga/escudo sin depender de nada externo.

## 10. Supuestos y pendientes de verificar

1. **Rosters**: listas completas de las 13 competiciones tomadas de Wikipedia
   (temporadas 2025-26 / 2026 en curso). Los ascensos/descensos de cada
   temporada no se re-modelan: como el `leagueLevel` es de la liga REAL y la
   `division` interna sale del OVR, un ascenso/descenso no rompe el engine
   (solo se actualiza el RAW cuando se quiera reflejarlo).
2. **Ciudad/estadio/fundación**: hechos públicos curados a "mejor esfuerzo";
   pueden tener errores puntuales de detalle en clubes menores (no afectan
   reglas de juego; el smoke valida estructura, no contenido semántico).
3. **`internationalReputation`** es hoy un proxy de la continental (ver §5).
4. **Escudos**: `shape: 'shield'` y `symbol` de 3 letras para todos. La UI ya
   consume el descriptor; la cobertura de logos reales se resuelve en la
   siguiente etapa (ver `docs/LOGO-LICENSE-MANIFEST.md`).
5. **Logos fuera de alcance**: `crests.generated.js` todavía tiene 28 entradas
   de clubes que no están en el universo cerrado (Alemania, Países Bajos,
   Portugal, Bélgica, Uruguay y 6 clubes que salieron del roster). **No se
   borran**: están inventariadas con licencia verificada en
   `docs/LOGO-LICENSE-MANIFEST.md` §4. Ningún club del catálogo las usa; el peso
   real por red es de 68 archivos (1,6 MB) de los que solo 40 están en uso.

## 11. QA del catálogo (cómo se valida)

| Comando | Qué valida |
| --- | --- |
| `npm run build` | Compila la app (vite) con el catálogo nuevo. |
| `npm run smoke` | Corre TODOS los `scripts/smoke-*.mjs` y resume PASS/FAIL. |
| `node scripts/smoke-career-clubs.mjs` | Universo exacto (país/competición), modelo de club, unicidad, rangos, colores, contrato con el engine. |
| `node scripts/smoke-career-all-clubs.mjs` | Los 296 clubes: contrato completo, visual/crest, y un ciclo de carrera real por club (debut → retiro) + round-trip de save. |
| `node scripts/smoke-career-ui.mjs` | Render SSR real de la UI en cada fase (setup, debut, temporada, evento, decisión, mercado, retiro) sin textos rotos. |

El smoke por club es el que garantiza que **ningún club genera errores por campos
faltantes**: si un club entra al catálogo sin `stadium`, `barrio` o colores
válidos, falla ahí y no en producción.



