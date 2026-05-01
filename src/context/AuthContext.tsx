import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getApiBase } from "@/lib/api";

export type PublicUser = {
  _id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  firstName: string;
  lastName: string;
  phone?: string;
  doctorProfile?: {
    specialty?: string;
    bio?: string;
    qualification?: string;
    yearsOfExperience?: number;
    licenseNumber?: string;
    languagesSpoken?: string[];
    consultationFee?: number;
    hospitalBranch?: string;
    weeklyAvailability?: { day: number; segments: { start: string; end: string }[] }[];
    monthlyAvailability?: { date: string; segments: { start: string; end: string }[] }[];
  };
  patientProfile?: {
    medicalHistoryUploaded?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

type AuthContextValue = {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: FormData | Record<string, unknown>) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) { setUser(null); setLoading(false); return; }
    try {
      const data = await api<{ user: PublicUser }>("/api/auth/me");
      setUser(data.user);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); }, [token, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: PublicUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: FormData | Record<string, unknown>) => {
    const base = getApiBase();
    const registerUrl = `${base}/api/auth/register`;
    const headers: Record<string, string> = {};
    if (!(payload instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(registerUrl, {
      method: "POST",
      headers,
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    });
    const text = await res.text();
    let data: { token?: string; user?: PublicUser; error?: string; errorName?: string } | null = null;
    if (text) {
      try { data = JSON.parse(text) as typeof data; } catch { data = null; }
    }
    if (!res.ok) {
      if (!data && text?.trim().startsWith("<")) {
        throw new Error("Server returned an HTML page instead of JSON. Check Vercel logs.");
      }
      const msg = data?.error
        ? data.errorName ? `${data.error} (${data.errorName})` : data.error
        : text || res.statusText || "Registration failed";
      throw new Error(msg);
    }
    if (!data?.user) throw new Error("Invalid response from server");
    // Do NOT auto-login — user must sign in manually after registration
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
