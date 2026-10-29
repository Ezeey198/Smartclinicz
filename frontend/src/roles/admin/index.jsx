import Dashboard from "./Dashboard";
import Staff from "./Staff";
import ClinicSettings from "./ClinicSettings";
import Patients from "./Patients";
import Appointments from "./Appointments";
import Consultations from "./Consultations";
import Laboratory from "./Laboratory";
import Pharmacy from "./Pharmacy";
import Stock from "./Stock";
import Imaging from "./Imaging";
import Billing from "./Billing";
import Expenses from "./Expenses";
import Reports from "./Reports";
import Leave from "./Leave";
import PatientFiles from "./PatientFiles";
import Wallet from "./Wallet";
import Subscription from "./Subscription";
import Activity from "./Activity";
import Prices from "./Prices";
import Payroll from "./Payroll";
import Account from "../shared/Account";

// The clinic admin sees every module available to the clinic's class and can change anything in it.
export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/patients", label: "Patients", icon: "Users", module: "patients" },
    { to: "/app/appointments", label: "Appointments", icon: "CalendarDays", module: "appointments" },
    { to: "/app/consultations", label: "Consultations", icon: "Stethoscope", module: "visits" },
    { to: "/app/lab", label: "Laboratory", icon: "FlaskConical", module: "lab" },
    { to: "/app/pharmacy", label: "Pharmacy", icon: "Pill", module: "pharmacy" },
    { to: "/app/stock", label: "Stock", icon: "Boxes", module: "inventory" },
    { to: "/app/imaging", label: "Imaging", icon: "ScanLine", module: "imaging" },
    { to: "/app/billing", label: "Billing", icon: "Receipt", module: "billing" },
    { to: "/app/expenses", label: "Expenses", icon: "Banknote", module: "accounts" },
    { to: "/app/reports", label: "Reports", icon: "BarChart3", module: "accounts" },
    { to: "/app/leave", label: "Leave", icon: "CalendarOff", module: "hr" },
    { to: "/app/payroll", label: "Salaries", icon: "HandCoins", module: "payroll" },
    { to: "/app/prices", label: "Price list", icon: "Tags", module: "prices" },
    { to: "/app/files", label: "Patient files", icon: "FolderOpen" },
    { to: "/app/activity", label: "Alerts", icon: "Bell", badge: "alerts" },
    { to: "/app/subscription", label: "Subscription", icon: "BadgeCheck" },
    { to: "/app/staff", label: "Staff", icon: "UserCog" },
    { to: "/app/settings", label: "Clinic settings", icon: "Settings" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [
    { index: true, element: <Dashboard /> }, { path: "patients", element: <Patients /> }, { path: "appointments", element: <Appointments /> },
    { path: "consultations", element: <Consultations /> }, { path: "lab", element: <Laboratory /> }, { path: "pharmacy", element: <Pharmacy /> },
    { path: "stock", element: <Stock /> }, { path: "imaging", element: <Imaging /> }, { path: "billing", element: <Billing /> },
    { path: "expenses", element: <Expenses /> }, { path: "reports", element: <Reports /> }, { path: "leave", element: <Leave /> }, { path: "payroll", element: <Payroll /> }, { path: "prices", element: <Prices /> },
    { path: "activity", element: <Activity /> }, { path: "subscription", element: <Subscription /> },
    { path: "files", element: <PatientFiles /> }, { path: "staff", element: <Staff /> }, { path: "settings", element: <ClinicSettings /> },
    { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> },
  ],
};
