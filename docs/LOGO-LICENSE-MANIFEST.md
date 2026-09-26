# Manifiesto de procedencia y licencia — logos de clubes reales

> **Última actualización:** 2026-09-22 (cierre del universo de clubes)
> **Origen:** Wikimedia Commons · **Búsqueda:** MediaWiki API
> **Generador:** `node scripts/fetch-club-crests.mjs` (reanudable)

---

## Resumen ejecutivo

| Concepto | Valor |
| --- | --- |
| Clubes del catálogo cerrado (`docs/README-CAREER-CLUBS.md` §0) | **296** |
| Archivos de logo en `public/career/clubs/` | **68** |
| Entradas en `CREST_FILES` (`crests.generated.js`) | **68** |
| Clubes del catálogo **con logo real** | **40** (13,5 %) |
| Clubes del catálogo **con fallback procedural** | **256** (86,5 %) |
| Archivos de logo **huérfanos** (fuera del universo cerrado) | **28** |

Los 68 archivos se conservan tal como se descargaron. **No se borra ningún asset** en
esta etapa: los 28 huérfanos quedan inventariados en §4 y se resuelven cuando se
haga la pasada de logos del universo cerrado.

---

## 1. Procedencia

Los archivos se descargaron desde **Wikimedia Commons** usando la API de MediaWiki. Cada
archivo tiene `source`, `license`, `page` y `article` registrados en
`docs/crest-manifest.json`, que es el manifiesto máquina-legible (resumible). El script
`scripts/fetch-club-crests.mjs` hace el proceso completo: búsqueda del artículo, control
de licencia, descarga, detección de formato por *magic bytes* y escritura del manifiesto,
de los PNG y de `src/data/careerWorld/crests.generated.js`.

## 2. Criterios de licencia

Solo se aceptan archivos con licencia de redistribución libre:

- Public domain
- CC0
- CC BY 3.0 / 4.0
- CC BY-SA 3.0 / 4.0

Todo club para el que no exista un archivo con esas licencias queda con el **fallback
procedural** (escudo CSS: forma `shield`, colores del club y sigla de 3 letras).

### Distribución del fallback por país (256 clubes)

| País | Clubes del catálogo | Con logo real | Con fallback |
| --- | --- | --- | --- |
| Argentina | 66 | 17 | 49 |
| España | 42 | 0 | 42 |
| Francia | 36 | 0 | 36 |
| Inglaterra | 44 | 4 | 40 |
| Italia | 40 | 5 | 35 |
| Brasil | 20 | 11 | 9 |
| Estados Unidos | 30 | 0 | 30 |
| México | 18 | 3 | 15 |
| **Total** | **296** | **40** | **256** |

## 3. Logos reales por país (solo clubes del universo cerrado)

### Argentina (17)

| Slug | Club | Archivo | Licencia |
| --- | --- | --- | --- |
| river-plate | River Plate | `career/clubs/river-plate.png` | Public domain |
| velez-sarsfield | Vélez Sarsfield | `career/clubs/velez-sarsfield.png` | Public domain |
| racing-club | Racing Club | `career/clubs/racing-club.png` | Public domain |
| san-lorenzo | San Lorenzo | `career/clubs/san-lorenzo.png` | Public domain |
| independiente | Independiente | `career/clubs/independiente.png` | Public domain |
| estudiantes | Estudiantes | `career/clubs/estudiantes.png` | Public domain |
| talleres | Talleres | `career/clubs/talleres.png` | Public domain |
| lanus | Lanús | `career/clubs/lanus.png` | Public domain |
| newell-s-old-boys | Newell's Old Boys | `career/clubs/newell-s-old-boys.png` | Public domain |
| huracan | Huracán | `career/clubs/huracan.png` | CC BY-SA 4.0 |
| gimnasia-y-esgrima | Gimnasia y Esgrima | `career/clubs/gimnasia-y-esgrima.png` | Public domain |
| argentinos-juniors | Argentinos Juniors | `career/clubs/argentinos-juniors.png` | Public domain |
| banfield | Banfield | `career/clubs/banfield.png` | Public domain |
| platense | Platense | `career/clubs/platense.png` | Public domain |
| almagro | Almagro | `career/clubs/almagro.png` | CC0 |
| san-telmo | San Telmo | `career/clubs/san-telmo.png` | Public domain |
| los-andes | Los Andes | `career/clubs/los-andes.png` | Public domain |

### Brasil (11)

| Slug | Club | Archivo | Licencia |
| --- | --- | --- | --- |
| flamengo | Flamengo | `career/clubs/flamengo.png` | Public domain |
| palmeiras | Palmeiras | `career/clubs/palmeiras.png` | Public domain |
| corinthians | Corinthians | `career/clubs/corinthians.png` | Public domain |
| sao-paulo-fc | São Paulo FC | `career/clubs/sao-paulo-fc.png` | Public domain |
| gremio | Grêmio | `career/clubs/gremio.png` | Public domain |
| internacional | Internacional | `career/clubs/internacional.png` | Public domain |
| atletico-mineiro | Atlético Mineiro | `career/clubs/atletico-mineiro.png` | Public domain |
| cruzeiro | Cruzeiro | `career/clubs/cruzeiro.png` | CC BY-SA 4.0 |
| santos | Santos | `career/clubs/santos.png` | Public domain |
| vasco-da-gama | Vasco da Gama | `career/clubs/vasco-da-gama.png` | Public domain |
| remo | Remo | `career/clubs/remo.png` | Public domain |

### Italia (5)

