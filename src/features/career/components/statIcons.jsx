// Íconos de fútbol para las columnas de la trayectoria (goles y asistencias).
// Dibujados a mano en SVG, a todo color, con la misma firma que lucide
// (`size`) para poder reemplazarlos sin tocar el resto.

/** Pelota de fútbol clásica: blanca con pentágonos negros. */
export function SoccerBall({ size = 14, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <circle cx="12" cy="12" r="10.5" fill="#f7f7f2" stroke="#1d1d1b" strokeWidth="1.2" />
      <polygon points="12,7.6 15.6,10.2 14.2,14.4 9.8,14.4 8.4,10.2" fill="#1d1d1b" />
      <g stroke="#1d1d1b" strokeWidth="1.1" strokeLinecap="round">
        <line x1="12" y1="7.6" x2="12" y2="1.8" />
        <line x1="15.6" y1="10.2" x2="21.6" y2="8.6" />
        <line x1="14.2" y1="14.4" x2="17.6" y2="20" />
        <line x1="9.8" y1="14.4" x2="6.4" y2="20" />
        <line x1="8.4" y1="10.2" x2="2.4" y2="8.6" />
      </g>
      <path d="M9.4 2.1 12 1.6l2.6.5L12 3.6z M20.6 6.2l1.3 2.6-.2 2.7-1.7-2.4z M19.4 19.2l-2.4 1.9-2.2.6 1.4-2.6z M4.6 19.2l2.4 1.9 2.2.6-1.4-2.6z M3.4 6.2 2.1 8.8l.2 2.7 1.7-2.4z" fill="#1d1d1b" />
    </svg>
  );
}

/** Botín de fútbol de perfil: capellada de color, cordones y tapones. */
export function FootballBoot({ size = 14, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      {/* Suela */}
      <path d="M2 17.2h18.6c1 0 1.6-.7 1.4-1.6l-.1-.4H2.4z" fill="#1d1d1b" />
      {/* Tapones */}
      <g fill="#c9c9c2">
        <rect x="3.6" y="17.4" width="2" height="2.4" rx=".5" />
        <rect x="8" y="17.4" width="2" height="2.4" rx=".5" />
        <rect x="14.2" y="17.4" width="2" height="2.4" rx=".5" />
        <rect x="18.4" y="17.4" width="2" height="2.4" rx=".5" />
      </g>
      {/* Capellada */}
      <path d="M2.4 15.2c-.4-2.6.1-6 .9-8.4.3-.9 1.2-1.4 2.1-1.2l3.4.8c.6.1.9.7.8 1.3l-.3 1.2c2.8.7 6.6 1.5 9.4 2.3 1.9.5 3.3 2.1 3.3 4z" fill="#e7ad4e" stroke="#1d1d1b" strokeWidth=".9" strokeLinejoin="round" />
      {/* Franja y cordones */}
      <path d="M5.6 15.1c.9-2.4 2.6-4.3 4.9-5.3" stroke="#1d1d1b" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <g stroke="#fff" strokeWidth=".9" strokeLinecap="round">
        <line x1="10.6" y1="9.4" x2="11.4" y2="11.2" />
        <line x1="12.4" y1="9.8" x2="13.2" y2="11.6" />
        <line x1="14.2" y1="10.3" x2="15" y2="12" />
      </g>
    </svg>
  );
}

/** Camiseta de fútbol: dorada con cuello y número, mismo trazo que el resto. */
export function Jersey({ size = 14, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path d="M8.2 2.6 3 5.2 1.4 10l3.4 1.4 1.4-2V21.4h11.6V9.4l1.4 2L22.6 10 21 5.2l-5.2-2.6c-.6 1.4-2.1 2.3-3.8 2.3S8.8 4 8.2 2.6z" fill="#e7ad4e" stroke="#1d1d1b" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M8.2 2.6c.6 1.4 2.1 2.3 3.8 2.3s3.2-.9 3.8-2.3" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M1.9 8.7l3.2 1.3 M22.1 8.7l-3.2 1.3" stroke="#fff" strokeWidth="1" />
      <text x="12" y="17.2" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="800" fontSize="8" fill="#1d1d1b">10</text>
    </svg>
  );
}

/** Calendario de hoja: anillas, encabezado rojo y grilla de días. */
export function CalendarSheet({ size = 14, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <rect x="2.5" y="4" width="19" height="17.5" rx="2.4" fill="#f7f7f2" stroke="#1d1d1b" strokeWidth=".9" />
      <path d="M2.5 9V6.4A2.4 2.4 0 0 1 4.9 4h14.2a2.4 2.4 0 0 1 2.4 2.4V9z" fill="#d63c50" stroke="#1d1d1b" strokeWidth=".9" />
      <g fill="#1d1d1b">
        <rect x="6.6" y="2" width="1.8" height="4.4" rx=".9" />
        <rect x="15.6" y="2" width="1.8" height="4.4" rx=".9" />
        <rect x="5.4" y="11.4" width="2.6" height="2.2" rx=".4" />
        <rect x="10.7" y="11.4" width="2.6" height="2.2" rx=".4" />
        <rect x="16" y="11.4" width="2.6" height="2.2" rx=".4" />
        <rect x="5.4" y="15.8" width="2.6" height="2.2" rx=".4" />
        <rect x="10.7" y="15.8" width="2.6" height="2.2" rx=".4" />
      </g>
      <rect x="16" y="15.8" width="2.6" height="2.2" rx=".4" fill="#e7ad4e" />
    </svg>
  );
}
