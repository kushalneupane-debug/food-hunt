import { useEffect, useRef, useState } from 'react';
import { login, register } from '../api';

// Sign in / Create account. Follows docs/auth.md:
// register returns the new user (no token), so we log in right after.
export default function AuthDialog({ mode, onModeChange, onClose, onSignedIn }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ busy: false, error: '' });
  const firstField = useRef(null);
  const creating = mode === 'register';

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      if (creating) {
        await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      }
      const session = await login({ email: form.email.trim(), password: form.password });
      onSignedIn(session);
    } catch (err) {
      let message = err.message;
      if (err.status === 404) message = 'Accounts are not switched on for this server yet.';
      else if (err.status === 409) message = 'That email already has an account. Sign in instead.';
      else if (err.status === 400 && creating)
        message = 'Use a name of at least 2 letters, a valid email, and a password of 8 or more characters.';
      setStatus({ busy: false, error: message });
    }
  }

  return (
    <div className="drawer-backdrop drawer-backdrop--center" onClick={onClose}>
      <div className="auth" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="auth-title">{creating ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">
          {creating ? 'Save time on reviews and keep track of places you love.' : 'Sign in to review the places you try.'}
        </p>

        <form onSubmit={submit} className="auth__form">
          {creating && (
            <label className="field">
              <span>Name</span>
              <input ref={firstField} value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              ref={creating ? undefined : firstField}
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={creating ? 'new-password' : 'current-password'}
              required
              minLength={8}
            />
            {creating && <small className="muted">At least 8 characters.</small>}
          </label>

          {status.error && (
            <p className="form-status form-status--error" role="alert">
              {status.error}
            </p>
          )}

          <button className="btn btn--primary" type="submit" disabled={status.busy}>
            {status.busy ? 'One moment…' : creating ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth__switch">
          {creating ? 'Already have an account?' : 'New to Food Hunt?'}{' '}
          <button className="linklike" onClick={() => onModeChange(creating ? 'login' : 'register')}>
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <button className="drawer__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