| Slug | Club | Archivo | Licencia |
| --- | --- | --- | --- |
| juventus | Juventus | `career/clubs/juventus.png` | Public domain |
| napoli | Napoli | `career/clubs/napoli.png` | CC BY-SA 3.0 |
| as-roma | AS Roma | `career/clubs/as-roma.png` | CC BY-SA 3.0 |
| fiorentina | Fiorentina | `career/clubs/fiorentina.png` | Public domain |
| torino | Torino | `career/clubs/torino.png` | Public domain |

### Inglaterra (4)

| Slug | Club | Archivo | Licencia |
| --- | --- | --- | --- |
| manchester-city | Manchester City | `career/clubs/manchester-city.png` | CC BY 3.0 |
| arsenal | Arsenal | `career/clubs/arsenal.png` | Public domain |
| sunderland | Sunderland | `career/clubs/sunderland.png` | CC BY-SA 4.0 |
| norwich-city | Norwich City | `career/clubs/norwich-city.png` | Public domain |

### México (3)

| Slug | Club | Archivo | Licencia |
| --- | --- | --- | --- |
| cruz-azul | Cruz Azul | `career/clubs/cruz-azul.png` | CC BY-SA 4.0 |
| monterrey | Monterrey | `career/clubs/monterrey.png` | Public domain |
| toluca | Toluca | `career/clubs/toluca.png` | Public domain |

España, Francia y Estados Unidos hoy **no tienen ningún logo real**: sus 108 clubes
completos usan fallback procedural (ver el cuadro de §2).

---

## 4. Archivos huérfanos (28): fuera del universo cerrado

Estos PNG se descargaron cuando el catálogo incluía países hoy fuera de alcance
(Alemania, Países Bajos, Portugal, Bélgica, Uruguay) y clubes que salieron del roster
(5 brasileños + 1 mexicano). **No se borran**: quedan inventariados y con licencia
verificada por si el alcance se amplía. Hoy ningún club del catálogo los referencia.

| Slug | Archivo | Licencia | Fuera por |
| --- | --- | --- | --- |
| bayer-leverkusen | `career/clubs/bayer-leverkusen.png` | Public domain | país fuera de alcance (Alemania) |
| borussia-dortmund | `career/clubs/borussia-dortmund.png` | Public domain | país fuera de alcance (Alemania) |
| sc-freiburg | `career/clubs/sc-freiburg.png` | CC BY-SA 4.0 | país fuera de alcance (Alemania) |
| vfl-wolfsburg | `career/clubs/vfl-wolfsburg.png` | CC BY-SA 4.0 | país fuera de alcance (Alemania) |
| werder-bremen | `career/clubs/werder-bremen.png` | Public domain | país fuera de alcance (Alemania) |
| mainz-05 | `career/clubs/mainz-05.png` | Public domain | país fuera de alcance (Alemania) |
| hamburger-sv | `career/clubs/hamburger-sv.png` | Public domain | país fuera de alcance (Alemania) |
| fortuna-dusseldorf | `career/clubs/fortuna-dusseldorf.png` | Public domain | país fuera de alcance (Alemania) |
| dynamo-dresden | `career/clubs/dynamo-dresden.png` | CC BY-SA 4.0 | país fuera de alcance (Alemania) |
| ajax | `career/clubs/ajax.png` | CC BY-SA 4.0 | país fuera de alcance (Países Bajos) |
| feyenoord | `career/clubs/feyenoord.png` | Public domain | país fuera de alcance (Países Bajos) |
| az-alkmaar | `career/clubs/az-alkmaar.png` | Public domain | país fuera de alcance (Países Bajos) |
| fc-utrecht | `career/clubs/fc-utrecht.png` | Public domain | país fuera de alcance (Países Bajos) |
| vvv-venlo | `career/clubs/vvv-venlo.png` | Public domain | país fuera de alcance (Países Bajos) |
| fc-volendam | `career/clubs/fc-volendam.png` | Public domain | país fuera de alcance (Países Bajos) |
| benfica | `career/clubs/benfica.png` | Public domain | país fuera de alcance (Portugal) |
| krc-genk | `career/clubs/krc-genk.png` | CC BY-SA 4.0 | país fuera de alcance (Bélgica) |
| charleroi | `career/clubs/charleroi.png` | CC BY-SA 4.0 | país fuera de alcance (Bélgica) |
| nacional | `career/clubs/nacional.png` | CC BY-SA 4.0 | país fuera de alcance (Uruguay) |
| penarol | `career/clubs/penarol.png` | Public domain | país fuera de alcance (Uruguay) |
| defensor-sporting | `career/clubs/defensor-sporting.png` | CC BY-SA 4.0 | país fuera de alcance (Uruguay) |
| danubio | `career/clubs/danubio.png` | Public domain | país fuera de alcance (Uruguay) |
| abc | `career/clubs/abc.png` | Public domain | fuera del roster (Brasil, Série A 2026) |
| ceara | `career/clubs/ceara.png` | Public domain | fuera del roster (Brasil, Série A 2026) |
| criciuma | `career/clubs/criciuma.png` | Public domain | fuera del roster (Brasil, Série A 2026) |
| goias | `career/clubs/goias.png` | Public domain | fuera del roster (Brasil, Série A 2026) |
| sport-recife | `career/clubs/sport-recife.png` | Public domain | fuera del roster (Brasil, Série A 2026) |
| correcaminos-uat | `career/clubs/correcaminos-uat.png` | Public domain | fuera del roster (Liga MX) |