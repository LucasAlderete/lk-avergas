// Cabecera compartida por Plantel y Alineación: identidad de la sección a la
// izquierda y menú global a la derecha. Ambas pantallas exponen los mismos
// destinos, así que el menú se cablea una sola vez acá.
import AccountBar from '../auth/AccountBar.jsx';
import { useIsAdmin } from '../auth/AuthContext.jsx';
import { SectionNav } from './SectionNav.jsx';

export function SectionHeader({ title, subtitle, current, onHome, onNavigate }) {
  const go = (id) => { if (typeof onNavigate === 'function') onNavigate(id); };
  const isAdmin = useIsAdmin();

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
          onAdmin={() => go('admin')}
          isAdmin={isAdmin}
        />
        <AccountBar compact />
      </div>
    </header>
  );
}

export default SectionHeader;