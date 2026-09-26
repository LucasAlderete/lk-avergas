import GoogleButton from './GoogleButton.jsx';
import { useAuth } from './AuthContext.jsx';

export default function AccountBar({ compact = false }) {
  const { user, ready, logout } = useAuth();

  if (!ready) return <div className="account-bar account-bar--pending" aria-hidden="true" />;

  if (!user) {
    return (
      <div className={`account-bar${compact ? ' account-bar--compact' : ''}`}>
        <GoogleButton />
      </div>
    );
  }

  return (
    <div className={`account-bar is-in${compact ? ' account-bar--compact' : ''}`}>
      {user.picture
        ? <img className="account-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        : <span className="account-avatar is-fallback" aria-hidden="true">{user.name.slice(0, 1)}</span>}
      <span className="account-copy">
        <strong>{user.name}</strong>
        {!compact && <small>{user.email}</small>}
      </span>
      <button type="button" className="account-logout" onClick={() => logout()}>
        Salir
      </button>
    </div>
  );
}
