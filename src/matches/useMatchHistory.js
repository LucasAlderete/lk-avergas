import { useCallback, useEffect, useState } from 'react';

import { readJSON } from '../auth/AuthContext.jsx';

export default function useMatchHistory({ eager = true } = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(eager);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readJSON('/api/history');
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (err) {
      setMatches([]);
      setError(err.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { matches, loading, error, reload: load };
}
