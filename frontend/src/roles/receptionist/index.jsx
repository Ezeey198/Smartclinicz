import Dashboard from "./Dashboard";
import Patients from "./Patients";
import Appointments from "./Appointments";
import Invoices from "./Invoices";
import Wallet from "./Wallet";
import PriceList from "./PriceList";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/patients", label: "Patient registration", icon: "Users" },
    { to: "/app/appointments", label: "Appointments", icon: "CalendarDays" },
    { to: "/app/invoices", label: "Invoices", icon: "Receipt", module: "billing" },
    { to: "/app/prices", label: "Price list", icon: "Tags" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "patients", element: <Patients /> }, { path: "appointments", element: <Appointments /> },
    { path: "invoices", element: <Invoices /> }, { path: "prices", element: <PriceList /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
