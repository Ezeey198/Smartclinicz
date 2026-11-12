import { useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E7C86" /><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
);

// The public website: About and Clinics on the left, Sign in on the right.
export default function PublicLayout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const taps = useRef({ n: 0, last: 0 });
  // Six or more quick, consecutive clicks on the ClinicPro name open the superadmin sign-in. Nothing on the page points to it.
  const tap = () => {
    const now = Date.now(), t = taps.current;
    t.n = now - t.last < 2000 ? t.n + 1 : 1;
    t.last = now;
    if (t.n >= 6) { t.n = 0; nav("/superadmin"); }
  };
  return (
    <div className="pub">
      <header className="pub-head">
        <nav className="pub-nav"><NavLink to="/about">About</NavLink><NavLink to="/clinics">Clinics</NavLink></nav>
        <Link to="/" className="pub-brand" onClick={tap}><Logo /><span>ClinicPro</span></Link>
        <div className="pub-right">
          {user ? <Link className="btn primary" to={user.is_superadmin ? "/super" : "/app"}>Open my workspace</Link> : <Link className="btn primary" to="/login">Sign in</Link>}
        </div>
      </header>
      <main className="pub-main"><Outlet /></main>
      <footer className="pub-foot">ClinicPro · clinics and pharmacies, online</footer>
    </div>
  );
}
