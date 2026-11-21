import Dashboard from "./Dashboard";
import Appointments from "./Appointments";
import Consultations from "./Consultations";
import LabRequests from "./LabRequests";
import Prescriptions from "./Prescriptions";
import ImagingRequests from "./ImagingRequests";
import PatientFiles from "./PatientFiles";
import Wallet from "./Wallet";
import PatientDesk from "./PatientDesk";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/desk", label: "Patient desk", icon: "ClipboardPlus", module: "cases" },
    { to: "/app/appointments", label: "My appointments", icon: "CalendarDays" },
    { to: "/app/files", label: "Patient files", icon: "FolderOpen" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [
    { index: true, element: <Dashboard /> }, { path: "desk", element: <PatientDesk /> }, { path: "appointments", element: <Appointments /> }, { path: "consultations", element: <Consultations /> },
    { path: "lab", element: <LabRequests /> }, { path: "prescriptions", element: <Prescriptions /> }, { path: "imaging", element: <ImagingRequests /> },
    { path: "files", element: <PatientFiles /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> },
  ],
};
