import LabStock from "./LabStock";
import Dashboard from "./Dashboard";
import LabQueue from "./LabQueue";
import Patients from "./Patients";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/stock", label: "Lab stock", icon: "Boxes", module: "inventory" },
    { to: "/app/queue", label: "Lab queue", icon: "FlaskConical" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ path: "stock", element: <LabStock /> }, { index: true, element: <Dashboard /> }, { path: "queue", element: <LabQueue /> }, { path: "patients", element: <Patients /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
