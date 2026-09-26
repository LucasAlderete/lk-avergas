import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function readJSON(url, opts) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción');
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [config, me] = await Promise.all([
        readJSON('/api/config'),
        readJSON('/api/auth/me'),
      ]);
      setGoogleClientId(config.googleClientId || '');
      setUser(me.user || null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await readJSON('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    setUser(data.user || null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await readJSON('/api/auth/logout', { method: 'POST' });
    } catch {
      // Si el API no responde igual cerramos la sesión local.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, googleClientId, ready, refresh, loginWithGoogle, logout }),
    [user, googleClientId, ready, refresh, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth necesita AuthProvider');
  return ctx;
}

export function useIsAdmin() {
  const ctx = useContext(AuthContext);
  return Boolean(ctx?.user?.isAdmin);
}

export { readJSON };
