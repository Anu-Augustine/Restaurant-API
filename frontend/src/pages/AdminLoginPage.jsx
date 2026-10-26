import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorNote } from "../components/Status";

export function AdminLoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notice = location.state?.message || "";

  if (user?.role === "admin") return <Navigate to="/admin" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password, { admin: true });
      navigate("/admin", { replace: true });
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow">
      <div className="page-intro">
        <h1>Admin login</h1>
        <p>Kitchen staff sign in here. Customer accounts are turned away.</p>
      </div>
      {notice && <p className="banner success">{notice}</p>}
      <ErrorNote>{error}</ErrorNote>
      <form className="form-card" onSubmit={onSubmit}>
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Checking access…" : "Enter the kitchen"}
        </button>
        <p className="muted">
          Customer instead? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
