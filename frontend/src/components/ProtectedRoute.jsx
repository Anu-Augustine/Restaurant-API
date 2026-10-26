import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ admin = false, children }) {
  const { user, ready } = useAuth();

  if (!ready) return <p className="banner">Checking your account…</p>;
  if (!user) return <Navigate to={admin ? "/admin/login" : "/login"} replace />;
  if (admin && user.role !== "admin") {
    return <Navigate to="/admin/login" replace state={{ message: "Sign in with an admin account." }} />;
  }
  return children;
}
