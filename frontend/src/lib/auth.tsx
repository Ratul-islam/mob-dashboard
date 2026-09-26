"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, onSessionChange, refreshSession, setAccessToken } from "./api";
import type { AuthPayload, User } from "./types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Apply a response that carries a fresh user (and possibly a new access token). */
  applySession: (data: { user: User; accessToken?: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    const off = onSessionChange((payload) => {
      setUser(payload?.user ?? null);
      setStatus(payload ? "authenticated" : "unauthenticated");
    });
    // Restore the session from the refresh cookie on first load.
    refreshSession();
    return () => {
      off();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthPayload>("/auth/login", { method: "POST", body: { email, password } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
    }
  }, [queryClient]);

  const applySession = useCallback((data: { user: User; accessToken?: string }) => {
    if (data.accessToken) setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const value = useMemo(() => ({ user, status, login, logout, applySession }), [user, status, login, logout, applySession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
