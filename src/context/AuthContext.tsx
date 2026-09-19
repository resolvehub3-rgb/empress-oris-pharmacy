import React, { createContext, useContext, useState, useEffect } from "react";
import { User, PharmacySettings } from "../types";
import { apiRequest, setAuthToken, getAuthToken } from "../lib/api";

interface SetupStatus {
  configured: boolean;
  hasOwner: boolean;
  userCount?: number;
  pharmacyName?: string | null;
  currency?: string;
  currencySymbol?: string;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  settings: PharmacySettings | null;
  status: SetupStatus | null;
  isLoading: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  setupOwner: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateSettings: (data: Partial<PharmacySettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = async () => {
    try {
      const data = await apiRequest<SetupStatus>("/api/auth/status");
      setStatus(data);
    } catch (err) {
      console.warn("[AuthContext] Status check error:", err);
      setStatus({ configured: false, hasOwner: false });
    }
  };

  const refreshProfile = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User; settings: PharmacySettings }>("/api/auth/me");
      setUser(data.user);
      setSettings(data.settings);
    } catch (err) {
      console.warn("[AuthContext] Profile load error, clearing token:", err);
      setAuthToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      await refreshStatus();
      await refreshProfile();
    }
    init();
  }, []);

  const login = async (email: string, password?: string) => {
    const data = await apiRequest<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    setUser(data.user);
    await refreshProfile();
    await refreshStatus();
  };

  const setupOwner = async (payload: any) => {
    const data = await apiRequest<{ user: User; token: string }>("/api/auth/setup-owner", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthToken(data.token);
    setUser(data.user);
    await refreshProfile();
    await refreshStatus();
  };

  const updateSettings = async (data: Partial<PharmacySettings>) => {
    const res = await apiRequest<{ settings: PharmacySettings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (res.settings) {
      setSettings(res.settings);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        status,
        isLoading,
        loading: isLoading,
        login,
        setupOwner,
        logout,
        refreshProfile,
        refreshStatus,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
