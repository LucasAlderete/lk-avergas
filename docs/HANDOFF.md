# Traspaso — pendientes

## 1. Flag de Mi carrera en `true` (TEMP)
- Archivo: `src/navigation.js:15`
- Estado actual: `FEATURE_FLAGS = Object.freeze({ career: true }); // TEMP local: volver a false antes de commitear`
- Acción: volver `career` a `false` **antes de commitear/pushear** (y quitar el comentario TEMP si corresponde), salvo que se decida lanzar la feature.

## 2. Falta correr `/review-animations`
- Revisar las animaciones/motion de la feature de carrera (`src/features/career/components/careerScreen.css` y componentes) y de los cambios de UI recientes (Home, Squad, Lineup, stats sheet).
- Aplicar los fixes que salgan del review.

## Contexto
- Hay muchos cambios sin commitear en el working tree (ver `git status`); nada de esto está subido todavía.
