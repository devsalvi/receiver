import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentSession, signIn as cognitoSignIn, signOut as cognitoSignOut, completeNewPassword as cognitoCompleteNewPassword } from './auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSession()
      .then(session => setUser(session))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const session = await cognitoSignIn(email, password);
    setUser(session);
    return session;
  };

  const completeNewPassword = async (cognitoUser, newPassword) => {
    const session = await cognitoCompleteNewPassword(cognitoUser, newPassword);
    setUser(session);
    return session;
  };

  const logout = () => {
    cognitoSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, completeNewPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
