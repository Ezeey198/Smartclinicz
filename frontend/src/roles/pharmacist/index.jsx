import Dashboard from "./Dashboard";
import Prescriptions from "./Prescriptions";
import Stock from "./Stock";
import Patients from "./Patients";
import Wallet from "./Wallet";
import Payments from "./Payments";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/prescriptions", label: "Prescriptions", icon: "Pill" },
    { to: "/app/payments", label: "Payments", icon: "CreditCard" },
    { to: "/app/stock", label: "Pharmacy stock", icon: "Boxes" },
    { to: "/app/patients", label: "Patients", icon: "Users" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "prescriptions", element: <Prescriptions /> }, { path: "payments", element: <Payments /> }, { path: "stock", element: <Stock /> },
    { path: "patients", element: <Patients /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
