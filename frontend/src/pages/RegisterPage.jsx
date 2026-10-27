
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerUser } from "../api";
import { useAuth } from "../context/AuthContext";
import { ErrorNote } from "../components/Status";

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await registerUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      navigate("/login", {
        replace: true,
        state: {
          message:
            result?.message || "Account created. Log in to continue.",
        },
      });
    } catch (err) {
      if (err.status === 401) return;

      setError(
        err.status === 500
          ? "Could not create the account. That email may already be registered."
          : err.message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow">
      <div className="page-intro">
        <h1>Create an account</h1>
        <p>Register as a customer, then log in to place an order.</p>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <form className="form-card" onSubmit={onSubmit}>
        <label className="field">
          Name
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          Phone number
          <input
            type="tel"
            autoComplete="tel"
            placeholder="e.g. +919876543210"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Creating account…" : "Register"}
        </button>

        <p className="muted">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
