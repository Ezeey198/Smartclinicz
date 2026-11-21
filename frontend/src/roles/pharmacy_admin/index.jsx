import Dashboard from "./Dashboard";
import Sell from "./Sell";
import Sales from "./Sales";
import Products from "./Products";
import Expiry from "./Expiry";
import Suppliers from "./Suppliers";
import Purchases from "./Purchases";
import Reports from "./Reports";
import Expenses from "./Expenses";
import Staff from "./Staff";
import Activity from "./Activity";
import Subscription from "./Subscription";
import Stamp from "./Stamp";
import Settings from "./Settings";
import Wallet from "./Wallet";
import PublicPage from "./PublicPage";
import Account from "../shared/Account";

// The pharmacy admin: the whole pharmacy, its sellers, its stock and its money.
export default {
  nav: [
    { to: "/app", label: "Dashboard", icon: "LayoutDashboard", end: true },
    { to: "/app/sell", label: "Sell", icon: "ShoppingCart", module: "sales" },
    { to: "/app/sales", label: "Sales", icon: "ReceiptText", module: "sales" },
    { to: "/app/products", label: "Products", icon: "Pill", module: "products" },
    { to: "/app/expiry", label: "Expiry", icon: "CalendarClock", module: "products" },
    { to: "/app/suppliers", label: "Suppliers", icon: "Truck", module: "suppliers" },
    { to: "/app/purchases", label: "Purchases", icon: "PackagePlus", module: "purchases" },
    { to: "/app/reports", label: "Reports", icon: "TrendingUp", module: "sales" },
    { to: "/app/expenses", label: "Expenses", icon: "Banknote", module: "accounts" },
    { to: "/app/activity", label: "Alerts", icon: "Bell", badge: "alerts" },
    { to: "/app/staff", label: "Staff", icon: "UserCog" },
    { to: "/app/subscription", label: "Subscription", icon: "BadgeCheck" },
    { to: "/app/public", label: "Public page", icon: "Globe" },
    { to: "/app/stamp", label: "Pharmacy stamp", icon: "Stamp" },
    { to: "/app/settings", label: "Pharmacy settings", icon: "Settings" },
    { to: "/app/wallet", label: "Wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [
    { index: true, element: <Dashboard /> }, { path: "sell", element: <Sell /> }, { path: "sales", element: <Sales /> }, { path: "products", element: <Products /> },
    { path: "expiry", element: <Expiry /> }, { path: "suppliers", element: <Suppliers /> }, { path: "purchases", element: <Purchases /> }, { path: "reports", element: <Reports /> },
    { path: "expenses", element: <Expenses /> }, { path: "activity", element: <Activity /> }, { path: "staff", element: <Staff /> }, { path: "subscription", element: <Subscription /> },
    { path: "stamp", element: <Stamp /> }, { path: "public", element: <PublicPage /> }, { path: "settings", element: <Settings /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> },
  ],
};
