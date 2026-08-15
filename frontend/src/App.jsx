import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { AppLayout } from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';

const page = (load, name) => lazy(async () => ({ default: (await load())[name] }));
const LandingPage = page(() => import('./pages/LandingPage.jsx'), 'LandingPage');
const AuthPage = page(() => import('./pages/AuthPage.jsx'), 'AuthPage');
const ForgotPassword = page(() => import('./pages/ForgotPassword.jsx'), 'ForgotPassword');
const EmailVerification = page(() => import('./pages/EmailVerification.jsx'), 'EmailVerification');
const AuthAction = page(() => import('./pages/AuthAction.jsx'), 'AuthAction');
const Dashboard = page(() => import('./pages/Dashboard.jsx'), 'Dashboard');
const Projects = page(() => import('./pages/Dashboard.jsx'), 'Projects');
const ProjectWorkspace = page(() => import('./pages/ProjectWorkspace.jsx'), 'ProjectWorkspace');
const ApiKeys = page(() => import('./pages/GeneralPages.jsx'), 'ApiKeys');
const Settings = page(() => import('./pages/GeneralPages.jsx'), 'Settings');
const AdminWorkspace = page(() => import('./pages/AdminWorkspace.jsx'), 'AdminWorkspace');

const Protected = ({ children }) => {
  const { user, firebaseConfigured } = useAuth();
  if (!firebaseConfigured) return <Navigate to="/login" replace />;
  if (user === undefined) return <Loading label="Restoring your Relay session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return user.emailVerified ? <AppLayout>{children}</AppLayout> : <EmailVerification />;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined) return <Loading label="Preparing your Relay session…" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  return <Suspense fallback={<Loading label="Loading Relay..." />}><Routes>
    <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
    <Route path="/login" element={<PublicOnly><AuthPage /></PublicOnly>} />
    <Route path="/register" element={<PublicOnly><AuthPage register /></PublicOnly>} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/auth/action" element={<AuthAction />} />
    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
    <Route path="/projects" element={<Protected><Projects /></Protected>} />
    <Route path="/projects/:projectId/*" element={<Protected><ProjectWorkspace /></Protected>} />
    <Route path="/api-keys" element={<Protected><ApiKeys /></Protected>} />
    <Route path="/settings" element={<Protected><Settings /></Protected>} />
    <Route path="/admin" element={<Protected><AdminWorkspace /></Protected>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></Suspense>;
}
