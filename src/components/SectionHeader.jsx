// Cabecera compartida por Plantel y Alineación: identidad de la sección a la
// izquierda y menú global a la derecha. Ambas pantallas exponen los mismos
// destinos, así que el menú se cablea una sola vez acá.
import { SectionNav } from './SectionNav.jsx';
import AccountBar from '../auth/AccountBar.jsx';

export function SectionHeader({ title, subtitle, current, onHome, onNavigate }) {
  const go = (id) => { if (typeof onNavigate === 'function') onNavigate(id); };

  return (
    <header className="section-header">
      <div>
        <p className="eyebrow">Averga&apos;s Club</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="section-header-tools">
        <SectionNav
          current={current}
          onHome={onHome}
          onCareer={() => go('career')}
          onSquad={() => go('squad')}
          onLineup={() => go('lineup')}
        />
        <AccountBar compact />
      </div>
    </header>
  );
}

export default SectionHeader;