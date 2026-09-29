import { useEffect, useRef } from 'react';

import { useAuth } from './AuthContext.jsx';

export default function GoogleButton({ onSignedIn }) {
  const { googleClientId, apiUp, loginWithGoogle } = useAuth();
  const slot = useRef(null);

  useEffect(() => {
    if (!googleClientId || !slot.current) return undefined;
    let cancelled = false;

    const start = () => {
      const google = window.google?.accounts?.id;
      if (!google || cancelled) return false;
      slot.current.innerHTML = '';
      google.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          try {
            await loginWithGoogle(credential);
            onSignedIn?.();
          } catch (err) {
            window.alert(err.message || 'No se pudo entrar con Google');
          }
        },
        auto_select: false,
        ux_mode: 'popup',
      });
      google.renderButton(slot.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280,
      });
      return true;
    };

    if (start()) return () => { cancelled = true; };

    const timer = window.setInterval(() => {
      if (start()) window.clearInterval(timer);
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [googleClientId, loginWithGoogle, onSignedIn]);

  if (!apiUp) {
    return <p className="auth-missing">La API no está levantada.</p>;
  }
  if (!googleClientId) {
    return <p className="auth-missing">Falta configurar Google en el servidor.</p>;
  }

  return <div className="google-btn-slot" ref={slot} />;
}
