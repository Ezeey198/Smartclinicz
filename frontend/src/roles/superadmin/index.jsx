import Overview from "./Overview";
import Clinics from "./Clinics";
import Outbox from "./Outbox";
import Subscriptions from "./Subscriptions";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/super", label: "Overview", icon: "LayoutDashboard", end: true },
    { to: "/super/clinics", label: "Clinics", icon: "Building2" },
    { to: "/super/subscriptions", label: "Subscriptions", icon: "BadgeCheck" },
    { to: "/super/outbox", label: "Email outbox", icon: "Mail" },
    { to: "/super/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [
    { index: true, element: <Overview /> }, { path: "clinics", element: <Clinics /> },
    { path: "subscriptions", element: <Subscriptions /> }, { path: "outbox", element: <Outbox /> }, { path: "account", element: <Account /> },
  ],
};
