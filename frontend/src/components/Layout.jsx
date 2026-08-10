import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const navigation = [{ to: '/dashboard', label: 'Overview' }, { to: '/projects', label: 'Projects' }, { to: '/api-keys', label: 'API keys' }, { to: '/settings', label: 'Settings' }];
const initials = (user) => (user?.displayName || user?.email || 'R').split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export const AppLayout = ({ children }) => {
  const { user, api } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false);
  const admin = useQuery({ queryKey: ['admin-access', user?.uid], queryFn: () => api.get('/api/admin/access'), retry: false, staleTime: 300_000 });
  const leave = async () => { await signOut(firebaseAuth); navigate('/login'); };
  const links = admin.data?.data?.isRelayAdmin ? [...navigation, { to: '/admin', label: 'Admin' }] : navigation;
  return <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_rgba(28,125,242,0.18),_transparent_36%),linear-gradient(180deg,#06172d_0%,#09152a_100%)]"><header className="border-b border-white/10 bg-[#06172d]/80 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-relay-500 text-lg shadow-lg shadow-relay-500/30">R</span>Relay</Link><div className="relative"><button className="grid h-9 w-9 place-items-center rounded-full bg-relay-500 text-sm font-semibold text-white shadow-lg shadow-relay-500/20 hover:bg-relay-400" onClick={() => setOpen((value) => !value)} aria-label="Open profile menu" aria-expanded={open}>{initials(user)}</button>{open && <div className="absolute right-0 z-20 mt-3 w-72 rounded-xl border border-white/10 bg-[#0b1e39] p-4 shadow-2xl"><p className="font-semibold text-white">{user?.displayName || 'Relay user'}</p><p className="mt-1 truncate text-sm text-slate-400">{user?.email}</p><div className="my-4 border-t border-white/10" /><Link className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10" to="/settings" onClick={() => setOpen(false)}>Profile settings</Link><button className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10" onClick={leave}>Sign out</button></div>}</div></div></header><div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-[180px_1fr]"><nav className="flex gap-2 overflow-auto md:flex-col">{links.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-relay-500 text-white shadow-lg shadow-relay-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{item.label}</NavLink>)}</nav><main className="min-w-0">{children}</main></div></div>;
};
