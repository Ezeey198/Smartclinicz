import Dashboard from "./Dashboard";
import Invoices from "./Invoices";
import Expenses from "./Expenses";
import Reports from "./Reports";
import Prices from "./Prices";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/invoices", label: "Invoices", icon: "Receipt" },
    { to: "/app/expenses", label: "Expenses", icon: "Banknote" },
    { to: "/app/prices", label: "Price list", icon: "Tags" },
    { to: "/app/reports", label: "Reports", icon: "BarChart3" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "invoices", element: <Invoices /> }, { path: "expenses", element: <Expenses /> },
    { path: "prices", element: <Prices /> }, { path: "reports", element: <Reports /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
