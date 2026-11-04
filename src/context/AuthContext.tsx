"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ActionResult, User } from "@/types";
import {
  api,
  clearTokens,
  errorMessage,
  getRefreshToken,
  refreshSession,
  setAuthLostHandler,
  setTokens,
} from "@/lib/api";
import { type ApiUser, toUser } from "@/lib/mappers";

interface SignupInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ProfileUpdates {
  name?: string;
  bio?: string;
}

/** Like ActionResult, but tells the caller who signed in so it can route teachers to /teach. */
export type LoginResult =
  | { ok: true; role: User["role"]; mustChangePassword: boolean }
  | { ok: false; error: string };

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signup: (input: SignupInput) => Promise<ActionResult>;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<ActionResult>;
  /** Re-read the signed-in user from the server (e.g. after a password change). */
  refreshUser: () => Promise<void>;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: ApiUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session from the stored refresh token.
  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    let cancelled = false;
    (async () => {
      if (getRefreshToken() && (await refreshSession())) {
        try {
          const me = await api<ApiUser>("/users/me/");
          if (!cancelled) setUser(toUser(me));
        } catch {
          // Signed out or server unreachable: continue as a guest.
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      setAuthLostHandler(null);
    };
  }, []);

  const startSession = useCallback((res: AuthResponse) => {
    setTokens(res.access, res.refresh);
    setUser(toUser(res.user));
  }, []);

  const signup = useCallback(
    async (input: SignupInput): Promise<ActionResult> => {
      try {
        startSession(await api<AuthResponse>("/auth/register/", { method: "POST", body: input }));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [startSession]
  );

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      try {
        const res = await api<AuthResponse>("/auth/login/", { method: "POST", body: input });
        startSession(res);
        const signedIn = toUser(res.user);
        return { ok: true, role: signedIn.role, mustChangePassword: signedIn.mustChangePassword };
      } catch (err) {
        return { ok: false, error: errorMessage(err, "Invalid email or password.") };
      }
    },
    [startSession]
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    setUser(null);
    if (refresh) {
      // Revoke the refresh token server-side; sign out locally even if this fails.
      await api("/auth/logout/", { method: "POST", body: { refresh } }).catch(() => undefined);
    }
    clearTokens();
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdates): Promise<ActionResult> => {
    try {
      const me = await api<ApiUser>("/users/me/", { method: "PATCH", body: updates });
      setUser(toUser(me));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(toUser(await api<ApiUser>("/users/me/")));
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, signup, login, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
