import Dashboard from "./Dashboard";
import LabQueue from "./LabQueue";
import Patients from "./Patients";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/queue", label: "Lab queue", icon: "FlaskConical" },
    { to: "/app/patients", label: "Patients", icon: "Users" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "queue", element: <LabQueue /> }, { path: "patients", element: <Patients /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
