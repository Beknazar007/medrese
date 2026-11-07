import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type CurrentUser } from "../api/client";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Only a stored token needs checking with the server; without one we know right away.
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem("access_token")));

  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;
    api
      .get<CurrentUser>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("access_token"))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("password", password);
    const { data } = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("access_token", data.access_token);
    const me = await api.get<CurrentUser>("/auth/me");
    setUser(me.data);
    return me.data;
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  async function refreshUser() {
    const me = await api.get<CurrentUser>("/auth/me");
    setUser(me.data);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
