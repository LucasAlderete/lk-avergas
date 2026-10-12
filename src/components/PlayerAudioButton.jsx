import { Volume2 } from 'lucide-react';

import { hasAudio, playPlayerAudio } from '../playerAudio.js';

export default function PlayerAudioButton({ name, className = '' }) {
  if (!hasAudio(name)) return null;

  const play = (event) => {
    event.stopPropagation();
    event.preventDefault();
    playPlayerAudio(name);
  };

  return (
    <span
      className={`player-audio-btn${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      title={`Escuchar a ${name}`}
      aria-label={`Reproducir audio de ${name}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
      onClick={play}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        play(event);
      }}
    >
      <Volume2 size="1em" strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
