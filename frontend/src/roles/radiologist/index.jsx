import Dashboard from "./Dashboard";
import LabQueue from "../lab_technician/LabQueue";

// The radiologist works exactly like the lab technician, for the imaging the doctor requests.
export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/imaging", label: "Imaging queue", icon: "ScanLine" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "imaging", element: <LabQueue department="radiology" /> }],
};
