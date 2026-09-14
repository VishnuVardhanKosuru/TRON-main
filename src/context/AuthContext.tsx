"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  fetchSession,
  onUserChanged,
  getCurrentUser,
  hasResolved,
  type TronUser,
} from "@/lib/tron/session";

interface AuthContextType {
  user: TronUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TronUser | null>(getCurrentUser());
  const [loading, setLoading] = useState(!hasResolved());

  useEffect(() => {
    const unsub = onUserChanged((u) => {
      setUser(u);
      setLoading(false);
    });

    // Ask the Redmi whether this device still holds a valid session cookie.
    void fetchSession().finally(() => setLoading(false));

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
