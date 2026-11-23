import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setUnauthorizedHandler, setTokenRefreshHandler } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

const AuthContext = createContext(null);

function saveToken(token, expiresAt) {
  localStorage.setItem("shell_token", token);
  if (expiresAt) localStorage.setItem("shell_token_expires", expiresAt);
}

function clearToken() {
  localStorage.removeItem("shell_token");
  localStorage.removeItem("shell_token_expires");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    if (localStorage.getItem("shell_token")) {
      api.post(ENDPOINTS.logout).catch(() => {});
    }
    clearToken();
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const res = await api.post(ENDPOINTS.refreshToken);
      if (res.token) {
        saveToken(res.token, res.expires_at);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    setTokenRefreshHandler(refreshToken);
  }, [logout, refreshToken]);

  useEffect(() => {
    const token = localStorage.getItem("shell_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.get(ENDPOINTS.me)
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post(ENDPOINTS.login, { email, password });
    saveToken(res.token, res.expires_at);
    setUser(res.user);
    return res.user;
  };

  const register = async (payload) => {
    const res = await api.post(ENDPOINTS.register, payload);
    saveToken(res.token, res.expires_at);
    setUser(res.user);
    return res.user;
  };

  const googleLogin = async (credential) => {
    const res = await api.post(ENDPOINTS.google, { credential });
    saveToken(res.token, res.expires_at);
    setUser(res.user);
    return res.user;
  };

  const updateProfile = async (patch) => {
    const updated = await api.patch(ENDPOINTS.me, patch);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

