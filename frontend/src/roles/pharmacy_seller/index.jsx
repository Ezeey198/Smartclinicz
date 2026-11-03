import Dashboard from "./Dashboard";
import Sell from "./Sell";
import MySales from "./MySales";
import Catalog from "./Catalog";
import Wallet from "./Wallet";
import Account from "../shared/Account";

export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/sell", label: "Sell", icon: "ShoppingCart" },
    { to: "/app/sales", label: "My sales", icon: "ReceiptText" },
    { to: "/app/products", label: "Products", icon: "Pill" },
    { to: "/app/wallet", label: "My wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Dashboard /> }, { path: "sell", element: <Sell /> }, { path: "sales", element: <MySales /> }, { path: "products", element: <Catalog /> },
    { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
