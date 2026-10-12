import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from './auth/AuthContext.jsx';
import AdminScreen from './components/AdminScreen.jsx';
import CareerScreen from './features/career/components/CareerScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import LineupScreen from './components/LineupScreen.jsx';
import MatchHistoryScreen from './components/MatchHistoryScreen.jsx';
import SquadScreen from './components/SquadScreen.jsx';
import { resolveStoredScreen, transitionScreen } from './navigation.js';
import { DevDataToggle } from './dev/worstCase.jsx';

function loadScreen() {
  try {
    const saved = globalThis.localStorage?.getItem('avergas-screen');
    if (saved === 'admin') return 'admin';
    return resolveStoredScreen(saved);
  } catch {
    return 'home';
  }
}

export default function App() {
  const { user, ready } = useAuth();
  const [screen, setScreen] = useState(loadScreen);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem('avergas-screen', screen);
    } catch {
      // La app también funciona cuando el navegador bloquea el storage.
    }
  }, [screen]);

  useEffect(() => {
    if (!ready) return;
    if (screen === 'admin' && !user?.isAdmin) setScreen('home');
  }, [ready, screen, user]);

  const navigate = (nextScreen) => {
    setScreen((currentScreen) => transitionScreen(currentScreen, nextScreen, user));
  };

  let content;
  if (screen === 'career') {
    content = <CareerScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'squad') {
    content = <SquadScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'lineup') {
    content = <LineupScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'history') {
    content = <MatchHistoryScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else if (screen === 'admin') {
    content = <AdminScreen onBack={() => navigate('home')} onNavigate={navigate} />;
  } else {
    content = <HomeScreen onNavigate={navigate} />;
  }

  return (
    <div className="app-shell" data-screen={screen}>
      {/* Sin salida ni mode="wait": la pantalla nueva aparece al instante con un
          fundido corto. Esperar la salida sumaba ~360ms a cada navegación. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={screen}
          className="app-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      <DevDataToggle />
    </div>
  );
}

export { HomeScreen, SquadScreen, LineupScreen };
