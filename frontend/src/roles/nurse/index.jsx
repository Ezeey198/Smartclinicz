import Dashboard from "./Dashboard";
import Triage from "./Triage";
import Appointments from "./Appointments";
import Patients from "./Patients";
import Medications from "./Medications";
import LabResults from "./LabResults";
import PatientFiles from "./PatientFiles";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/triage", label: "Triage and vitals", icon: "HeartPulse" },
    { to: "/app/appointments", label: "Check-in", icon: "CalendarDays" },
    { to: "/app/patients", label: "Patients", icon: "Users" },
    { to: "/app/medications", label: "Medications", icon: "Pill" },
    { to: "/app/lab", label: "Lab results", icon: "FlaskConical" },
    { to: "/app/files", label: "Patient files", icon: "FolderOpen" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [
    { index: true, element: <Dashboard /> }, { path: "triage", element: <Triage /> }, { path: "appointments", element: <Appointments /> },
    { path: "patients", element: <Patients /> }, { path: "medications", element: <Medications /> }, { path: "lab", element: <LabResults /> },
    { path: "files", element: <PatientFiles /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> },
  ],
};
