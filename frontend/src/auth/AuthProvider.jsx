import { createContext, useContext, useEffect, useState } from 'react';
import { browserSessionPersistence, getRedirectResult, onAuthStateChanged, reload, setPersistence } from 'firebase/auth';
import { firebaseAuth, firebaseConfigured } from '../firebase.js';
import { createApiClient } from '../api/client.js';
import { authMessage } from './messages.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const [, setRevision] = useState(0);
  const [authIssue, setAuthIssue] = useState('');
  useEffect(() => {
    if (!firebaseAuth) { setUser(null); return undefined; }
    let unsubscribe;
    const configureAuth = async () => {
      await setPersistence(firebaseAuth, browserSessionPersistence);
      await getRedirectResult(firebaseAuth).catch((error) => setAuthIssue(authMessage(error, 'Google sign-in could not be completed. Please try again.')));
      unsubscribe = onAuthStateChanged(firebaseAuth, setUser);
    };
    configureAuth().catch(() => setUser(null));
    return () => unsubscribe?.();
  }, []);
  const refreshUser = async () => {
    if (!firebaseAuth?.currentUser) return null;
    await reload(firebaseAuth.currentUser);
    await firebaseAuth.currentUser.getIdToken(true);
    setUser(firebaseAuth.currentUser);
    setRevision((value) => value + 1);
    return firebaseAuth.currentUser;
  };
  const value = {
    user,
    firebaseConfigured,
    refreshUser,
    authIssue,
    clearAuthIssue: () => setAuthIssue(''),
    api: createApiClient((forceRefresh = false) => user?.getIdToken(forceRefresh))
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
