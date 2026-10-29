import Dashboard from "./Dashboard";
import Stock from "./Stock";
import Requests from "./Requests";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/stock", label: "Stock", icon: "Boxes" },
    { to: "/app/requests", label: "Dispensing requests", icon: "ClipboardList" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "stock", element: <Stock /> }, { path: "requests", element: <Requests /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
