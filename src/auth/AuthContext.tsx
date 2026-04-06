import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { IngelogdeGebruiker } from '../types';
import { loginViaApi, refreshAuthenticatedUser } from '../lib/auth';

const storageKey = 'notes.auth.user';

interface AuthContextValue {
  user: IngelogdeGebruiker | null;
  loading: boolean;
  login: (gebruikersnaam: string, wachtwoord: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): IngelogdeGebruiker | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as IngelogdeGebruiker;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<IngelogdeGebruiker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = readStoredUser();
    setUser(storedUser);
    setLoading(false);

    if (!storedUser) {
      return;
    }

    void (async () => {
      const refreshedUser = await refreshAuthenticatedUser(storedUser);
      setUser(refreshedUser);
      localStorage.setItem(storageKey, JSON.stringify(refreshedUser));
    })();
  }, []);

  const login = async (gebruikersnaam: string, wachtwoord: string) => {
    const loggedInUser = await loginViaApi(gebruikersnaam, wachtwoord);
    setUser(loggedInUser);
    localStorage.setItem(storageKey, JSON.stringify(loggedInUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(storageKey);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth moet binnen AuthProvider gebruikt worden.');
  }
  return context;
}
