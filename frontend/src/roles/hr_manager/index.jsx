import Dashboard from "./Dashboard";
import StaffDirectory from "./StaffDirectory";
import LeaveRequests from "./LeaveRequests";
import Wallet from "./Wallet";
import Payroll from "./Payroll";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/staff", label: "Staff directory", icon: "Users" },
    { to: "/app/leave", label: "Leave requests", icon: "CalendarOff" },
    { to: "/app/payroll", label: "Salaries", icon: "HandCoins" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "staff", element: <StaffDirectory /> }, { path: "leave", element: <LeaveRequests /> }, { path: "payroll", element: <Payroll /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
