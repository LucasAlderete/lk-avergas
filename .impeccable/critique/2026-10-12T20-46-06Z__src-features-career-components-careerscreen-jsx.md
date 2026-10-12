---
target: seccion mi carrera
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\eagulleiro\\Desktop\\Nahue\\avergas\\lk-avergas\\src\\features\\career\\components\\CareerScreen.jsx"
target_fingerprint: "sha256:06d179440c68719947f1808d1880476e5ecc336e9c1fa81f1e42614974f05438"
target_path: "C:\\Users\\eagulleiro\\Desktop\\Nahue\\avergas\\lk-avergas\\src\\features\\career\\components\\CareerScreen.jsx"
timestamp: 2026-10-12T20-46-06Z
slug: src-features-career-components-careerscreen-jsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 22/40 (Acceptable)

| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Estado del sistema | 2 | Panel "Elegí tu próximo destino" vacío 0.5–1 s; saltos de OVR sin explicar (CareerSeasonReport nunca se renderiza) |
| 2 | Mundo real | 3 | Buen vocabulario y voseo; la fila del timeline muestra el OVR del inicio del bloque |
| 3 | Control y libertad | 1 | Tocar cualquier link del nav borra la carrera; "Volver a jugar" y "Retirarse" sin confirmación |
| 4 | Consistencia | 2 | Única sección sin título; "FICHAR POR" vs "Fichar por"; radios y eyebrows fuera de DESIGN.md |
| 5 | Prevención de errores | 1 | Retirarse pesa igual que un club; sin aviso al salir |
| 6 | Reconocer vs recordar | 2 | Destinos sin rol ni valor; división truncada "Primera…" |
| 7 | Flexibilidad | 2 | Sin saltear reveal/ruleta |
| 8 | Estética y minimalismo | 3 | 11 filas futuras vacías empujan la decisión bajo el pliegue; panel de retiro repetido |
| 9 | Recuperación de errores | 3 | Existen estados de error, pero con jerga ("El motor no generó ofertas") |
| 10 | Ayuda | 3 | Las probabilidades por opción son excelentes; nada explica tiers de color ni íconos de la tabla |

## Priority issues
- [P0] La carrera se borra al navegar (useCareer sin persistencia; CareerScreen se desmonta). Fix: sessionStorage o subir el hook; confirmar reset/retiro.
- [P0] Los traspasos de eventos nunca ocurren: pendingTransfer solo se limpia (engine.js:1185, 1598). Fix: inyectar el club como primera oferta "Te buscó" o cambiar el copy.
- [P1] Decisión bajo el pliegue + timeline con scroll interno que atrapa el pulgar (careerScreen.css:2176). Fix: colapsar futuro, sacar overscroll-behavior: contain, decisión arriba o sticky.
- [P1] Faltan datos para decidir: tiles sin rol/división completa; reporte de temporada es código muerto. Fix: línea de rol + recibo "T3–T4: +7 OVR · 15 goles".
- [P2] Deriva de DESIGN.md: título oculto (careerScreen.css:2172), 14 kickers, radios 14px, tiers bronce/plata/oro/elite, side-tab en timeline (careerScreen.css:1232), contraste del chip de edad con color de club.

## Bugs
Clubes +1 (CareerScreen.jsx:439); "AHORA" tras retiro (CareerTimeline.jsx:187); "2 temporada" recortado; hueco 420px en setup paso 3 (CareerSetup.jsx:145); franja oscura en mobile (careerScreen.css:2306); títulos duplicados en retiro; sin h1 y h3 antes de h2; dt 10.5px; OVR bronce 3.1:1; motion sin reduced-motion; toggle dev tapa "Continuar".
