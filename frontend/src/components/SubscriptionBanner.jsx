import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { fmtLeft, ugx } from "./ui";

// Counts down the clinic's remaining active time for everyone, and flips the app to "inactive" when it hits zero.
export default function SubscriptionBanner() {
  const { user, refresh } = useAuth();
  const sub = user.clinic.subscription;
  const end = sub.active_until ? Date.parse(sub.active_until) : 0;
  const [left, setLeft] = useState(Math.max(0, Math.floor((end - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(id); refresh(); }
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  const warn = left < 1800;
  return (
    <div className={`sub-banner ${warn ? "warn" : ""}`}>
      <span><b>{sub.trial ? "Free trial" : "Subscription"}:</b> clinic is active for another <b>{fmtLeft(left)}</b>.</span>
      {user.role === "admin" && <Link to="/app/subscription">{warn ? `Renew now (${ugx(sub.price)})` : "Manage subscription"}</Link>}
    </div>
  );
}
