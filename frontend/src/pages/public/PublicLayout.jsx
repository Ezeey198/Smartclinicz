import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth";

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E7C86" /><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
);

// The public website: About and Clinics on the left, Sign in on the right.
export default function PublicLayout() {
  const { user } = useAuth();
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
