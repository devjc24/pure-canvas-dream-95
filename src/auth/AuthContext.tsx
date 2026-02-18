import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const TOKEN_KEY = "authToken";
const LAST_ACTIVE_KEY = "lastActiveAt";
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

type AuthUser = {
  email?: string;
  name?: string;
  role?: string;
  exp?: number;
  cpf?: string;
};

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseToken(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded as AuthUser;
  } catch {
    return null;
  }
}

function isTokenValid(token: string | null) {
  if (!token) return false;
  const payload = parseToken(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<AuthUser | null>(() => (token ? parseToken(token) : null));
  const isAuthenticated = isTokenValid(token);
  const idleTimerRef = useRef<number | null>(null);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) return;
    setUser(parseToken(token));
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const markActive = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    };

    const checkIdle = () => {
      const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || Date.now());
      if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
        logout();
      }
    };

    markActive();
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive));
    idleTimerRef.current = window.setInterval(checkIdle, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      if (idleTimerRef.current) {
        window.clearInterval(idleTimerRef.current);
      }
    };
  }, [isAuthenticated]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      user,
      token,
      login: (nextToken) => {
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
        setToken(nextToken);
        setUser(parseToken(nextToken));
      },
      logout,
    }),
    [isAuthenticated, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
