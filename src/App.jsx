import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import CareerScreen from './features/career/components/CareerScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import LineupScreen from './components/LineupScreen.jsx';
import SquadScreen from './components/SquadScreen.jsx';
import { isAppScreen, resolveStoredScreen, transitionScreen } from './navigation.js';

function loadScreen() {
  try {
    return resolveStoredScreen(globalThis.localStorage?.getItem('avergas-screen'));
  } catch {
    return 'home';
  }
}

export default function App() {
  const [screen, setScreen] = useState(loadScreen);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem('avergas-screen', screen);
    } catch {
      // La app también funciona cuando el navegador bloquea el storage.
    }
  }, [screen]);

  const navigate = (nextScreen) => {
    if (isAppScreen(nextScreen)) setScreen((currentScreen) => transitionScreen(currentScreen, nextScreen));
  };

  let content;
  if (screen === 'career') {
    content = <CareerScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'squad') {
    content = <SquadScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'lineup') {
    content = <LineupScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else {
    content = <HomeScreen onNavigate={navigate} />;
  }

  return (
    <div className="app-shell" data-screen={screen}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen}
          className="app-screen"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { HomeScreen, SquadScreen, LineupScreen };
