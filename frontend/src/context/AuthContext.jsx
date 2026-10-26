import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, clearToken, getAdminArea, getProfile, getToken, login as loginRequest } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
        return;
      }
      try {
        const profile = await getProfile();
        if (!cancelled) setUser(profile);
      } catch (error) {
        if (!cancelled && error.status !== 401) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      clearToken();
      setUser(null);
      const adminPath = window.location.pathname.startsWith("/admin");
      navigate(adminPath ? "/admin/login" : "/login", { replace: true });
    }
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [navigate]);

  async function signIn(email, password, options = {}) {
    await loginRequest(email, password);
    try {
      const profile = await getProfile();
      if (options.admin && profile.role !== "admin") {
        clearToken();
        setUser(null);
        throw new ApiError("This account does not have admin access.", 403);
      }
      if (options.admin) await getAdminArea();
      setUser(profile);
      return profile;
    } catch (error) {
      if (options.admin) {
        clearToken();
        setUser(null);
      }
      throw error;
    }
  }

  function signOut() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
