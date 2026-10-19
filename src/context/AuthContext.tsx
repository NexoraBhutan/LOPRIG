"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ActionResult, StoredUser, User } from "@/types";
import { safeParseJSON, safeRemoveItem, safeSetItem } from "@/utils/storage";

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

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signup: (input: SignupInput) => ActionResult;
  login: (input: LoginInput) => ActionResult;
  logout: () => void;
  updateProfile: (updates: ProfileUpdates) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "loprig_user";
const USERS_KEY = "loprig_users";

function readUsers(): StoredUser[] {
  return safeParseJSON<StoredUser[]>(USERS_KEY, []);
}

function writeUsers(users: StoredUser[]): void {
  safeSetItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = safeParseJSON<User | null>(STORAGE_KEY, null);
    if (saved) setUser(saved);
    setReady(true);
  }, []);

  const persist = useCallback((u: User | null) => {
    setUser(u);
    if (u) safeSetItem(STORAGE_KEY, JSON.stringify(u));
    else safeRemoveItem(STORAGE_KEY);
  }, []);

  const signup = useCallback(
    ({ name, email, password }: SignupInput): ActionResult => {
      const users = readUsers();
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return { ok: false, error: "An account with this email already exists." };
      }
      const newUser: StoredUser = {
        id: `u_${Date.now()}`,
        name,
        email,
        password,
        bio: "Lifelong learner exploring new skills on Lop-rig.",
        avatarColor: pickColor(name),
        joined: new Date().toISOString(),
      };
      writeUsers([...users, newUser]);
      persist(publicUser(newUser));
      return { ok: true };
    },
    [persist]
  );

  const login = useCallback(
    ({ email, password }: LoginInput): ActionResult => {
      const users = readUsers();
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!found) return { ok: false, error: "Invalid email or password." };
      persist(publicUser(found));
      return { ok: true };
    },
    [persist]
  );

  const logout = useCallback(() => persist(null), [persist]);

  const updateProfile = useCallback(
    (updates: ProfileUpdates) => {
      const users = readUsers();
      const idx = users.findIndex((u) => u.id === user?.id);
      if (idx > -1) {
        users[idx] = { ...users[idx], ...updates };
        writeUsers(users);
        persist(publicUser(users[idx]));
      }
    },
    [user?.id, persist]
  );

  return (
    <AuthContext.Provider value={{ user, ready, signup, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

function publicUser(u: StoredUser): User {
  const { password: _password, ...rest } = u;
  return rest;
}

function pickColor(seed = ""): string {
  const palette = ["#ffb606", "#1a1a1a", "#c88e00", "#3a3a3a", "#ff6347"];
  const idx = seed.length ? seed.charCodeAt(0) % palette.length : 0;
  return palette[idx];
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}