import { useState } from 'react';
import { getProfile, loginAccount, registerAccount } from './auth-api';

export default function AuthPanel({ screen, user, onClose, onScreenChange, onLogin, onLogout }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isSignUp = screen === 'signup';

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = fields.get('email');
    const password = fields.get('password');
    if (isSignUp && new TextEncoder().encode(password).length > 72) {
      setError('Password must not exceed 72 bytes. Please use a shorter password.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (isSignUp) {
        await registerAccount({ name: fields.get('name').trim(), email, password });
        event.target.reset();
        onScreenChange('signin');
        setNotice('Account created. Sign in with your email and password.');
      } else {
        const session = await loginAccount({ email, password });
        const profile = await getProfile(session.token);
        onLogin({ token: session.token, user: profile.user });
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function switchScreen() {
    setError('');
    setNotice('');
    onScreenChange(isSignUp ? 'signin' : 'signup');
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <button type="button" className="auth-back" disabled={busy} onClick={onClose}>
          ← Back to Home
        </button>
        <div className="auth-logo">🍲 Food Hunt</div>
        {screen === 'profile' && user ? (
          <>
            <h2>Your Profile</h2>
            <dl className="profile-details">
              <dt>Name</dt><dd>{user.name}</dd>
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Role</dt><dd>{user.role}</dd>
            </dl>
            <button type="button" className="auth-submit" onClick={onLogout}>Sign Out</button>
          </>
        ) : (
          <>
            <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{isSignUp ? 'Create an account to get started.' : 'Sign in to your Food Hunt account.'}</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <form key={screen} onSubmit={handleSubmit} aria-busy={busy}>
              {isSignUp && (
                <label>Full Name
                  <input name="name" type="text" autoComplete="name" minLength={2} maxLength={120}
                    placeholder="Enter your full name" required disabled={busy} />
                </label>
              )}
              <label>Email
                <input name="email" type="email" autoComplete="email" maxLength={254}
                  placeholder="Enter your email" required disabled={busy} />
              </label>
              <label>Password
                <input name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={isSignUp ? 8 : 1} placeholder="Enter your password" required disabled={busy} />
              </label>
              {isSignUp && <small>Use at least 8 characters, up to 72 UTF-8 bytes.</small>}
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <p className="auth-switch">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" disabled={busy} onClick={switchScreen}>
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
