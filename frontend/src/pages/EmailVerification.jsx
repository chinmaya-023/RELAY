import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { authActionSettings, firebaseAuth } from '../firebase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { authMessage } from '../auth/messages.js';

export const EmailVerification = () => {
  const { user, refreshUser } = useAuth(); const navigate = useNavigate(); const [notice, setNotice] = useState('We sent a verification email when you created your account.'); const [working, setWorking] = useState(false);
  const resend = async () => { setWorking(true); try { await sendEmailVerification(user, authActionSettings); setNotice('A new verification email has been sent. Please check your inbox and spam folder.'); } catch (error) { setNotice(authMessage(error, 'We could not send another verification email yet. Please wait and try again.')); } finally { setWorking(false); } };
  const confirm = async () => { setWorking(true); try { const refreshed = await refreshUser(); if (refreshed?.emailVerified) { setNotice('Your email is verified. Loading your workspace…'); navigate('/dashboard', { replace: true }); } else setNotice('Your email is not verified yet. Open the verification email, then try again.'); } finally { setWorking(false); } };
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_rgba(28,125,242,0.24),_transparent_45%),#06172d] px-5"><section className="w-full max-w-md panel p-7 sm:p-9"><div className="flex items-center gap-2 text-xl font-semibold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-relay-500">R</span>Relay</div><h1 className="mt-8 text-2xl font-semibold tracking-tight">Verify your email address</h1><p className="mt-2 text-sm leading-6 text-slate-400">For your protection, email-and-password accounts must be verified before they can access Relay.</p><p className="mt-5 rounded-xl border border-sky-300/20 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100" role="status">{notice}</p><div className="mt-6 grid gap-3"><button className="btn-primary" onClick={confirm} disabled={working}>I have verified my email</button><button className="btn-secondary" onClick={resend} disabled={working}>Resend verification email</button><button className="text-sm font-medium text-slate-400 hover:text-white" onClick={() => signOut(firebaseAuth)} disabled={working}>Use a different account</button></div></section></div>;
};
