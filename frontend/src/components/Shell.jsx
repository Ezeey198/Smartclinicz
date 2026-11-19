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
import Avatar from "./Avatar";
import ClockIn from "./ClockIn";
import NotificationBell from "./NotificationBell";
import ThemePicker from "./ThemePicker";
import Profile from "../roles/shared/Profile";
import Notifications from "../roles/shared/Notifications";
import Chat from "../roles/shared/Chat";
import AiAssistant from "../roles/shared/AiAssistant";
import { Band, Notice, fmtStamp, ugx } from "./ui";

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0E7C86" /><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
);
const MONEY_ROLES = ["admin", "accountant", "pharmacist"];

// One shell for every signed-in user. What it shows comes from that role's own folder in /roles.
export default function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState(null);
  const sub = user.clinic?.subscription;
  const expired = sub?.state === "expired";
  const roles = user.roles || [user.role];                 // a person can hold several roles: their sidebars are combined
  const isAdmin = roles.includes("admin");
  const { count, toasts, dismiss } = useAlerts(isAdmin && !expired);

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {                                        // this account's colour theme (other accounts are not affected)
    document.documentElement.dataset.theme = user.theme || "teal";
    return () => { delete document.documentElement.dataset.theme; };
  }, [user.theme]);
  useEffect(() => {
    if (!user.clinic || !roles.some((r) => MONEY_ROLES.includes(r)) || (expired && !isAdmin)) return;
    api.get("/wallet/summary").then((r) => setWallet(r.data.balance)).catch(() => {});
  }, [loc.pathname, user.role, expired]);

  if (expired && !user.is_superadmin && !isAdmin) return <Inactive />;
  const keyOf = (r) => (user.clinic?.clinic_class === "P" && r === "admin" ? "pharmacy_admin" : r);
  const cfgs = expired ? [expiredAdmin] : user.is_superadmin ? [REGISTRY.superadmin] : roles.map((r) => REGISTRY[keyOf(r)]).filter(Boolean);
  const base = user.is_superadmin ? "/super" : "/app";
  if (cfgs.length === 0) return (
    <div className="link-page"><div className="link-card">
      <div className="brand dark">MediCare</div>
      <h2>This website is out of date</h2>
      <p>The server knows your role ("{user.role}") but this copy of the website does not. The website needs to be redeployed from the latest files.</p>
      <button className="btn primary" onClick={() => { logout(); nav("/"); }}>Sign out</button>
    </div></div>
  );
  // The sidebar is every role's sidebar put together (each page once, the first role's page winning), plus Chat for everyone in a clinic.
  const seen = new Set();
  const items = [...cfgs.flatMap((c) => c.nav), ...(user.is_superadmin ? [] : [{ to: "/app/chat", label: "Chat", icon: "MessagesSquare" }])]
    .filter((i) => i.label !== "My account" && !seen.has(i.to) && seen.add(i.to))
    .filter((i) => !i.module || user.modules?.[i.module]);
  const seenRoutes = new Set();
  const common = [{ path: "profile", element: <Profile /> }, { path: "notifications", element: <Notifications /> }, ...(user.is_superadmin ? [] : [{ path: "chat", element: <Chat /> }, { path: "ai", element: <AiAssistant /> }])];
  const routes = [...cfgs.flatMap((c) => c.routes), ...common].filter((r) => { const k = r.index ? "#index" : r.path; return !seenRoutes.has(k) && seenRoutes.add(k); });

  return (
    <div className="shell">
      <aside className={`side ${open ? "open" : ""}`}>
        <div className="brand"><Logo />MediCare</div>
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
          <button className="icon-btn light" title="Sign out" aria-label="Sign out" onClick={() => { logout(); nav("/"); }}><Icons.LogOut size={18} /></button>
        </div>
      </aside>
      <div className="col">
      <header className="hdr">
        <div className="hdr-left">
          <button className="icon-btn hdr-menu" onClick={() => setOpen(!open)} aria-label="Menu"><Icons.Menu size={20} /></button>
          <ThemePicker />
        </div>
        <div className="hdr-right">
          {!user.is_superadmin && !expired && <ClockIn />}
          <NotificationBell base={base} />
          <button className="avatar-btn" onClick={() => nav(`${base}/profile`)} title="My profile" aria-label="Open my profile"><Avatar user={user} size={38} /></button>
        </div>
      </header>
      <main className="main">
        {expired && <div className="sub-banner warn"><span><b>Clinic inactive:</b> the subscription has ended. Staff cannot sign in until you renew.</span></div>}
        {isAdmin && !expired && user.clinic && sub?.state === "active" && <SubscriptionBanner />}
        <Routes>
          {routes.map((r) => (r.index ? <Route key="index" index element={r.element} /> : <Route key={r.path} path={r.path} element={r.element} />))}
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
      </div>
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
