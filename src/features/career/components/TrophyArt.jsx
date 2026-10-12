// Copa de un título: la imagen real (/public/trophies/<id>.png) o, si todavía
// no está, el emoji del título. Se usa en el aviso de campeón y en la vitrina.
import { useState } from 'react';

import { trophyImage } from '../trophies.js';

export default function TrophyArt({ trophy, className = '' }) {
  const src = trophyImage(trophy);
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={`trophy-art ${className}`} src={src} alt="" draggable="false" onError={() => setBroken(true)} />;
  }
  return <span className={`trophy-art trophy-art--emoji ${className}`} aria-hidden="true">{(trophy && trophy.icon) || '🏆'}</span>;
}
