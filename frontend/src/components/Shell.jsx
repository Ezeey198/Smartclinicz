import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import api from "../api";
import { useAuth } from "../auth";
import { REGISTRY } from "../roles/registry";
import expiredAdmin from "../roles/admin/expired";
import Inactive from "./Inactive";
import SubscriptionBanner from "./SubscriptionBanner";
import useAlerts from "./useAlerts";
import { Band, Notice, fmtStamp, ugx } from "./ui";

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E7C86" /><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
);
const MONEY_ROLES = ["admin", "accountant", "cashier", "pharmacist"];

// One shell for every signed-in user. What it shows comes from that role's own folder in /roles.
export default function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState(null);
  const sub = user.clinic?.subscription;
  const expired = sub?.state === "expired";
  const isAdmin = user.role === "admin";
  const { count, toasts, dismiss } = useAlerts(isAdmin && !expired);

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!user.clinic || !MONEY_ROLES.includes(user.role) || (expired && !isAdmin)) return;
    api.get("/wallet/summary").then((r) => setWallet(r.data.balance)).catch(() => {});
  }, [loc.pathname, user.role, expired]);

  if (expired && !user.is_superadmin && !isAdmin) return <Inactive />;
  const cfg = expired ? expiredAdmin : REGISTRY[user.is_superadmin ? "superadmin" : user.role];
  const base = user.is_superadmin ? "/super" : "/app";
  if (!cfg) return <Notice tone="error">No workspace is set up for the role "{user.role}".</Notice>;
  const items = cfg.nav.filter((i) => !i.module || user.modules?.[i.module]);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Menu"><Icons.Menu size={20} /></button>
        <strong>ClinicPro</strong>
      </header>
      <aside className={`side ${open ? "open" : ""}`}>
        <div className="brand"><Logo />ClinicPro</div>
        <div className="side-clinic">
          {user.clinic ? (<><div className="cname">{user.clinic.name}</div><Band code={user.clinic.code} cls={user.clinic.clinic_class} /></>) : <div className="cname">System administration</div>}
          {wallet != null && <NavLink to="/app/wallet" className="wallet-chip"><Icons.Wallet size={15} />Wallet <b>{ugx(wallet)}</b></NavLink>}
        </div>
        <nav>
          {items.map((i) => {
            const Icon = Icons[i.icon] || Icons.Circle;
            return (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => "nav" + (isActive ? " on" : "")}>
                <Icon size={18} />{i.label}{i.badge === "alerts" && count > 0 && <span className="badge">{count}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="me">
          <div><b>{user.full_name}</b><small>{user.role_label}</small></div>
          <button className="icon-btn light" title="Sign out" aria-label="Sign out" onClick={() => { logout(); nav("/login"); }}><Icons.LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main">
        {expired && <div className="sub-banner warn"><span><b>Clinic inactive:</b> the subscription has ended. Staff cannot sign in until you renew.</span></div>}
        {!expired && user.clinic && sub?.state === "active" && <SubscriptionBanner />}
        <Routes>
          {cfg.routes.map((r) => (r.index ? <Route key="index" index element={r.element} /> : <Route key={r.path} path={r.path} element={r.element} />))}
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
      <div className="toasts" aria-live="polite">
        {toasts.map((a) => (
          <div key={a.id} className="toast" onClick={() => { dismiss(a.id); nav("/app/activity"); }}>
            <b>{a.user_name}</b> <span className="sub">{a.role.replace(/_/g, " ")} · {fmtStamp(a.created_at)}</span>
            <div>{a.summary}</div>
          </div>))}
      </div>
    </div>
  );
}
