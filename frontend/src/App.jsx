import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { AppLayout } from './components/Layout.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { EmailVerification } from './pages/EmailVerification.jsx';
import { AuthAction } from './pages/AuthAction.jsx';
import { Dashboard, Projects } from './pages/Dashboard.jsx';
import { ProjectWorkspace } from './pages/ProjectWorkspace.jsx';
import { ApiKeys, Settings } from './pages/GeneralPages.jsx';
import { AdminWorkspace } from './pages/AdminWorkspace.jsx';
import { Loading } from './components/ui.jsx';

const Protected = ({ children }) => {
  const { user, firebaseConfigured } = useAuth();
  if (!firebaseConfigured) return <Navigate to="/login" replace />;
  if (user === undefined) return <Loading label="Restoring your Relay session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return user.emailVerified ? <AppLayout>{children}</AppLayout> : <EmailVerification />;
};

export default function App() {
  return <Routes><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/auth/action" element={<AuthAction />} /><Route path="/dashboard" element={<Protected><Dashboard /></Protected>} /><Route path="/projects" element={<Protected><Projects /></Protected>} /><Route path="/projects/:projectId/*" element={<Protected><ProjectWorkspace /></Protected>} /><Route path="/api-keys" element={<Protected><ApiKeys /></Protected>} /><Route path="/settings" element={<Protected><Settings /></Protected>} /><Route path="/admin" element={<Protected><AdminWorkspace /></Protected>} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes>;
}
