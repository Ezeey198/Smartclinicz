import Dashboard from "./Dashboard";
import ImagingQueue from "./ImagingQueue";
import Patients from "./Patients";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/imaging", label: "Imaging queue", icon: "ScanLine" },
    { to: "/app/patients", label: "Patients", icon: "Users" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "imaging", element: <ImagingQueue /> }, { path: "patients", element: <Patients /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
