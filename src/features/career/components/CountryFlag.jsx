// Bandera como miniatura SVG inline. Los emoji de bandera no se dibujan en
// Windows (salen como letras "AR", "ES") y el de Inglaterra es una secuencia de
// tags que se rompe; así se ve igual en todos lados y sin pedidos de red.

const W = 30;
const H = 20;

const FLAGS = {
  AR: (
    <>
      <rect width={W} height={H} fill="#74acdf" />
      <rect y="6.67" width={W} height="6.67" fill="#fff" />
      <circle cx="15" cy="10" r="2.2" fill="#f6b40e" />
    </>
  ),
  ES: (
    <>
      <rect width={W} height={H} fill="#c60b1e" />
      <rect y="5" width={W} height="10" fill="#ffc400" />
    </>
  ),
  FR: (
    <>
      <rect width="10" height={H} fill="#0055a4" />
      <rect x="10" width="10" height={H} fill="#fff" />
      <rect x="20" width="10" height={H} fill="#ef4135" />
    </>
  ),
  EN: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect x="12.5" width="5" height={H} fill="#ce1124" />
      <rect y="7.5" width={W} height="5" fill="#ce1124" />
    </>
  ),
  IT: (
    <>
      <rect width="10" height={H} fill="#009246" />
      <rect x="10" width="10" height={H} fill="#fff" />
      <rect x="20" width="10" height={H} fill="#ce2b37" />
    </>
  ),
  BR: (
    <>
      <rect width={W} height={H} fill="#009c3b" />
      <polygon points="15,2 28,10 15,18 2,10" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.2" fill="#002776" />
    </>
  ),
  US: (
    <>
      <rect width={W} height={H} fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * H) / 13} width={W} height={H / 13} fill="#b22234" />
      ))}
      <rect width="13" height="10.8" fill="#3c3b6e" />
    </>
  ),
  MX: (
    <>
      <rect width="10" height={H} fill="#006847" />
      <rect x="10" width="10" height={H} fill="#fff" />
      <rect x="20" width="10" height={H} fill="#ce1126" />
      <circle cx="15" cy="10" r="2.4" fill="#8c6a2f" />
    </>
  ),
  PT: (
    <>
      <rect width="12" height={H} fill="#046a38" />
      <rect x="12" width="18" height={H} fill="#da291c" />
      <circle cx="12" cy="10" r="3.6" fill="#ffe000" />
      <circle cx="12" cy="10" r="1.8" fill="#fff" />
    </>
  ),
  DE: (
    <>
      <rect width={W} height="6.67" fill="#000" />
      <rect y="6.67" width={W} height="6.67" fill="#dd0000" />
      <rect y="13.33" width={W} height="6.67" fill="#ffce00" />
    </>
  ),
};

export default function CountryFlag({ code, size = 18, className = '' }) {
  const art = FLAGS[code];
  if (!art) return null;
  return (
    <svg
      className={`career-flag ${className}`.trim()}
      viewBox={`0 0 ${W} ${H}`}
      width={Math.round((size * W) / H)}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g>{art}</g>
    </svg>
  );
}
