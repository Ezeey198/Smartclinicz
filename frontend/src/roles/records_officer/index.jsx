import Dashboard from "./Dashboard";
import Patients from "./Patients";
import PatientFiles from "./PatientFiles";
import Appointments from "./Appointments";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/patients", label: "Patient register", icon: "Users" },
    { to: "/app/files", label: "Patient files", icon: "FolderOpen" },
    { to: "/app/appointments", label: "Appointments", icon: "CalendarDays" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "patients", element: <Patients /> }, { path: "files", element: <PatientFiles /> },
    { path: "appointments", element: <Appointments /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
