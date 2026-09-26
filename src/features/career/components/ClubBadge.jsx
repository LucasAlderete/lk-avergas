// ============================================================================
// CLUB BADGE — componente de escudo/logo de club (Modo Carrera)
// ============================================================================
// Renderiza el logo real del club cuando existe (imagen desde public/),
// o el fallback procedural (CSS con las iniciales del club).
//
// Props:
//   club       — objeto con { crestSrc, symbol, primary, secondary } (viene de
//                clubVisual/clubVisual())
//   size       — 'xs' | 'sm' | 'lg' ( Default: 'sm')
//   className  — clase CSS adicional opcional
//   style      — estilo inline adicional (p.e. para --club-primary/--club-secondary)
// ============================================================================

import { Shield } from 'lucide-react';

/** Tamaños del badge y su clase CSS asociada. */
const SIZE_MAP = {
  xs: 'career-badge--xs',
  sm: 'career-badge--sm',
  lg: 'career-badge--lg',
};

export default function ClubBadge({ club, size = 'sm', className = '', style = {} }) {
  const crestSrc = club && club.crestSrc;
  const symbol = club && club.symbol;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;

  const baseClasses = 'career-badge';
  const hasLogo = Boolean(crestSrc);

  return (
    <span
      className={`${baseClasses} ${hasLogo ? 'career-badge--with-logo' : ''} ${sizeClass} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {hasLogo && crestSrc ? (
        // eslint-disable-next-line react/no-danger — src viene del catálogo curado
        <img src={crestSrc} alt="" draggable={false} />
      ) : (
        symbol || <Shield size={size === 'xs' ? 14 : size === 'lg' ? 28 : 18} />
      )}
    </span>
  );
}

/** Props tipadas para ClubBadge (útil para componentes que lo consumen). */
export function clubBadgeProps(club, size) {
  return { club, size };
}