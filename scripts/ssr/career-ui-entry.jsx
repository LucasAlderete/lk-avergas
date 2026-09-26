// ============================================================================
// ENTRY SSR del smoke de UI del Modo Carrera (scripts/smoke-career-ui.mjs)
// ============================================================================
// Renderiza cada componente de presentación del Career Mode con React SSR para
// verificar que ninguna fase revienta y que los textos/datos salen completos
// (sin "undefined", "NaN" ni "[object Object]").
//
// Se compila aparte del bundle de la app:
//   npx vite build --ssr scripts/ssr/career-ui-entry.jsx --outDir tmp/ssr-ui --emptyOutDir true
// ============================================================================

import { renderToStaticMarkup } from 'react-dom/server';

import CareerSetup from '../../src/features/career/components/CareerSetup.jsx';
import CareerHeader from '../../src/features/career/components/CareerHeader.jsx';
import CareerOverview from '../../src/features/career/components/CareerOverview.jsx';
import CareerPlayerCard from '../../src/features/career/components/CareerPlayerCard.jsx';
import CareerSeasonReport from '../../src/features/career/components/CareerSeasonReport.jsx';
import CareerEvent from '../../src/features/career/components/CareerEvent.jsx';
import CareerDecision from '../../src/features/career/components/CareerDecision.jsx';
import TransferOffers from '../../src/features/career/components/TransferOffers.jsx';
import YouthOffers from '../../src/features/career/components/YouthOffers.jsx';
import CareerDestinations from '../../src/features/career/components/CareerDestinations.jsx';
import CareerHistory from '../../src/features/career/components/CareerHistory.jsx';
import CareerTimeline from '../../src/features/career/components/CareerTimeline.jsx';
import ClubBadge from '../../src/features/career/components/ClubBadge.jsx';
import CareerTrophyToast from '../../src/features/career/components/CareerTrophyToast.jsx';

const noop = () => {};

/** Renderiza un componente y devuelve siempre un string (nunca lanza). */
export function render(name, element) {
  try {
    const html = renderToStaticMarkup(element);
    return { name, ok: true, html };
  } catch (error) {
    return { name, ok: false, html: '', error: String((error && error.message) || error) };
  }
}

export const renderSetup = (props = {}) => render('CareerSetup', (
  <CareerSetup
    onBack={noop}
    onStart={noop}
    stoppedReason={props.stoppedReason || null}
    draftName={props.draftName || 'Alan'}
    onDraftName={noop}
    difficulty={props.difficulty || 'normal'}
    onDifficulty={noop}
    seedInput="2026"
    onSeedInput={noop}
    busy={Boolean(props.busy)}
  />
));

export const renderHeader = (career, phase) => render('CareerHeader', (
  <CareerHeader career={career} phase={phase} onBack={noop} onNavigate={noop} />
));

export const renderOverview = (career) => render('CareerOverview', (<CareerOverview career={career} />));

export const renderPlayerCard = (career, isRetired = false) => render('CareerPlayerCard', (
  <CareerPlayerCard career={career} isRetired={isRetired} />
));

export const renderSeasonReport = (report, retirementDue = false, compact = false) => render('CareerSeasonReport', (
  <CareerSeasonReport report={report} retirementDue={retirementDue} compact={compact} />
));

export const renderEvent = (currentEvent, hideCategory = false) => render('CareerEvent', (
  <CareerEvent currentEvent={currentEvent} onChoose={noop} busy={false} hideCategory={hideCategory} />
));

export const renderDecision = (options, retirementDue = false) => render('CareerDecision', (
  <CareerDecision options={options} retirementDue={retirementDue} onAction={noop} busy={false} />
));

export const renderTransferOffers = (offers) => render('TransferOffers', (
  <TransferOffers offers={offers} onAccept={noop} busy={false} />
));

export const renderYouthOffers = (offers) => render('YouthOffers', (
  <YouthOffers offers={offers} onChoose={noop} busy={false} />
));

export const renderDestinations = (props = {}) => render('CareerDestinations', (
  <CareerDestinations
    career={props.career}
    offers={props.offers || []}
    options={props.options || []}
    retirementDue={Boolean(props.retirementDue)}
    onStay={noop}
    onAccept={noop}
    onRetire={noop}
    busy={props.busy || false}
  />
));

export const renderHistory = (career, forceOpen = false) => render('CareerHistory', (
  <CareerHistory career={career} forceOpen={forceOpen} defaultOpen />
));

export const renderTimeline = (career, phase) => render('CareerTimeline', (
  <CareerTimeline career={career} phase={phase} />
));

export const renderBadge = (club, size = 'sm') => render('ClubBadge', (<ClubBadge club={club} size={size} />));

export const renderTrophyToast = (trophies) => render('CareerTrophyToast', (
  <CareerTrophyToast trophies={trophies} onFinish={noop} />
));
