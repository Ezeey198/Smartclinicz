import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E7C86" /><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
);

// The public website: About and Clinics on the left, Sign in on the right.
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
      if (t.n >= 10) { t.n = 0; setTimeout(() => go.current("/superadmin"), 60); }   // after any link under the finger has done its own navigation
    };
    document.addEventListener("pointerup", tap, true);
    return () => document.removeEventListener("pointerup", tap, true);
  }, []);
  return (
    <div className="pub">
      <header className="pub-head">
        <nav className="pub-nav"><NavLink to="/about">About</NavLink><NavLink to="/clinics">Clinics</NavLink></nav>
        <Link to="/" className="pub-brand"><Logo /><span>ClinicPro</span></Link>
        <div className="pub-right">
          {user ? <Link className="btn primary" to={user.is_superadmin ? "/super" : "/app"}>Open my workspace</Link> : <Link className="btn primary" to="/login">Sign in</Link>}
        </div>
      </header>
      <main className="pub-main"><Outlet /></main>
      <footer className="pub-foot">ClinicPro · clinics and pharmacies, online</footer>
    </div>
  );
}
