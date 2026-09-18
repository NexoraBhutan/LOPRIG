import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "loprig_user";
const USERS_KEY = "loprig_users";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setUser(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = (u) => {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const signup = ({ name, email, password }) => {
    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const newUser = {
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
  };

  const login = ({ email, password }) => {
    const users = readUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { ok: false, error: "Invalid email or password." };
    persist(publicUser(found));
    return { ok: true };
  };

  const logout = () => persist(null);

  const updateProfile = (updates) => {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates };
      writeUsers(users);
      persist(publicUser(users[idx]));
    }
  };

  return (
    <AuthContext.Provider value={{ user, ready, signup, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

function publicUser(u) {
  const { password: _password, ...rest } = u;
  return rest;
}

function pickColor(seed = "") {
  const palette = ["#ffb606", "#1a1a1a", "#c88e00", "#3a3a3a", "#ff6347"];
  const idx = seed.length ? seed.charCodeAt(0) % palette.length : 0;
  return palette[idx];
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
