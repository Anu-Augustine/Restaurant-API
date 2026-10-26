import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChatWidget } from "./ChatWidget";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const SHELVES = [
  { id: "popular", label: "Popular" },
  { id: "meat", label: "Meat & Seafood" },
  { id: "healthy", label: "Healthy & Diet" },
];

export function Layout({ children }) {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const shelf = params.get("shelf") || "popular";
  const query = params.get("q") || "";

  function logout() {
    signOut();
    setAccountOpen(false);
    navigate("/");
  }

  function openShelf(id) {
    const next = new URLSearchParams(params);
    if (id === "popular") next.delete("shelf");
    else next.set("shelf", id);
    navigate({ pathname: "/", search: next.toString() });
  }

  function onSearch(event) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const value = event.target.elements.q.value.trim();
    if (value) next.set("q", value);
    else next.delete("q");
    navigate({ pathname: "/", search: next.toString() });
    setSearchOpen(false);
  }

  function onJoin(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
    setEmail("");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8 3v8a3 3 0 0 1-2 2.8V21h2v-7.2A3 3 0 0 1 6 11V3H8zm4 0v18h2V3h-2zm5 0c0 4.2-.8 6.8-2.2 8.2-.6.6-.8 1.1-.8 1.8V21h2v-7.4c.2-.2.7-.8 1.2-1.6C18.6 10 19 7.8 19 3h-2z" />
            </svg>
          </span>
          <strong>Forkful</strong>
        </NavLink>
        <nav className="site-nav">
          {SHELVES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={location.pathname === "/" && shelf === item.id ? "active" : ""}
              onClick={() => openShelf(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <button type="button" className="icon-button" aria-label="Search" onClick={() => setSearchOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="2" d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-5.2-5.2" /></svg>
          </button>
          <button type="button" className="icon-button" aria-label="Account" onClick={() => setAccountOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0" /></svg>
          </button>
          <NavLink to="/cart" className="icon-button" aria-label="Cart">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="2" d="M6 6h15l-1.5 9h-12L5 3H2" /><circle cx="9" cy="20" r="1.4" fill="currentColor" /><circle cx="18" cy="20" r="1.4" fill="currentColor" /></svg>
            {count > 0 && <span className="cart-count">{count}</span>}
          </NavLink>
          {accountOpen && (
            <div className="account-pop">
              {user ? (
                <>
                  <p>{user.name}</p>
                  <NavLink to="/orders" onClick={() => setAccountOpen(false)}>Orders</NavLink>
                  {user.role === "admin" ? (
                    <NavLink to="/admin" onClick={() => setAccountOpen(false)}>Admin</NavLink>
                  ) : (
                    <NavLink to="/admin/login" onClick={() => setAccountOpen(false)}>Admin login</NavLink>
                  )}
                  <button type="button" onClick={logout}>Log out</button>
                </>
              ) : (
                <>
                  <NavLink to="/login" onClick={() => setAccountOpen(false)}>Log in</NavLink>
                  <NavLink to="/register" onClick={() => setAccountOpen(false)}>Register</NavLink>
                  <NavLink to="/admin/login" onClick={() => setAccountOpen(false)}>Admin login</NavLink>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      {searchOpen && (
        <form className="search-bar" onSubmit={onSearch}>
          <input name="q" defaultValue={query} placeholder="Search dishes" aria-label="Search dishes" autoFocus />
          <button type="submit" className="pill">Search</button>
        </form>
      )}
      <main className="page">{children}</main>
      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <h2>Quick Links</h2>
            <NavLink to="/">All Categories</NavLink>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/chat">Ask Forkful</NavLink>
            <NavLink to="/cart">Cart</NavLink>
          </div>
          <div>
            <h2>Get In Touch</h2>
            <NavLink to="/chat">Chat with us</NavLink>
            <NavLink to="/login">Account</NavLink>
            <NavLink to="/admin/login">Admin login</NavLink>
            <a href="#dishes">Today's dishes</a>
          </div>
          <form onSubmit={onJoin}>
            <h2>Stay in the kitchen</h2>
            {joined ? (
              <p className="muted">Thanks. You're on the list.</p>
            ) : (
              <div className="email-row">
                <input
                  type="email"
                  required
                  placeholder="Enter Email"
                  aria-label="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button type="submit" className="pill">Join</button>
              </div>
            )}
          </form>
        </div>
        <p className="copyright">© {new Date().getFullYear()} Forkful. All Rights Reserved.</p>
      </footer>
      <ChatWidget />
    </div>
  );
}
