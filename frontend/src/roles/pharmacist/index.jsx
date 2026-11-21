import Dashboard from "./Dashboard";
import Prescriptions from "./Prescriptions";
import Stock from "./Stock";
import Patients from "./Patients";
import Wallet from "./Wallet";
import PharmacyDesk from "./PharmacyDesk";
import Payments from "./Payments";
import Account from "../shared/Account";
import Sales from "./Sales";
import Purchases from "./Purchases";
import Returns from "./Returns";
import PharmReports from "./PharmReports";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/desk", label: "Pharmacy desk", icon: "ReceiptText", module: "cases" },
    { to: "/app/sales", label: "Walk-in sales", icon: "ShoppingCart", module: "inventory" },
    { to: "/app/prescriptions", label: "Prescriptions", icon: "Pill" },
    { to: "/app/stock", label: "Pharmacy stock", icon: "Boxes" },
    { to: "/app/purchases", label: "Purchases and suppliers", icon: "Truck", module: "inventory" },
    { to: "/app/returns", label: "Returns and expired", icon: "RotateCcw", module: "inventory" },
    { to: "/app/pharmacy-reports", label: "Pharmacy reports", icon: "ClipboardList", module: "inventory" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "sales", element: <Sales /> }, { path: "purchases", element: <Purchases /> }, { path: "returns", element: <Returns /> }, { path: "pharmacy-reports", element: <PharmReports /> }, { path: "desk", element: <PharmacyDesk /> }, { path: "prescriptions", element: <Prescriptions /> }, { path: "payments", element: <Payments /> }, { path: "stock", element: <Stock /> },
    { path: "patients", element: <Patients /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
