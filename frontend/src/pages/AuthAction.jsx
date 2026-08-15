import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset } from 'firebase/auth';
import { firebaseAuth, firebaseConfigured } from '../firebase.js';

const actionParameters = (search) => {
  const values = new URLSearchParams(search);
  return { mode: values.get('mode'), code: values.get('oobCode') };
};

export const AuthAction = () => {
  const location = useLocation();
  const { mode, code } = actionParameters(location.search);
  const [status, setStatus] = useState('ready');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const canHandle = firebaseConfigured && ['verifyEmail', 'resetPassword'].includes(mode) && Boolean(code);
  const isReset = mode === 'resetPassword';

  const verify = async () => {
    setStatus('working');
    setError('');
    try {
      await applyActionCode(firebaseAuth, code);
      setStatus('complete');
    } catch {
      setStatus('failed');
      setError('This verification link is invalid or has expired. Return to sign in and request a new email.');
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (password.length < 12 || password.length > 128) {
      setError('Use a password between 12 and 128 characters.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('The passwords do not match.');
      return;
    }
    setStatus('working');
    setError('');
    try {
      await confirmPasswordReset(firebaseAuth, code, password);
      setStatus('complete');
    } catch {
      setStatus('failed');
      setError('This password-reset link is invalid or has expired. Request a new reset email and try again.');
    }
  };

  const content = !firebaseConfigured
    ? { title: 'Verification is unavailable', copy: 'Email verification is not configured for this environment.' }
    : !['verifyEmail', 'resetPassword'].includes(mode) || !code
      ? { title: 'Invalid verification link', copy: 'This link is incomplete or no longer valid.' }
      : status === 'complete'
        ? { title: isReset ? 'Password updated' : 'Email verified', copy: isReset ? 'Your password has been reset. You can now sign in to Relay.' : 'Your email address has been confirmed. You can now sign in to Relay.' }
        : isReset
          ? { title: 'Choose a new password', copy: 'Set a new password for your Relay account.' }
          : { title: 'Verify your email', copy: 'Confirm your email address to finish setting up your Relay workspace.' };

  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_rgba(28,125,242,0.24),_transparent_45%),#06172d] px-5">
    <section className="w-full max-w-md panel p-7 sm:p-9">
      <div className="flex items-center gap-2 text-xl font-semibold"><img className="h-9 w-9 object-contain" src="/relay-mark.png" alt="" />Relay</div>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">{content.copy}</p>
      {error && <p className="mt-5 text-sm text-rose-200" role="alert">{error}</p>}
      {canHandle && !isReset && status === 'ready' && <button className="btn-primary mt-7 w-full" onClick={verify}>Verify email</button>}
      {canHandle && !isReset && status === 'working' && <button className="btn-primary mt-7 w-full" disabled>Verifying…</button>}
      {canHandle && isReset && status === 'ready' && <form className="mt-7 space-y-4" onSubmit={resetPassword}><label className="block"><span className="label">New password</span><input className="field" type="password" autoComplete="new-password" minLength="12" maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="block"><span className="label">Confirm new password</span><input className="field" type="password" autoComplete="new-password" minLength="12" maxLength="128" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required /></label><p className="text-xs leading-5 text-slate-500">Use 12–128 characters. Your account password policy may require more.</p><button className="btn-primary w-full">Reset password</button></form>}
      {canHandle && isReset && status === 'working' && <button className="btn-primary mt-7 w-full" disabled>Resetting password…</button>}
      {(status === 'complete' || status === 'failed' || !canHandle) && <Link className="btn-primary mt-7 w-full" to="/login">Return to sign in</Link>}
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">For your security, this confirmation link can be used only once.</p>
    </section>
  </div>;
};
