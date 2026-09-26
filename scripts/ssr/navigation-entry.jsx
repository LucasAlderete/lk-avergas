import { renderToStaticMarkup } from 'react-dom/server';

import { AuthProvider } from '../../src/auth/AuthContext.jsx';
import AdminScreen from '../../src/components/AdminScreen.jsx';
import CareerScreen from '../../src/features/career/components/CareerScreen.jsx';
import CareerHeader from '../../src/features/career/components/CareerHeader.jsx';
import HomeScreen, { HomeDestinations } from '../../src/components/HomeScreen.jsx';
import LineupScreen from '../../src/components/LineupScreen.jsx';
import PlayerStatsSheet from '../../src/components/PlayerStatsSheet.jsx';
import SectionNav, { SectionNav as NamedSectionNav } from '../../src/components/SectionNav.jsx';
import SquadScreen from '../../src/components/SquadScreen.jsx';
import { overallOf, players } from '../../src/data.js';
import * as photoModule from '../../src/playerPhotos.js';

const noop = () => {};

function render(element) {
  try {
    return { ok: true, html: renderToStaticMarkup(<AuthProvider>{element}</AuthProvider>) };
  } catch (error) {
    return { ok: false, html: '', error: String(error?.message || error) };
  }
}

export const renderHome = () => render(<HomeScreen onNavigate={noop} />);
export const renderCareer = () => render(<CareerScreen onBack={noop} onNavigate={noop} />);
export const renderSquad = () => render(<SquadScreen onBack={noop} onNavigate={noop} />);
// La ficha se abre con un toque, así que para el smoke se renderiza abierta.
// Acepta el jugador: con foto y sin foto son dos casos distintos.
export const renderStatsSheet = (player = players[0]) => render(<PlayerStatsSheet player={player} onClose={noop} />);
export const playerOvr = (player) => overallOf(player);
// Las fotos se testean contra la pantalla real: qué jugadores tienen foto, y
// que la miniatura del Plantel y el banner del modal usen la misma.
export const photoInfo = () => {
  const { hasPhoto, photoOf, unusedPhotos } = photoModule;
  return {
    withPhoto: players.filter((player) => hasPhoto(player.name)).map((player) => player.name),
    withoutPhoto: players.filter((player) => !hasPhoto(player.name)).map((player) => player.name),
    unused: unusedPhotos(),
    of: (name) => photoOf(name),
  };
};
export const renderLineup = () => render(<LineupScreen onBack={noop} onNavigate={noop} />);
export const renderAdmin = () => render(<AdminScreen onBack={noop} onNavigate={noop} />);
export const renderCareerHeader = (career = { name: 'Alan', age: 19, season: 2026 }, phase = 'season') => render(
  <CareerHeader career={career} phase={phase} onBack={noop} onNavigate={noop} />,
);

function walk(node, visit) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!node || typeof node !== 'object') return;
  visit(node);
  walk(node.props?.children, visit);
}

function exerciseElement(element, onTarget) {
  walk(element, (node) => {
    const target = node.props?.['data-navigation'];
    if (!target || typeof node.props.onClick !== 'function') return;
    node.props.onClick();
    onTarget(target);
  });
}

export function exerciseHomeCallbacks() {
  const calls = [];
  exerciseElement(HomeDestinations({ onNavigate: (target) => calls.push(target), isAdmin: false }), (target) => calls.push(`click:${target}`));
  return calls.filter((value) => value.startsWith('click:')).map((value) => value.slice(6));
}

export function exerciseCareerCallbacks() {
  const calls = [];
  exerciseElement(CareerHeader({
    career: { name: 'Alan', age: 19, season: 2026 },
    phase: 'season',
    onBack: () => calls.push('home'),
    onNavigate: (target) => calls.push(target),
  }), (target) => {
    if (target === 'home' && calls.length === 0) return;
  });
  return calls;
}

function exerciseSectionNav(current, extra = {}) {
  const calls = [];
  exerciseElement(SectionNav({
    current,
    onHome: () => calls.push('home'),
    onCareer: () => calls.push('career'),
    onSquad: () => calls.push('squad'),
    onLineup: () => calls.push('lineup'),
    ...extra,
  }), () => {});
  return calls;
}

export function exerciseSquadCallbacks() {
  return exerciseSectionNav('squad');
}

export function exerciseLineupCallbacks() {
  return exerciseSectionNav('lineup');
}

export const componentIdentity = {
  home: HomeScreen === NamedSectionNav ? 'invalid' : 'home',
  career: CareerScreen ? 'career' : 'invalid',
  squad: SquadScreen ? 'squad' : 'invalid',
  lineup: LineupScreen ? 'lineup' : 'invalid',
  players: players.length,
};
