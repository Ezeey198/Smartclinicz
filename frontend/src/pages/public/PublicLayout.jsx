import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { SITE_NAME } from "../../config/site";

// The public website. The top bar: the name on the left, then About and Clinics, and Sign in on the right.
export default function PublicLayout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const go = useRef(nav);
  go.current = nav;
  // Six or more quick, consecutive taps or clicks anywhere on the public pages (the landing page included) open the superadmin sign-in.
  // Each one must come within 3 seconds of the one before. Nothing on the page points to it.
  // Listens on the whole document for pointer events, which fire for mouse and touch alike, even on empty areas of the page.
  useEffect(() => {
    const t = { n: 0, last: 0 };
    const tap = (e) => {
      if (e.button > 0) return;                       // left mouse button or a finger only
      const now = Date.now();
      t.n = now - t.last < 3000 ? t.n + 1 : 1;
      t.last = now;
      if (t.n >= 6) { t.n = 0; setTimeout(() => go.current("/superadmin"), 60); }   // after any link under the finger has done its own navigation
    };
    document.addEventListener("pointerup", tap, true);
    return () => document.removeEventListener("pointerup", tap, true);
  }, []);
  return (
    <div className="pub">
      <header className="pub-head">
        <Link to="/" className="pub-brand">{SITE_NAME}</Link>
        <nav className="pub-nav"><NavLink to="/about">About</NavLink><NavLink to="/clinics">Clinics</NavLink></nav>
        <div className="pub-right">
          {user ? <Link className="btn primary" to={user.is_superadmin ? "/super" : "/app"}>Open my workspace</Link> : <Link className="btn primary" to="/login">Sign in</Link>}
        </div>
      </header>
      <main className="pub-main"><Outlet /></main>
      <footer className="pub-foot">{SITE_NAME} · clinics and pharmacies, online</footer>
    </div>
  );
}
