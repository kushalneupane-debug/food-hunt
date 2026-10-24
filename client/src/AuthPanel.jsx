import { useEffect, useState } from 'react';
import { getProfile, loginAccount, registerAccount, requestSignupCode, verifySignupCode } from './auth-api';

export default function AuthPanel({ screen, user, onClose, onScreenChange, onLogin, onLogout }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState('details');
  const [channel, setChannel] = useState('email');
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [verificationToken, setVerificationToken] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const isSignUp = screen === 'signup';
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));

  useEffect(() => {
    if (!isSignUp || step !== 'code') return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isSignUp, step]);

  function startCooldown(seconds) {
    const timestamp = Date.now();
    setClock(timestamp);
    setResendAt(timestamp + seconds * 1000);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!isSignUp) {
        const session = await loginAccount({ [channel]: fields.get(channel), password: fields.get('password') });
        const profile = await getProfile(session.token);
        onLogin({ token: session.token, user: profile.user });
      } else if (step === 'details') {
        const value = fields.get(channel).trim();
        const details = { name: fields.get('name').trim(), [channel]: channel === 'email' ? value.toLowerCase() : value.replace(/[ ()-]/g, '') };
        const response = await requestSignupCode(details);
        setContact(details);
        setVerificationToken('');
        startCooldown(response.retryAfter);
        setStep('code');
        setNotice(channel === 'phone' ? 'Code sent. Check your text messages.' : 'Code sent. Check your inbox and spam folder.');
      } else if (step === 'code') {
        const response = await verifySignupCode({ [channel]: contact[channel], code: fields.get('code') });
        setVerificationToken(response.verificationToken);
        setStep('password');
        setNotice(`${channel === 'phone' ? 'Phone number' : 'Email'} verified. Set your password within 10 minutes.`);
      } else {
        const password = fields.get('password');
        if (password !== fields.get('confirmPassword')) throw new Error('Passwords do not match.');
        if (new TextEncoder().encode(password).length > 72) throw new Error('Password must not exceed 72 UTF-8 bytes.');
        await registerAccount({ [channel]: contact[channel], password, verificationToken });
        form.reset();
        setVerificationToken('');
        setStep('details');
        setContact({ name: '', email: '', phone: '' });
        onScreenChange('signin');
        setNotice(`Account created. Sign in with your ${channel === 'phone' ? 'phone number' : 'email'} and password.`);
      }
    } catch (failure) {
      setError(failure.message);
      if (failure.retryAfter) startCooldown(failure.retryAfter);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await requestSignupCode(contact);
      startCooldown(response.retryAfter);
      setNotice(channel === 'phone' ? 'Code sent again. Check your text messages.' : 'A new code was sent. Use the latest email.');
    } catch (failure) {
      setError(failure.message);
      if (failure.retryAfter) startCooldown(failure.retryAfter);
    } finally { setBusy(false); }
  }

  function resetSignup() {
    setStep('details');
    setVerificationToken('');
    setError('');
    setNotice('');
  }

  function switchScreen() {
    resetSignup();
    onScreenChange(isSignUp ? 'signin' : 'signup');
  }

  const title = !isSignUp ? 'Welcome Back' : step === 'code' ? (channel === 'phone' ? 'Verify Your Phone' : 'Verify Your Email') : step === 'password' ? 'Set Your Password' : 'Create Account';
  const maskedContact = channel === 'phone' ? `••••${(contact.phone || '').slice(-4)}` : (contact.email || '').replace(/^(.).*(@.*)$/, '$1***$2');

  return (
    <main className="auth-page">
      <div className="auth-card">
        <button type="button" className="auth-back" disabled={busy} onClick={onClose}>← Back to Home</button>
        <div className="auth-logo">🍲 Food Hunt</div>
        {screen === 'profile' && user ? (
          <>
            <h2>Your Profile</h2>
            <dl className="profile-details">
              <dt>Name</dt><dd>{user.name}</dd>
              {user.email && <><dt>Email</dt><dd>{user.email}</dd></>}
              {user.phone && <><dt>Phone</dt><dd>{user.phone}</dd></>}
              <dt>Role</dt><dd>{user.role}</dd>
            </dl>
            <button type="button" className="auth-submit" onClick={onLogout}>Sign Out</button>
          </>
        ) : (
          <>
            <h2>{title}</h2>
            <p>{!isSignUp ? 'Sign in to your Food Hunt account.' : step === 'code' ? `Enter the six-digit code sent to ${maskedContact}. It expires in 10 minutes.` : step === 'password' ? 'Your contact is verified. Choose a password to finish.' : 'Choose email or phone, then verify it before setting a password.'}</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {(!isSignUp || step === 'details') && <fieldset className="auth-contact-choice" disabled={busy}>
              <legend>{isSignUp ? 'Create account with' : 'Sign in with'}</legend>
              {['email', 'phone'].map(option => <label key={option}>
                <input type="radio" name="contactMethod" value={option} checked={channel === option}
                  onChange={() => { setChannel(option); resetSignup(); setContact({ name: '', email: '', phone: '' }); }} />
                {option === 'email' ? 'Email' : 'Phone number'}
              </label>)}
            </fieldset>}
            <form key={`${screen}-${step}-${channel}`} onSubmit={handleSubmit} aria-busy={busy}>
              {isSignUp && step === 'details' && (
                <label>Full Name
                  <input name="name" type="text" autoComplete="name" minLength={2} maxLength={120}
                    defaultValue={contact.name} placeholder="Enter your full name" required disabled={busy} />
                </label>
              )}
              {(!isSignUp || step === 'details') && (<>
                <label>{channel === 'phone' ? 'Phone number (include country code)' : 'Email'}
                  <input name={channel} type={channel === 'phone' ? 'tel' : 'email'}
                    autoComplete={channel === 'phone' ? 'tel' : 'email'} maxLength={channel === 'phone' ? 40 : 254}
                    pattern={channel === 'phone' ? "\\+[0-9 \\(\\)\\-]{8,39}" : undefined}
                    defaultValue={contact[channel] || ''} placeholder={channel === 'phone' ? '+1 202 555 0123' : 'Enter your email'}
                    aria-describedby={channel === 'phone' ? 'phone-help' : undefined} required disabled={busy} />
                </label>
                  {channel === 'phone' && <small id="phone-help">Start with + and your country code: +1 for USA, +977 for Nepal.
                    {isSignUp && ' By sending a code, you agree to receive an account verification text. Message and data rates may apply.'}</small>}
              </>)}
              {isSignUp && step === 'code' && (
                <label>Verification Code
                  <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
                    pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="123456" required disabled={busy} />
                </label>
              )}
              {(!isSignUp || step === 'password') && (
                <label>Password
                  <input name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    minLength={isSignUp ? 8 : 1} placeholder="Enter your password" required disabled={busy} />
                </label>
              )}
              {isSignUp && step === 'password' && <>
                <label>Confirm Password
                  <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy} />
                </label>
                <small>Use at least 8 characters, up to 72 UTF-8 bytes.</small>
              </>}
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Please wait…' : !isSignUp ? 'Sign In' : step === 'details' ? 'Send Verification Code' : step === 'code' ? 'Verify Code' : 'Create Account'}
              </button>
            </form>
            {isSignUp && step === 'code' && <div className="verification-actions">
              <button type="button" disabled={busy || resendSeconds > 0} onClick={resend}>
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend Code'}
              </button>
              <button type="button" disabled={busy} onClick={resetSignup}>Change {channel === 'phone' ? 'Phone' : 'Email'}</button>
            </div>}
            {isSignUp && step === 'password' && <button className="auth-back" type="button" disabled={busy} onClick={resetSignup}>Start again</button>}
            <p className="auth-switch">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" disabled={busy} onClick={switchScreen}>{isSignUp ? 'Sign In' : 'Create Account'}</button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
