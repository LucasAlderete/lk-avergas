// ============================================================================
// NAVEGACIÓN — qué pantallas existen y cuáles se ven.
//
// FEATURE_FLAGS apaga secciones SIN borrar el código. "Mi carrera" todavía está
// a medio refinar, así que va apagada para la primera versión: no aparece en el
// Inicio, no aparece en el menú, no es una ruta válida y el storage no la
// restaura. Para publicarla más adelante alcanza con poner `career: true` acá
// y la pantalla, su tarjeta y su botón vuelven solos.
// ============================================================================

// Todas las pantallas que la app conoce, prendidas o apagadas.
const ALL_APP_SCREENS = Object.freeze(['home', 'career', 'squad', 'lineup']);

// Por sección: false = oculta. Lo que no está en el objeto va prendido.
export const FEATURE_FLAGS = Object.freeze({ career: false });

export const isFeatureEnabled = (id) => FEATURE_FLAGS[id] !== false;

// Las pantallas alcanzables de verdad: la lista de rutas y el filtro del menú
// salen de acá, así que no se puede desincronizar uno del otro.
export const APP_SCREENS = Object.freeze(ALL_APP_SCREENS.filter(isFeatureEnabled));

const APP_SCREEN_SET = new Set(APP_SCREENS);

export function isAppScreen(screen) {
  return APP_SCREEN_SET.has(screen);
}

export const ADMIN_SCREEN = 'admin';

export function canOpenScreen(screen, user) {
  if (screen === ADMIN_SCREEN) return Boolean(user?.isAdmin);
  return isAppScreen(screen);
}

export function resolveStoredScreen(screen, user) {
  return canOpenScreen(screen, user) ? screen : 'home';
}

export function transitionScreen(currentScreen, nextScreen, user) {
  if (canOpenScreen(nextScreen, user)) return nextScreen;
  return canOpenScreen(currentScreen, user) ? currentScreen : 'home';
}
