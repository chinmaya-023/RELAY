import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { authActionSettings, firebaseAuth } from '../firebase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

export const ForgotPassword = () => {
  const { firebaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [working, setWorking] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setWorking(true);
    try { await sendPasswordResetEmail(firebaseAuth, email, authActionSettings); } catch { /* Preserve a uniform response to avoid account enumeration. */ }
    finally { setSubmitted(true); setWorking(false); }
  };
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_rgba(28,125,242,0.24),_transparent_45%),#06172d] px-5"><section className="w-full max-w-md panel p-7 sm:p-9"><div className="flex items-center gap-2 text-xl font-semibold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-relay-500">R</span>Relay</div><h1 className="mt-8 text-2xl font-semibold tracking-tight">Reset your password</h1>{submitted ? <div className="mt-4 space-y-5"><p className="text-sm leading-6 text-slate-300">If this email is eligible for recovery, you will receive a secure password-reset email shortly.</p><Link className="btn-primary w-full" to="/login">Return to sign in</Link></div> : <><p className="mt-2 text-sm leading-6 text-slate-400">Enter your work email and we’ll send recovery instructions if an account is available.</p>{firebaseConfigured ? <form className="mt-7 space-y-5" onSubmit={submit}><label className="block"><span className="label">Email address</span><input className="field" autoComplete="email" type="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="btn-primary w-full" disabled={working}>{working ? 'Sending…' : 'Send reset email'}</button></form> : <p className="mt-6 text-sm text-amber-100">Authentication is not configured for this environment.</p>}<p className="mt-6 text-center text-sm text-slate-400"><Link className="font-semibold text-relay-400 hover:text-relay-300" to="/login">Return to sign in</Link></p></>}</section></div>;
};
