# Datos de los jugadores

Todo esto vive en **`src/data.js`**. Es el único lugar donde se edita: este documento es solo para leerlo cómodo.

## Qué datos tiene cada jugador

| Campo | Para qué se usa |
|---|---|
| `name` | Nombre en toda la web |
| `pace`, `shooting`, `passing`, `dribbling`, `defense`, `physical` | Los 6 atributos (0 a 10) de Plantel y Alineación. En Mi carrera solo definen el estilo de crecimiento, **no** el OVR |
| `phrase` | Frase corta en Plantel y en la ficha |
| `lore.cargadas` | Una sola lista con todo lo del jugador (rasgos, anécdotas, cargadas). Es la materia prima para los eventos personalizados de Mi carrera |
| `pool` | Grupo del jugador (ej. `premium` = Randoms Premium Ultra) |

En Mi carrera el OVR es **independiente** del OVR real: todos arrancan con 50 y cualquiera puede terminar siendo el mejor o el peor.

## Cómo editar

En `src/data.js`, cada jugador es una línea así:

```js
{ name: 'Rulo', pace: 6.5, ..., phrase: 'Desde la lesión ya no soy el mismo',
  lore: { cargadas: ["es muy enano", "tiene rulos", "siempre está lesionado"] } },
```

- **Una idea por ítem.** Así el juego puede tomar una cargada suelta para armar un evento.
- Para **agregar**: sumá un texto entre comillas dentro de los corchetes, separado por coma.
- Para **sacar**: borralo junto con su coma.
- Cuanto más **concreto** (una anécdota, un hábito, un apodo), mejores eventos salen.

## Lo que hay cargado hoy

### Chino
- **Frase:** Inflando sueños
- **Cargadas:**
  - es chino
  - siempre busca la ventaja
  - hace trampa para sacar ventaja
  - se queja mucho en los partidos
  - le dicen "Lady Chino"
  - tiene un emprendimiento de decoración de cumpleaños llamado "Inflando sueños" (lo cargamos con que está "inflando un sueño")
  - tiene novia
  - lo cargamos con que JJ es el amante de su novia

### Emi
- **Frase:** Aah ahhh ahhh ∞
- **Cargadas:**
  - es colorado
  - es gordo (+100 kg)
  - es buen pibe
  - tiene novia
  - Cru tiene un romance con su hermana
  - es el gran superador de anécdotas: si alguien cuenta una, él cuenta algo más impresionante

### Mati
- **Frase:** Real Madrid fan
- **Cargadas:**
  - es fanático del Real Madrid
  - es hincha de San Lorenzo pero mira los partidos del Real Madrid y no los de su club

### Rui
- **Frase:** Exportador de ruilleros
- **Cargadas:**
  - es gordo (+100 kg)
  - es súper pesimista
  - es el rey del malviaje
  - siempre la está bajando ("la baja")
  - manda audios bajándole el ánimo a todos, y también lo hace en persona
  - siempre se cree el mejor del partido aunque no lo sea
  - arregla aires acondicionados (lo cargamos con que estafa a la gente con los aires)
  - lo relacionamos con el "Chiqui" Tapia: hace cosas de mafioso para arreglar partidos
  - tiene novia

### Gonzi
- **Frase:** ¿Qué le faltó a tu equipo?
- **Cargadas:**
  - es el crack del grupo
  - siempre está "fumado" (marihuana)
  - una vez, drogado, mandó un mensaje tipo "venite que estamos con los de siempre en lo de todos"

### Lk
- **Frase:** $5000. Winter is here
- **Cargadas:**
  - cobra $5000
  - Winter is here

### Tigre
- **Frase:** La amenaza silenciosa
- **Cargadas:**
  - es muy sensible
  - se ofende porque no le subimos los "puntitos" (el OVR)
  - chiste sobre sus problemas con la cocaína: "¿qué le hace una raya más al tigre?"

### Rulo
- **Frase:** Desde la lesión ya no soy el mismo
- **Cargadas:**
  - es muy enano
  - tiene rulos
  - siempre está lesionado
  - se cree de clase alta y bardea a los pobres

### Sailor
- **Frase:** Malviajo, luego existo
- **Cargadas:**
  - es el insoportable del grupo
  - es simpático pero intenso
  - siempre está malviajando
  - para jugar es muy rústico
  - siempre corre para adelante sin pasar la pelota

### Cru
- **Frase:** ¿Alguien dijo hermana?
- **Cargadas:**
  - es fanático del gimnasio
  - siempre se quiere sacar la remera para mostrar el físico
  - quiere acostarse con las hermanas de los amigos, en especial la de Emi

### Nahue
- **Frase:** Mis 3 dedos es lo único que tengo
- **Cargadas:**
  - es el más pajero (siempre sin ganas)
  - es el más falopero (marihuana)

### JJ
- **Frase:** ¿A qué hora te vas?
- **Cargadas:**
  - siempre quiere conquistar a las mujeres de los amigos
  - los que tienen pareja son Emi, Rui y Chino: se pueden hacer chistes con sus novias

### Luquitas
- **Frase:** Equilibrio total
- **Cargadas:**
  - es parejo en todo

### Kike
- **Frase:** Un toque más y era gol
- **Cargadas:**
  - casi siempre mete gol

### Alan
- **Frase:** Yo la veo, vos correte
- **Cargadas:**
  - ve todos los pases

### Wini
- **Frase:** Uno de los de siempre
- **Cargadas:**
  - es un averga oficial
  - siempre da vueltas en la cancha
  - es el rey del enganche: engancha, engancha y se pasa a todos
  - engancha de más: le puede salir bien o mal, hasta caerse o irse de la cancha solo

## Para completar

Lk, Luquitas, Kike y Alan tienen muy poco material (1 o 2 ítems). Sumarles anécdotas concretas les da más eventos propios.

Los Randoms (Random 1 a 5, Pablito Lechuga, Joni Pelado 2, Fede) no tienen cargadas y no se pueden elegir en Mi carrera.
