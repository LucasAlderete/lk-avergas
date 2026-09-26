// ============================================================================
// BANNER DEL JUGADOR — la foto grande arriba de la hoja de stats.
//
// Va a todo el ancho de la hoja y el OVR + nombre se superponen abajo, como una
// carta de FIFA. El velo (scrim) es lo que permite que el texto se lea sobre
// cualquier foto. Si el jugador no tiene foto no se pinta nada y la hoja queda
// como estaba: las iniciales siguen siendo el plan B.
// ============================================================================
import { photoOf } from '../playerPhotos.js';

export function PlayerBanner({ player }) {
  const photo = photoOf(player.name);
  if (!photo) return null;

  return (
    <div className="stats-banner">
      <img className="stats-banner-img" src={photo} alt="" decoding="async" fetchPriority="high" />
      <span className="stats-banner-scrim" aria-hidden="true" />
    </div>
  );
}

export default PlayerBanner;