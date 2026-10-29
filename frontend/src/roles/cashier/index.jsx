import Dashboard from "./Dashboard";
import Invoices from "./Invoices";
import Receipts from "./Receipts";
import Wallet from "./Wallet";
import PriceList from "./PriceList";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/invoices", label: "Invoices", icon: "Receipt" },
    { to: "/app/receipts", label: "Receipts", icon: "CreditCard" },
    { to: "/app/prices", label: "Price list", icon: "Tags" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "invoices", element: <Invoices /> }, { path: "receipts", element: <Receipts /> }, { path: "prices", element: <PriceList /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
