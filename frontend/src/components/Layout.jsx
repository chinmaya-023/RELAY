import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const navigation = [{ to: '/dashboard', label: 'Overview' }, { to: '/projects', label: 'Projects' }, { to: '/api-keys', label: 'API keys' }, { to: '/settings', label: 'Settings' }];

export const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const leave = async () => { await signOut(firebaseAuth); navigate('/login'); };
  return <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_rgba(28,125,242,0.18),_transparent_36%),linear-gradient(180deg,#06172d_0%,#09152a_100%)]">
    <header className="border-b border-white/10 bg-[#06172d]/80 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-relay-500 text-lg shadow-lg shadow-relay-500/30">R</span>Relay</Link><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-400 sm:block">{user?.email}</span><button className="btn-secondary px-3 py-1.5" onClick={leave}>Sign out</button></div></div></header>
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-[180px_1fr]"><nav className="flex gap-2 overflow-auto md:flex-col">{navigation.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-relay-500 text-white shadow-lg shadow-relay-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{item.label}</NavLink>)}</nav><main className="min-w-0">{children}</main></div>
  </div>;
};
